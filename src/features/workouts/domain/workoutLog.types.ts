/**
 * Execução do treino — o espelho do que `workout.types.ts` prescreve.
 *
 * `WorkoutPlan` é o que o personal MANDA fazer; `WorkoutLog` é o que o aluno FEZ. São modelos
 * separados de propósito: a ficha é editada, republicada e às vezes apagada, e o histórico de
 * carga tem de sobreviver a isso (ver a migration `20261007130000_workout_execution_logs.sql`).
 * Por isso o log guarda CÓPIAS de texto (`divisionKey`, `exerciseId`, `exerciseName`) em vez de
 * referências à prescrição ou ao catálogo.
 */

/** Uma sessão de treino: o aluno abriu a divisão A hoje e registrou as séries. */
export interface WorkoutLog {
  id: string
  studentId: string
  /**
   * Ficha que originou a sessão, só para rastreio. `null` quando a ficha foi apagada depois
   * (`on delete set null`) ou quando o treino foi registrado sem prescrição.
   */
  workoutPlanId: string | null
  /**
   * A letra da divisão (`'A'`–`'E'`) copiada da ficha no momento do treino. É texto, e não
   * `WorkoutDivisionId`, porque o log precisa continuar legível se a divisão for renomeada ou
   * sair da prescrição.
   */
  divisionKey: string
  startedAt: string
  /** `null` = sessão em andamento. É este campo que define `workoutLogStatus`. */
  completedAt: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

/** Uma série executada dentro de uma sessão. */
export interface SetLog {
  id: string
  workoutLogId: string
  /**
   * Dono da série. Vem denormalizado da sessão (decisão da F10-1: o histórico de carga é uma
   * única varredura de índice em `(student_id, exercise_id, completed_at desc)`). Uma FK composta
   * `(workout_log_id, student_id)` garante que ele nunca divirja do dono da sessão.
   */
  studentId: string
  /** Id no catálogo estático (`public/data/exercises.json`), ex.: `"0025"`. É texto, nunca FK. */
  exerciseId: string
  /** Rótulo do exercício no dia do treino — o catálogo pode renomeá-lo depois. */
  exerciseName: string
  /** 1-based: a primeira série do exercício é `1`. */
  setIndex: number
  reps: number | null
  weightKg: number | null
  /** Percepção de esforço, 1–10. `null` quando o aluno não informou. */
  rpe: number | null
  /** `true` = o aluno marcou a série como feita. */
  done: boolean
  /** Quando a série foi marcada como feita. `null` enquanto `done` é `false`. */
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * O que a tela manda ao gravar uma série. Sem os campos que o banco preenche (`id`, timestamps):
 * a identidade da série é `(workoutLogId, exerciseId, setIndex)`, então o mesmo rascunho enviado
 * duas vezes atualiza a mesma linha em vez de criar outra.
 */
export interface SetLogDraft {
  workoutLogId: string
  studentId: string
  exerciseId: string
  exerciseName: string
  setIndex: number
  reps?: number | null
  weightKg?: number | null
  rpe?: number | null
  done?: boolean
}

/** Estado da sessão. Derivado de `completedAt` — não existe coluna de status no banco. */
export type WorkoutLogStatus = 'in_progress' | 'completed'

/**
 * Estado de uma sessão. Mantido como função (e não campo) para que não haja duas fontes de
 * verdade: o banco só tem `completed_at`, e uma sessão em andamento é exatamente
 * `completed_at is null`.
 */
export function workoutLogStatus(log: Pick<WorkoutLog, 'completedAt'>): WorkoutLogStatus {
  return log.completedAt === null ? 'in_progress' : 'completed'
}

/** Açúcar de leitura para as telas; mesma regra de `workoutLogStatus`. */
export function isSessionInProgress(log: Pick<WorkoutLog, 'completedAt'>): boolean {
  return workoutLogStatus(log) === 'in_progress'
}

/**
 * Janela de consulta do histórico. Datas em ISO-8601, comparadas contra `startedAt` (quando o
 * aluno treinou), não contra `createdAt`. Todos os campos são opcionais: `{}` traz as sessões mais
 * recentes até o limite padrão.
 */
export interface SessionRange {
  /** Início da janela, inclusive. */
  from?: string
  /** Fim da janela, inclusive. */
  to?: string
  /** Teto de linhas; o repositório aplica um padrão quando omitido. */
  limit?: number
}

/**
 * Última carga registrada pelo aluno num exercício — o número que o executor mostra como
 * referência ("na última vez: 60 kg x 10"). `null` no repositório quando ele nunca completou
 * uma série desse exercício.
 */
export interface LastWeightEntry {
  weightKg: number | null
  reps: number | null
  /** Nunca `null`: só séries concluídas entram no histórico de carga. */
  completedAt: string
}
