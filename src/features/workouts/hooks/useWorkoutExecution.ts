import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import {
  buildExecutionGroups,
  countDone,
  setKey,
  summarizeSession,
  toSetDraft,
  type ExecutionExerciseGroup,
  type ExecutionSetRow,
  type SessionSummary,
} from '../domain/workoutExecution'
import { isSameLocalDay, startOfLocalDay } from '../domain/trainingDay'
import { workoutLogRepository } from '../repositories/workoutLogRepository'
import type { LastWeightEntry, WorkoutLog } from '../domain/workoutLog.types'
import type { WorkoutExerciseEntry } from '../domain/workout.types'

/**
 * `idle` = existe ficha mas nenhuma sessão aberta (a tela mostra "Iniciar treino").
 * `ready` = em execução, com as séries na tela.
 * `completed` = a sessão de HOJE desta divisão já foi fechada; a tela mostra o resumo e não
 * reabre nada (recarregar a página tem de continuar dizendo "concluído hoje").
 */
export type ExecutionStatus = 'idle' | 'loading' | 'ready' | 'completed' | 'error'

/** Feedback de gravação. O aluno está na academia e não vai clicar em "salvar". */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseWorkoutExecutionResult {
  status: ExecutionStatus
  saveStatus: SaveStatus
  errorMessage: string | undefined
  session: WorkoutLog | null
  groups: ExecutionExerciseGroup[]
  progress: { done: number; total: number }
  /** Resumo do que foi feito: séries, volume e duração real (duração só após concluir). */
  summary: SessionSummary
  /** Cria ou retoma a sessão da divisão. Idempotente (a garantia vive em `startSession`). */
  start: () => Promise<void>
  /** Fecha a sessão (grava o que estiver pendente antes). Vira `status: 'completed'`. */
  complete: () => Promise<void>
  /** Altera uma série e agenda a gravação. Marcar "feita" grava na hora. */
  updateRow: (exerciseId: string, setIndex: number, patch: Partial<ExecutionSetRow>) => void
}

/** Janela do auto-save por campo. Salvar a cada tecla seria 1 request por caractere no 4G. */
const SAVE_DEBOUNCE_MS = 400

/** Quanto tempo o selo "salvo" fica visível antes de voltar ao estado neutro. */
const SAVED_BADGE_MS = 1600

interface UseWorkoutExecutionInput {
  /** Letra da divisão vinda da rota (`/aluno/treinos/A`). */
  divisionKey: string | undefined
  /** Ficha que originou a sessão; `null` quando o aluno treina sem prescrição. */
  planId: string | null
  entries: WorkoutExerciseEntry[]
  exerciseName: (exerciseId: string) => string
  /**
   * `false` enquanto ficha ou catálogo ainda estão carregando. Sem esse portão, o hook montaria
   * as linhas com `exerciseName` caindo no id e gravaria `"0025"` como nome do exercício no
   * histórico — que é denormalizado e não se corrige depois.
   */
  ready: boolean
}

/**
 * Executa a divisão: abre/retoma a sessão, mantém as séries na tela e grava cada alteração.
 *
 * Três decisões que não são óbvias no código:
 *
 * 1. **Debounce é daqui, não do repositório.** `upsertSet` é idempotente, mas uma request por
 *    tecla na rede da academia derrubaria a experiência. Cada campo tem seu próprio timer
 *    (chave `exerciseId#setIndex`), então digitar a carga do exercício 3 não atrasa o check do 1.
 * 2. **O check "feita" fura o debounce.** É um gesto único e deliberado; esperar 400ms depois do
 *    toque faria o aluno duvidar se marcou. O timer pendente do mesmo campo é cancelado antes,
 *    para o payload mais recente não ser sobrescrito por um atrasado.
 * 3. **O estado da tela é a fonte de verdade durante o treino.** O retorno de `upsertSet` NÃO é
 *    escrito de volta nas linhas: a resposta chega depois do próximo caractere e faria o campo
 *    "pular" para o valor antigo.
 */
