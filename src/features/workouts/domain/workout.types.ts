/** Prescrição de um exercício dentro de uma sessão de treino. */
export interface WorkoutExerciseEntry {
  /** Id no catálogo de exercícios (`public/data/exercises.json`), ex.: "0025". */
  exerciseId: string
  sets: number
  reps: string
  loadKg?: number
}

export interface WorkoutSession {
  id: string
  name: string
  focusTag: string
  durationMinutes: number
  progressPercent: number
  exercises: WorkoutExerciseEntry[]
}
