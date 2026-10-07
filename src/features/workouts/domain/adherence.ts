/**
 * Aderência vista pelo PERSONAL — o que o aluno treinou de verdade, quando e com que carga.
 *
 * É o espelho invertido de `trainingDay.ts`: lá o aluno olha o próprio dia, aqui o personal olha
 * o histórico do aluno para decidir a próxima prescrição. As duas telas leem as MESMAS sessões
 * (`workout_logs` + `set_logs`), e a semana é contada pela mesma função (`summarizeWeek`) para
 * que personal e aluno nunca vejam números diferentes da mesma semana.
 *
 * Tudo aqui é função pura sobre listas já carregadas, e toda pergunta sem resposta tem resposta
 * vazia EXPLÍCITA: `setsPrescribed` é `null` quando a divisão saiu da ficha (em vez de 0, que
 * leria como "nada prescrito"), e a comparação de carga é `unknown` quando não há prescrição de
 * carga para comparar. Nada nesta camada escreve: pela RLS da F10-1 o personal só tem `select` em
 * `workout_logs`/`set_logs`.
 */

import type { WorkoutDivision, WorkoutExerciseEntry } from './workout.types'
import { isSessionInProgress, type SetLog, type WorkoutLog } from './workoutLog.types'

/** Uma sessão do aluno como o personal a vê na lista de aderência. */
export interface AdherenceSession {
  logId: string
  /** Letra da divisão gravada no log (texto, não `WorkoutDivisionId` — ver `workoutLog.types`). */
  divisionKey: string
  /** Foco da divisão na ficha ATUAL; `null` quando ela não está mais na ficha. */
  divisionLabel: string | null
  startedAt: string
  /** `null` = sessão ainda aberta. */
  completedAt: string | null
  inProgress: boolean
  /** Séries que o aluno marcou como feitas. */
  setsDone: number
  /** Séries registradas na sessão, feitas ou não — o que ele chegou a tocar. */
  setsLogged: number
  /**
   * Séries prescritas na divisão, lidas da ficha publicada atual. `null` quando a divisão não
   * existe mais nela: não dá para dizer "3 de 0" nem inventar o prescrito da época.
   */
  setsPrescribed: number | null
  /** Soma `reps × carga` das séries FEITAS. Série feita sem carga vale 0, nunca peso imaginário. */
  volumeKg: number
  /** Medida de `startedAt` a `completedAt`; `null` enquanto a sessão não fechou. */
  durationMinutes: number | null
}

/** Soma `reps × carga` das séries marcadas como feitas, arredondada a 1 casa (dízima de float). */
export function volumeFromSets(sets: SetLog[]): number {
  const total = sets.reduce(
    (sum, set) => (set.done ? sum + (set.reps ?? 0) * (set.weightKg ?? 0) : sum),
    0,
  )
  return Math.round(total * 10) / 10
}

/** Duração real da sessão em minutos; `null` com a sessão aberta, `0` para menos de um minuto. */
export function sessionDurationMinutes(log: Pick<WorkoutLog, 'startedAt' | 'completedAt'>) {
  if (log.completedAt === null) return null
  const elapsed = new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()
  if (!Number.isFinite(elapsed)) return null
  return Math.max(0, Math.floor(elapsed / 60000))
}

/** Séries prescritas numa divisão — a soma de `sets` dos exercícios dela. */
export function prescribedSetsFor(entries: WorkoutExerciseEntry[]): number {
  return entries.reduce((total, entry) => total + entry.sets, 0)
}

/**
 * As sessões do aluno, da mais recente para a mais antiga, com o que ele fez em cada uma.
 *
 * A ordem vem do `startedAt` (quando treinou) e não do `completedAt`: a sessão aberta tem de
 * aparecer no topo, e ela não tem conclusão.
 */
export function buildAdherenceSessions(input: {
  logs: WorkoutLog[]
  /** Séries de TODAS as sessões da lista (uma consulta só; ver `listSetsForSessions`). */
  sets: SetLog[]
  /** Divisões da ficha publicada atual. Vazio = sem ficha; aí o prescrito é `null`. */
  divisions: WorkoutDivision[]
}): AdherenceSession[] {
  const byDivision = new Map(input.divisions.map((division) => [division.id as string, division]))
  const setsByLog = new Map<string, SetLog[]>()
  for (const set of input.sets) {
    const current = setsByLog.get(set.workoutLogId)
    if (current) current.push(set)
    else setsByLog.set(set.workoutLogId, [set])
  }

  return [...input.logs]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((log) => {
      const sets = setsByLog.get(log.id) ?? []
      const division = byDivision.get(log.divisionKey) ?? null

      return {
        logId: log.id,
        divisionKey: log.divisionKey,
        divisionLabel: division ? division.label.trim() || null : null,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        inProgress: isSessionInProgress(log),
        setsDone: sets.filter((set) => set.done).length,
        setsLogged: sets.length,
        setsPrescribed: division ? prescribedSetsFor(division.entries) : null,
        volumeKg: volumeFromSets(sets),
        durationMinutes: sessionDurationMinutes(log),
      }
    })
}

