import type { WorkoutExerciseEntry, WorkoutPlan, WorkoutSession } from './workout.types'

/** Tempo médio de execução de uma série, em segundos (sem contar o descanso). */
const SECONDS_PER_SET = 45
/** Descanso assumido quando o personal não preencheu o intervalo do exercício. */
const DEFAULT_REST_SECONDS = 60

/**
 * Duração estimada da sessão: cada série leva ~45s de execução mais o descanso prescrito
 * (60s quando vazio). Arredonda para cima em blocos de 5 min — é uma ordem de grandeza para o
 * aluno se planejar, não um cronômetro.
 */
export function estimateDurationMinutes(entries: WorkoutExerciseEntry[]): number {
  const seconds = entries.reduce(
    (total, entry) =>
      total + entry.sets * (SECONDS_PER_SET + (entry.restSeconds ?? DEFAULT_REST_SECONDS)),
    0,
  )
  if (seconds === 0) return 0
  return Math.ceil(seconds / 60 / 5) * 5
}

/**
 * Sessões que o aluno vê, derivadas da ficha publicada: uma por divisão com exercícios, na ordem
 * A–E da ficha. Divisões vazias não viram sessão — o aluno não abre um treino sem exercício.
 */
export function toStudentSessions(plan: WorkoutPlan): WorkoutSession[] {
  return plan.divisions
    .filter((division) => division.entries.length > 0)
    .map((division) => ({
      id: division.id,
      name: `Treino ${division.id}`,
      focusTag: division.label.trim(),
      durationMinutes: estimateDurationMinutes(division.entries),
      exercises: division.entries,
    }))
}
