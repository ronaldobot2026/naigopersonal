/** Prescrição de um exercício dentro de uma sessão de treino. */
export interface WorkoutExerciseEntry {
  /** Id no catálogo de exercícios (`public/data/exercises.json`), ex.: "0025". */
  exerciseId: string
  sets: number
  reps: string
  loadKg?: number
  /** Repetições em reserva (0 = falha). */
  rir?: number | null
  /** Intervalo entre séries, em segundos. */
  restSeconds?: number | null
  /** Tempo de execução — cadência ("3-1-2") ou duração ("30s"). Só quando o exercício pede. */
  tempo?: string
  /** Observações do professor para este exercício. */
  notes?: string
}

export interface WorkoutSession {
  id: string
  name: string
  focusTag: string
  durationMinutes: number
  progressPercent: number
  exercises: WorkoutExerciseEntry[]
}

/** Divisões da ficha. A ordem aqui é a ordem exibida. */
export const WORKOUT_DIVISION_IDS = ['A', 'B', 'C', 'D', 'E'] as const

export type WorkoutDivisionId = (typeof WORKOUT_DIVISION_IDS)[number]

export interface WorkoutDivision {
  id: WorkoutDivisionId
  /** Foco da divisão, definido pelo professor. Ex.: "Superior", "Membros inferiores". */
  label: string
  entries: WorkoutExerciseEntry[]
}

/** Ficha de treinamento de um aluno, montada pelo personal. */
export interface WorkoutPlan {
  id: string
  studentId: string
  /** Nome do aluno no momento em que a ficha foi montada (evita depender do lookup para exibir). */
  studentName: string
  objective: string
  /** Quantos dias por semana. `null` enquanto o professor não preencheu. */
  weeklyFrequency: number | null
  notes: string
  divisions: WorkoutDivision[]
  createdAt: string
  updatedAt: string
}