/**
 * Duração em texto. `null` (sessão aberta) vira `'em andamento'`, e `0` vira `'menos de 1 min'` —
 * arredondar 40 segundos para "1 min" seria um número que não aconteceu.
 */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'em andamento'
  if (minutes === 0) return 'menos de 1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`
}

/** Como a carga usada ficou em relação à prescrita. `unknown` = não há o que comparar. */
export type LoadComparison = 'below' | 'match' | 'above' | 'unknown'

/**
 * Compara a carga usada com a prescrita.
 *
 * `unknown` cobre os dois silêncios honestos: o personal não prescreveu carga (muito comum —
 * peso corporal, elástico, "o que der") ou o aluno não registrou a dele. Nenhum dos dois é
 * "abaixo do prescrito", e tratar como abaixo encheria a tela de alertas falsos.
 */
export function compareLoad(
  usedKg: number | null,
  prescribedKg: number | null | undefined,
): LoadComparison {
  if (usedKg === null || prescribedKg === null || prescribedKg === undefined) return 'unknown'
  if (usedKg < prescribedKg) return 'below'
  if (usedKg > prescribedKg) return 'above'
  return 'match'
}

/** Uma série da sessão, como o personal a lê: o que foi feito ao lado do que foi pedido. */
export interface AdherenceSetRow {
  setIndex: number
  reps: number | null
  weightKg: number | null
  done: boolean
  comparison: LoadComparison
}

/** Um exercício dentro do detalhe da sessão. */
export interface AdherenceExerciseDetail {
  exerciseId: string
  /** Rótulo: o do log (nome do dia do treino) quando houver série; senão o do catálogo. */
  exerciseName: string
  /** Prescrição na ficha atual; `null` quando o exercício não está mais nela. */
  prescription: WorkoutExerciseEntry | null
  /** Séries registradas, em ordem. Vazio = exercício prescrito que o aluno não tocou. */
  rows: AdherenceSetRow[]
}

/**
 * Detalhe de uma sessão: série por série, o que o aluno fez contra o que foi prescrito.
 *
 * Ordem: primeiro os exercícios da ficha (a ordem em que o personal os pediu), depois os que o
 * aluno registrou e não estão mais na prescrição — o personal republicou a ficha, e esconder essas
 * séries apagaria trabalho que o aluno fez.
 *
 * Exercício prescrito sem nenhuma série registrada entra com `rows` vazio, de propósito: "não
 * registrado" é informação para quem prescreve, e omitir a linha faria a sessão parecer completa.
 */
export function buildSessionDetail(input: {
  sets: SetLog[]
  /** Exercícios da divisão na ficha publicada atual. Vazio = divisão fora da ficha. */
  entries: WorkoutExerciseEntry[]
  /** Nome do exercício no catálogo, para o que foi prescrito e não registrado. */
  exerciseName: (exerciseId: string) => string
}): AdherenceExerciseDetail[] {
  const byExercise = new Map<string, SetLog[]>()
  for (const set of input.sets) {
    const current = byExercise.get(set.exerciseId)
    if (current) current.push(set)
    else byExercise.set(set.exerciseId, [set])
  }

  const toRows = (sets: SetLog[], prescription: WorkoutExerciseEntry | null): AdherenceSetRow[] =>
    [...sets]
      .sort((a, b) => a.setIndex - b.setIndex)
      .map((set) => ({
        setIndex: set.setIndex,
        reps: set.reps,
        weightKg: set.weightKg,
        done: set.done,
        comparison: compareLoad(set.weightKg, prescription?.loadKg ?? null),
      }))

  const prescribed = input.entries.map((entry) => {
    const sets = byExercise.get(entry.exerciseId) ?? []
    return {
      exerciseId: entry.exerciseId,
      exerciseName: sets[0]?.exerciseName || input.exerciseName(entry.exerciseId) || entry.exerciseId,
      prescription: entry,
      rows: toRows(sets, entry),
    }
  })

  const prescribedIds = new Set(input.entries.map((entry) => entry.exerciseId))
  const extra = [...byExercise.entries()]
    .filter(([exerciseId]) => !prescribedIds.has(exerciseId))
    .map(([exerciseId, sets]) => ({
      exerciseId,
      exerciseName: sets[0]?.exerciseName || exerciseId,
      prescription: null,
      rows: toRows(sets, null),
    }))

  return [...prescribed, ...extra]
}
