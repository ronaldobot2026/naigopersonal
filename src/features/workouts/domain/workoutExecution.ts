/**
 * Estado da TELA de execução — a ponte entre a prescrição (`workout.types.ts`) e o log
 * (`workoutLog.types.ts`).
 *
 * Tudo aqui é função pura: o hook (`useWorkoutExecution`) cuida de rede e debounce, e esta camada
 * decide só o que aparece em cada campo. É onde vive a ordem de precedência do pré-preenchimento,
 * que é a regra mais fácil de quebrar sem perceber (o aluno digita 42 kg, troca de aba, volta e vê
 * o prescrito de novo).
 */

import type { LastWeightEntry, SetLog, SetLogDraft } from './workoutLog.types'
import type { WorkoutExerciseEntry } from './workout.types'

/** De onde veio o valor que está no campo — usado nos testes e na dica abaixo do campo. */
export type SetFieldSource = 'logged' | 'lastWeight' | 'prescribed' | 'empty'

/**
 * Uma linha de série na tela. `reps`/`weightKg` são STRING porque são campos controlados: um
 * `number` obrigaria a transformar `''` em `0` no meio da digitação, e o aluno que apaga a carga
 * para corrigir veria um 0 aparecer sozinho.
 */
export interface ExecutionSetRow {
  setIndex: number
  reps: string
  weightKg: string
  done: boolean
  /** Procedência do par (reps, carga) como foi montado — não muda quando o aluno digita. */
  source: SetFieldSource
}

/** Um exercício da divisão com suas séries prontas para execução. */
export interface ExecutionExerciseGroup {
  exerciseId: string
  exerciseName: string
  /** A prescrição do personal, para exibir ao lado do que o aluno está fazendo. */
  prescription: WorkoutExerciseEntry
  /** Última vez que o aluno concluiu este exercício; `null` quando é a primeira. */
  lastWeight: LastWeightEntry | null
  rows: ExecutionSetRow[]
}

/** Identidade da série na tela — a mesma chave do índice único de `set_logs`. */
export function setKey(exerciseId: string, setIndex: number): string {
  return `${exerciseId}#${setIndex}`
}

/**
 * Primeiro número de uma prescrição de repetições. O personal escreve `"10"`, `"8-12"`,
 * `"12 a 15"` ou `"até a falha"` — o campo numérico do aluno só aceita um número, e começar pela
 * borda de baixo da faixa é o que ele vai de fato tentar.
 */
export function prescribedReps(reps: string): string {
  const match = /\d+/.exec(reps ?? '')
  return match ? match[0] : ''
}

