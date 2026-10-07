import { useCallback, useEffect, useRef, useState } from 'react'
import { studentRepository } from '@/features/students/repositories/studentRepository'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import { createWorkoutPlan } from '../domain/createWorkoutPlan'
import { indexedDbWorkoutPlanRepository } from '../repositories/indexedDbWorkoutPlanRepository'
import { workoutPlanRepository } from '../repositories/workoutPlanRepository'
import type { WorkoutPlan } from '../domain/workout.types'

type LoadState = 'loading' | 'error' | 'ready'

interface UseWorkoutPlanDraftResult {
  plan: WorkoutPlan | null
  loadState: LoadState
  /** Atualiza em memória; use `save`/`publish` para persistir. */
  updatePlan: (patch: Partial<WorkoutPlan>) => void
  /** Grava o rascunho — o aluno ainda não vê. */
  save: () => Promise<void>
  /** Grava e publica: a partir daqui o aluno vê esta versão da ficha. */
  publish: () => Promise<void>
  saving: boolean
  savedAt: string | null
  /** Quando a versão que o aluno vê foi publicada; `null` = nunca publicada. */
  publishedAt: string | null
  /** `true` quando a ficha na tela difere da que o aluno vê (ou nada foi publicado ainda). */
  hasUnpublishedChanges: boolean
  /** Mensagem da última falha ao salvar/publicar; `null` quando a última gravação deu certo. */
  saveError: string | null
}

/** Compara só o que o aluno enxerga — datas e ids diferem entre rascunho e publicada. */
function sameContent(a: WorkoutPlan, b: WorkoutPlan): boolean {
  const content = (plan: WorkoutPlan) =>
    JSON.stringify([plan.objective, plan.weeklyFrequency, plan.notes, plan.divisions])
  return content(a) === content(b)
}

/**
 * Carrega o rascunho da ficha do aluno no Supabase (ou cria um novo em memória) e o persiste sob
 * demanda. Salvar e publicar são explícitos: montar treino é uma edição longa, e o aluno só vê a
 * ficha quando o personal clicar em "Publicar para o aluno".
 *
 * Fichas montadas antes da ida para o Supabase ficaram no IndexedDB do navegador do personal. Se o
 * banco ainda não tem rascunho para o aluno, a ficha local entra como ponto de partida — na
 * primeira gravação ela vai para o banco e passa a valer em qualquer aparelho.
 */
export function useWorkoutPlanDraft(studentId: string): UseWorkoutPlanDraftResult {
  const { userId: trainerId } = useAuthUser()
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [published, setPublished] = useState<WorkoutPlan | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const planRef = useRef<WorkoutPlan | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    // Sem sessão ainda não dá para saber quem é o autor (a RLS exige trainer_id = auth.uid()).
    if (!studentId || !trainerId) return

    async function carregar(): Promise<void> {
      const aluno = await studentRepository.findById(studentId)
      if (!aluno) throw new Error(`Aluno ${studentId} não encontrado.`)

      const salvas = await workoutPlanRepository.findForTrainer(studentId, aluno.name)
      const local = salvas.draft
        ? undefined
        : (await indexedDbWorkoutPlanRepository.findByStudentId(studentId).catch(() => []))[0]
      const atual =
        salvas.draft ??
        (local ? { ...local, studentName: aluno.name } : createWorkoutPlan(studentId, aluno.name))

      if (cancelled) return
      planRef.current = atual
      setPlan(atual)
      setSavedAt(salvas.draft ? salvas.draft.updatedAt : null)
      setPublished(salvas.published)
      setLoadState('ready')
    }

    carregar().catch(() => {
      if (!cancelled) setLoadState('error')
    })

    return () => {
      cancelled = true
    }
  }, [studentId, trainerId])

  const updatePlan = useCallback((patch: Partial<WorkoutPlan>) => {
    const atual = planRef.current
    if (!atual) return
    const atualizado: WorkoutPlan = { ...atual, ...patch }
    planRef.current = atualizado
    setPlan(atualizado)
  }, [])

  const persistir = useCallback(
    async (modo: 'draft' | 'publish') => {
      const atual = planRef.current
      if (!atual || !trainerId) return
      setSaving(true)
      setSaveError(null)
      try {
        const salvo =
          modo === 'publish'
            ? await workoutPlanRepository.publish(atual, trainerId)
            : await workoutPlanRepository.saveDraft(atual, trainerId)
        // Só adota o retorno se nada mudou na tela enquanto a gravação estava em voo — senão a
        // resposta sobrescreveria uma edição mais nova.
        if (planRef.current === atual) {
          planRef.current = salvo
          setPlan(salvo)
        }
        setSavedAt(salvo.updatedAt)
        if (modo === 'publish') setPublished(salvo)
      } catch (erro: unknown) {
        // Sem este catch a rejeição virava unhandled: o professor clicava em salvar,
        // nada acontecia na tela, e a ficha se perdia ao sair da página.
        const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido ao salvar.'
        console.error('Falha ao salvar a ficha de treino:', erro)
        setSaveError(mensagem)
      } finally {
        setSaving(false)
      }
    },
    [trainerId],
  )

  const save = useCallback(() => persistir('draft'), [persistir])
  const publish = useCallback(() => persistir('publish'), [persistir])

  return {
    plan,
    loadState,
    updatePlan,
    save,
    publish,
    saving,
    savedAt,
    publishedAt: published?.publishedAt ?? null,
    hasUnpublishedChanges: plan !== null && (published === null || !sameContent(plan, published)),
    saveError,
  }
}