export function useWorkoutExecution({
  divisionKey,
  planId,
  entries,
  exerciseName,
  ready,
}: UseWorkoutExecutionInput): UseWorkoutExecutionResult {
  const { userId, status: authStatus } = useAuthUser()
  const [status, setStatus] = useState<ExecutionStatus>('loading')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string>()
  const [session, setSession] = useState<WorkoutLog | null>(null)
  const [groups, setGroups] = useState<ExecutionExerciseGroup[]>([])

  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const sessionRef = useRef<WorkoutLog | null>(null)
  const savedBadgeRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  /**
   * Espelho síncrono das linhas, por `exerciseId#setIndex`. O que vai para o banco é lido daqui e
   * não do estado React: `setGroups` é assíncrono, e o auto-save (imediato no check) pode disparar
   * antes do re-render — gravando o valor ANTERIOR ao toque do aluno.
   */
  const rowsRef = useRef(new Map<string, { group: ExecutionExerciseGroup; row: ExecutionSetRow }>())

  // `entries` chega de `program.sessions.find(...)`, um array novo a cada render — identificar a
  // divisão por conteúdo evita recarregar a sessão em loop.
  const entriesSignature = useMemo(
    () => entries.map((entry) => `${entry.exerciseId}:${entry.sets}:${entry.reps}`).join('|'),
    [entries],
  )

  const entriesRef = useRef(entries)
  const exerciseNameRef = useRef(exerciseName)

  // A sincronização é em efeito, não no corpo do componente: mexer em `ref.current` durante o
  // render é o que `react-hooks/refs` proíbe (e quebra em render concorrente). Para o uso daqui
  // basta estar atualizado ANTES de qualquer interação do aluno, e efeito garante isso.
  useEffect(() => {
    sessionRef.current = session
    entriesRef.current = entries
    exerciseNameRef.current = exerciseName
  })

  /** Lê sessão + séries + histórico de carga e monta as linhas. */
  const load = useCallback(
    async (studentId: string, division: string, existing: WorkoutLog | null) => {
      const currentEntries = entriesRef.current
      const open = existing ?? (await workoutLogRepository.findOpenSession(studentId, division))

      /*
       * Sem sessão aberta a tela ainda não é "a fazer": o aluno pode ter CONCLUÍDO esta divisão
       * hoje, e recarregar a página tem de continuar dizendo isso (critério da F10-4).
       *
       * A janela de busca começa um dia antes da meia-noite local porque `listSessions` filtra
       * por `started_at`: um treino começado às 23h50 e concluído depois da meia-noite é de hoje
       * e ficaria de fora de uma janela que começasse hoje.
       */
      let closedToday: WorkoutLog | null = null
      if (!open) {
        const windowStart = startOfLocalDay(new Date())
        windowStart.setDate(windowStart.getDate() - 1)
        const recent = await workoutLogRepository.listSessions(studentId, {
          from: windowStart.toISOString(),
        })
        closedToday =
          recent.find(
            (log) =>
              log.divisionKey === division &&
              log.completedAt !== null &&
              isSameLocalDay(log.completedAt, new Date()),
          ) ?? null
      }

      const current = open ?? closedToday

      const uniqueExerciseIds = [...new Set(currentEntries.map((entry) => entry.exerciseId))]
      const [savedSets, lastWeightList] = await Promise.all([
        current ? workoutLogRepository.listSets(current.id) : Promise.resolve([]),
        Promise.all(
          uniqueExerciseIds.map((exerciseId) =>
            workoutLogRepository.lastWeightFor(studentId, exerciseId),
          ),
        ),
      ])

      const lastWeights: Record<string, LastWeightEntry | null> = {}
      uniqueExerciseIds.forEach((exerciseId, index) => {
        lastWeights[exerciseId] = lastWeightList[index]
      })

      setSession(current)
      const built = buildExecutionGroups({
        entries: currentEntries,
        exerciseName: exerciseNameRef.current,
        savedSets,
        lastWeights,
      })
      rowsRef.current = new Map(
        built.flatMap((group) =>
          group.rows.map(
            (row) => [setKey(group.exerciseId, row.setIndex), { group, row }] as const,
          ),
        ),
      )
      setGroups(built)
      setStatus(open ? 'ready' : closedToday ? 'completed' : 'idle')
    },
    [],
  )

  useEffect(() => {
    if (!divisionKey || !ready) return
    if (authStatus === 'unauthenticated') {
      setStatus('error')
      setErrorMessage('Sessão expirada. Faça login novamente.')
      return
    }
    if (!userId) return

    let cancelled = false
    setStatus('loading')
    load(userId, divisionKey, null).catch((error: unknown) => {
      if (cancelled) return
      setStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível carregar o seu treino.',
      )
    })

    return () => {
      cancelled = true
    }
  }, [userId, authStatus, divisionKey, entriesSignature, ready, load])

  // Timers pendentes morrem com a tela; sem isso um setState depois do unmount vira warning e,
  // pior, a última tecla digitada nunca chega ao banco sem aviso nenhum.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
      clearTimeout(savedBadgeRef.current)
    }
  }, [])

  const flagSaved = useCallback(() => {
    setSaveStatus('saved')
    clearTimeout(savedBadgeRef.current)
    savedBadgeRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_BADGE_MS)
  }, [])

  const persist = useCallback(
    async (exerciseId: string, setIndex: number) => {
      const log = sessionRef.current
      if (!log || !userId) return

      const entry = rowsRef.current.get(setKey(exerciseId, setIndex))
      if (!entry) return

      setSaveStatus('saving')
      try {
        await workoutLogRepository.upsertSet(
          toSetDraft({
            workoutLogId: log.id,
            studentId: userId,
            exerciseId: entry.group.exerciseId,
            exerciseName: entry.group.exerciseName,
            row: entry.row,
          }),
        )
        flagSaved()
      } catch (error: unknown) {
        setSaveStatus('error')
        setErrorMessage(
          error instanceof Error ? error.message : 'Não foi possível salvar esta série.',
        )
      }
    },
    [userId, flagSaved],
  )

  const updateRow = useCallback(
    (exerciseId: string, setIndex: number, patch: Partial<ExecutionSetRow>) => {
      const key = setKey(exerciseId, setIndex)
      const current = rowsRef.current.get(key)
      if (!current) return

      const nextRow = { ...current.row, ...patch }
      rowsRef.current.set(key, { group: current.group, row: nextRow })

      setGroups((groupsState) =>
        groupsState.map((group) =>
          group.exerciseId === exerciseId
            ? {
                ...group,
                rows: group.rows.map((row) => (row.setIndex === setIndex ? nextRow : row)),
              }
            : group,
        ),
      )

      const pending = timersRef.current.get(key)
      if (pending) {
        clearTimeout(pending)
        timersRef.current.delete(key)
      }

      // O check é gesto deliberado: grava na hora, sem esperar os 400ms. Os campos numéricos
      // esperam a pausa na digitação. Em ambos os casos o payload sai de `rowsRef`, já atualizado
      // acima de forma síncrona.
      if (patch.done !== undefined) {
        void persist(exerciseId, setIndex)
        return
      }

      const timer = setTimeout(() => {
        timersRef.current.delete(key)
        void persist(exerciseId, setIndex)
      }, SAVE_DEBOUNCE_MS)
      timersRef.current.set(key, timer)
    },
    [persist],
  )

  const start = useCallback(async () => {
    if (!userId || !divisionKey) return
    setStatus('loading')
    try {
      const log = await workoutLogRepository.startSession(userId, planId, divisionKey)
      await load(userId, divisionKey, log)
    } catch (error: unknown) {
      setStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível iniciar o treino agora.',
      )
    }
  }, [userId, planId, divisionKey, load])

  /**
   * Fecha a sessão.
   *
   * Antes de gravar `completed_at`, descarrega os timers de debounce pendentes: a última carga que
   * o aluno digitou pode estar dentro da janela de 400ms, e fechar o treino sem esperá-la perderia
   * a série e mostraria um volume menor do que ele levantou. Depois do fechamento a tela fica em
   * `completed` — não há "reabrir", porque `startSession` abriria uma SEGUNDA sessão da mesma
   * divisão no mesmo dia.
   */
  const complete = useCallback(async () => {
    const log = sessionRef.current
    if (!log || !userId) return

    const pending = [...timersRef.current.entries()]
    timersRef.current.clear()
    await Promise.all(
      pending.map(([key, timer]) => {
        clearTimeout(timer)
        const [exerciseId, setIndex] = key.split('#')
        return persist(exerciseId, Number(setIndex))
      }),
    )

    setStatus('loading')
    try {
      const closed = await workoutLogRepository.completeSession(log.id)
      sessionRef.current = closed
      setSession(closed)
      setStatus('completed')
    } catch (error: unknown) {
      setStatus('ready')
      setSaveStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível concluir o treino agora.',
      )
    }
  }, [userId, persist])

  const progress = useMemo(() => countDone(groups), [groups])
  const summary = useMemo(
    () =>
      summarizeSession({
        groups,
        startedAt: session?.startedAt ?? null,
        completedAt: session?.completedAt ?? null,
      }),
    [groups, session],
  )

  return {
    status,
    saveStatus,
    errorMessage,
    session,
    groups,
    progress,
    summary,
    start,
    complete,
    updateRow,
  }
}