/** Número do banco para campo de texto; `null`/`undefined` viram campo vazio, nunca `'0'`. */
export function toField(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

/** Campo de texto para número do banco; vazio (ou lixo) vira `null`, não `0`. */
export function toNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function rowFromSaved(saved: SetLog): ExecutionSetRow {
  return {
    setIndex: saved.setIndex,
    reps: toField(saved.reps),
    weightKg: toField(saved.weightKg),
    done: saved.done,
    source: 'logged',
  }
}

function rowFromReference(
  setIndex: number,
  prescription: WorkoutExerciseEntry,
  lastWeight: LastWeightEntry | null,
): ExecutionSetRow {
  const prescribedWeight = toField(prescription.loadKg)
  const lastWeightField = toField(lastWeight?.weightKg)

  // Carga: a última usada ganha do prescrito porque é a que o aluno levantou de verdade (o
  // prescrito frequentemente vem em branco ou desatualizado). Repetições: o prescrito ganha,
  // porque é a ordem do treino de hoje; a reps da última vez só entra se não houver prescrição.
  const weightKg = lastWeightField || prescribedWeight
  const reps = prescribedReps(prescription.reps) || toField(lastWeight?.reps)

  const source: SetFieldSource =
    lastWeightField !== ''
      ? 'lastWeight'
      : reps !== '' || prescribedWeight !== ''
        ? 'prescribed'
        : 'empty'

  return { setIndex, reps, weightKg, done: false, source }
}

interface BuildGroupsInput {
  entries: WorkoutExerciseEntry[]
  /** Rótulo do exercício no catálogo; o fallback é o próprio id, nunca string vazia. */
  exerciseName: (exerciseId: string) => string
  /** O que já está gravado nesta sessão (`listSets`). */
  savedSets: SetLog[]
  /** Última carga por exercício (`lastWeightFor`); exercício ausente = primeira vez. */
  lastWeights: Record<string, LastWeightEntry | null>
}

/**
 * Monta a tela de execução da divisão.
 *
 * Precedência por série, na ordem que a F10-2 pediu no handoff: **série já registrada** >
 * **última carga usada** > **prescrito pelo personal**. É isso que faz o item 4 (retomar sessão)
 * não brigar com o item 3 (pré-preencher): recarregar a página devolve o que o aluno digitou, e
 * não a sugestão.
 *
 * Séries extras: se o aluno registrou mais séries do que o personal prescreveu (aconteceu, e o
 * banco aceita qualquer `set_index`), elas continuam aparecendo — a tela mostra o maior entre
 * `sets` prescrito e a última série registrada.
 */
export function buildExecutionGroups({
  entries,
  exerciseName,
  savedSets,
  lastWeights,
}: BuildGroupsInput): ExecutionExerciseGroup[] {
  const savedByKey = new Map(savedSets.map((set) => [setKey(set.exerciseId, set.setIndex), set]))

  return entries.map((entry) => {
    const lastWeight = lastWeights[entry.exerciseId] ?? null
    const savedForExercise = savedSets.filter((set) => set.exerciseId === entry.exerciseId)
    const highestSavedIndex = savedForExercise.reduce((max, set) => Math.max(max, set.setIndex), 0)
    const totalSets = Math.max(entry.sets, highestSavedIndex)

    const rows = Array.from({ length: totalSets }, (_, index) => {
      const setIndex = index + 1
      const saved = savedByKey.get(setKey(entry.exerciseId, setIndex))
      return saved ? rowFromSaved(saved) : rowFromReference(setIndex, entry, lastWeight)
    })

    return {
      exerciseId: entry.exerciseId,
      exerciseName: exerciseName(entry.exerciseId) || entry.exerciseId,
      prescription: entry,
      lastWeight,
      rows,
    }
  })
}

/** Rascunho de gravação a partir de uma linha da tela. */
export function toSetDraft(input: {
  workoutLogId: string
  studentId: string
  exerciseId: string
  exerciseName: string
  row: ExecutionSetRow
}): SetLogDraft {
  return {
    workoutLogId: input.workoutLogId,
    studentId: input.studentId,
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    setIndex: input.row.setIndex,
    reps: toNumber(input.row.reps),
    weightKg: toNumber(input.row.weightKg),
    done: input.row.done,
  }
}

/** Quantas séries estão marcadas como feitas / quantas existem — o progresso no topo da tela. */
export function countDone(groups: ExecutionExerciseGroup[]): { done: number; total: number } {
  return groups.reduce(
    (acc, group) => ({
      done: acc.done + group.rows.filter((row) => row.done).length,
      total: acc.total + group.rows.length,
    }),
    { done: 0, total: 0 },
  )
}

/**
 * Volume total em kg: soma de `reps × carga` das séries MARCADAS COMO FEITAS.
 *
 * Série não marcada fica fora — o campo pode ter a sugestão de pré-preenchimento que o aluno nem
 * tentou, e somá-la daria um volume que ele não levantou. Série feita sem carga (peso corporal,
 * elástico) contribui 0 em vez de inflar o número com um peso imaginário.
 */
export function totalVolumeKg(groups: ExecutionExerciseGroup[]): number {
  const total = groups.reduce(
    (sum, group) =>
      sum +
      group.rows.reduce((groupSum, row) => {
        if (!row.done) return groupSum
        const reps = toNumber(row.reps) ?? 0
        const weight = toNumber(row.weightKg) ?? 0
        return groupSum + reps * weight
      }, 0),
    0,
  )
  // Arredonda a 1 casa: 2,5kg × 9 reps gera dízima em float e "112,49999999999999 kg" na tela.
  return Math.round(total * 10) / 10
}

/**
 * Resumo honesto da sessão, do jeito que ele é mostrado depois de concluir o treino.
 *
 * `durationMinutes` é a duração REAL medida de `started_at` a `completed_at` (não a estimativa de
 * `estimateDurationMinutes`), e é `null` enquanto a sessão não foi fechada — não existe duração de
 * um treino que não terminou.
 */
export interface SessionSummary {
  setsDone: number
  setsPrescribed: number
  volumeKg: number
  durationMinutes: number | null
}

export function summarizeSession(input: {
  groups: ExecutionExerciseGroup[]
  startedAt: string | null
  completedAt: string | null
}): SessionSummary {
  const { done, total } = countDone(input.groups)
  const hasRange = input.startedAt !== null && input.completedAt !== null
  const elapsedMs = hasRange
    ? new Date(input.completedAt as string).getTime() - new Date(input.startedAt as string).getTime()
    : 0

  return {
    setsDone: done,
    setsPrescribed: total,
    volumeKg: totalVolumeKg(input.groups),
    // Piso em 0 e arredondamento para baixo: um treino de 40s é "menos de 1 minuto" na tela, não
    // "1 minuto" arredondado para cima.
    durationMinutes: hasRange ? Math.max(0, Math.floor(elapsedMs / 60000)) : null,
  }
}
