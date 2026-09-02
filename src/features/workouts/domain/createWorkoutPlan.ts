import {
  WORKOUT_DIVISION_IDS,
  type WorkoutDivision,
  type WorkoutExerciseEntry,
  type WorkoutPlan,
} from './workout.types'

/** Só a divisão A nasce na ficha; as outras o professor adiciona conforme precisar. */
export function createEmptyDivision(id: WorkoutDivision['id']): WorkoutDivision {
  return { id, label: '', entries: [] }
}

export function createWorkoutPlan(studentId: string, studentName: string): WorkoutPlan {
  const agora = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    studentId,
    studentName,
    objective: '',
    weeklyFrequency: null,
    notes: '',
    divisions: [createEmptyDivision('A')],
    createdAt: agora,
    updatedAt: agora,
  }
}

/** Próxima divisão livre (A→E), ou `null` quando as cinco já existem. */
export function nextDivisionId(plan: WorkoutPlan): WorkoutDivision['id'] | null {
  const usadas = new Set(plan.divisions.map((division) => division.id))
  return WORKOUT_DIVISION_IDS.find((id) => !usadas.has(id)) ?? null
}

export function createEntry(exerciseId: string): WorkoutExerciseEntry {
  return { exerciseId, sets: 3, reps: '10-12', rir: null, restSeconds: 60 }
}

/** Move um exercício dentro da divisão. Fora dos limites, devolve a lista intacta. */
export function moveEntry(
  entries: WorkoutExerciseEntry[],
  from: number,
  to: number,
): WorkoutExerciseEntry[] {
  if (from === to || from < 0 || to < 0 || from >= entries.length || to >= entries.length) {
    return entries
  }
  const copia = [...entries]
  const [movido] = copia.splice(from, 1)
  copia.splice(to, 0, movido)
  return copia
}

/** Duplica o exercício logo abaixo do original, preservando a prescrição. */
export function duplicateEntry(
  entries: WorkoutExerciseEntry[],
  index: number,
): WorkoutExerciseEntry[] {
  const alvo = entries[index]
  if (!alvo) return entries
  const copia = [...entries]
  copia.splice(index + 1, 0, { ...alvo })
  return copia
}
