import { getSupabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { DEFAULT_HISTORY_SESSIONS } from '../domain/workoutHistory'
import type {
  LastWeightEntry,
  SessionRange,
  SetLog,
  SetLogDraft,
  WorkoutLog,
} from '../domain/workoutLog.types'

type WorkoutLogRow = Database['public']['Tables']['workout_logs']['Row']
type SetLogRow = Database['public']['Tables']['set_logs']['Row']

/** Teto padrão de `listSessions` — histórico é tela de rolagem, não dump da tabela. */
const DEFAULT_SESSION_LIMIT = 50

/**
 * Folga de séries por sessão usada para converter "últimas N sessões" em teto de linhas em
 * `listExerciseSets`. Fichas de hipertrofia raramente passam de 5 séries por exercício; 8 dá
 * margem para a série extra que o aluno registra por conta.
 */
const MAX_SETS_PER_SESSION = 8

function toLog(row: WorkoutLogRow): WorkoutLog {
  return {
    id: row.id,
    studentId: row.student_id,
    workoutPlanId: row.workout_plan_id,
    divisionKey: row.division_key,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSet(row: SetLogRow): SetLog {
  return {
    id: row.id,
    workoutLogId: row.workout_log_id,
    studentId: row.student_id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    setIndex: row.set_index,
    reps: row.reps,
    weightKg: row.weight_kg,
    rpe: row.rpe,
    done: row.done,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Implementação de `findOpenSession` fora do objeto para que `startSession` a chame por nome e
 * não por `this`: a tela desestrutura o repositório (`const { startSession } = ...`) e um `this`
 * perdido viraria "não duplica sessão" falhando só em produção.
 */
async function findOpenSession(
  studentId: string,
  divisionKey?: string,
): Promise<WorkoutLog | null> {
  let query = getSupabase()
    .from('workout_logs')
    .select('*')
    .eq('student_id', studentId)
    .is('completed_at', null)

  if (divisionKey !== undefined) query = query.eq('division_key', divisionKey)

  const { data, error } = await query.order('started_at', { ascending: false }).limit(1)
  if (error) throw error

  const rows = (data ?? []) as WorkoutLogRow[]
  return rows.length > 0 ? toLog(rows[0]) : null
}

/**
 * Execução do treino no Supabase: a sessão (`workout_logs`) e cada série dentro dela
 * (`set_logs`).
 *
 * Quem escreve aqui é o ALUNO. A RLS da F10-1 dá ao personal apenas `select`
 * (`public.is_my_student`) — nenhuma policy de escrita —, então uma tela de personal que tentar
 * gravar execução vai tomar erro de RLS por desenho, não por bug.
 */
export const workoutLogRepository = {
  /**
   * A sessão em andamento do aluno (`completed_at is null`), ou `null`. Serve para a tela oferecer
   * "retomar treino" e para `startSession` não duplicar sessão.
   *
   * `divisionKey` restringe à divisão; sem ele devolve a sessão aberta mais recente de qualquer
   * divisão.
   */
  async findOpenSession(studentId: string, divisionKey?: string): Promise<WorkoutLog | null> {
    return findOpenSession(studentId, divisionKey)
  },

  /**
   * Abre a sessão da divisão — ou devolve a que já está aberta.
   *
   * O banco NÃO tem constraint impedindo duas sessões abertas (decisão da F10-1), então a
   * idempotência é responsabilidade deste método: ele busca a aberta antes de inserir. Sem isso,
   * recarregar a página do executor criaria uma sessão nova a cada F5 — o mesmo bug de "abrir
   * Nova avaliação cria rascunho".
   *
   * A identidade é `(studentId, divisionKey, completed_at is null)`: reabrir o treino A retoma a
   * sessão A aberta. Uma sessão aberta de OUTRA divisão não é reaproveitada nem fechada aqui —
   * fechá-la gravaria um `completed_at` que o aluno nunca pediu. A tela que quiser tratar a sessão
   * abandonada usa `findOpenSession(studentId)` sem divisão e decide com o aluno.
   */
  async startSession(
    studentId: string,
    planId: string | null,
    divisionKey: string,
  ): Promise<WorkoutLog> {
    const open = await findOpenSession(studentId, divisionKey)
    if (open) return open

    const { data, error } = await getSupabase()
      .from('workout_logs')
      .insert({
        student_id: studentId,
        workout_plan_id: planId,
        division_key: divisionKey,
      })
      .select('*')
      .single()
    if (error) throw error
    return toLog(data as WorkoutLogRow)
  },

  /**
   * Grava uma série, idempotente por `(workout_log_id, exercise_id, set_index)` — o índice único
   * `set_logs_log_exercise_set_key`. O executor salva a cada toque no campo de carga, então o
   * mesmo `setIndex` é reenviado muitas vezes e tem de continuar sendo UMA linha.
   *
   * `student_id` vai sempre no payload: é `not null`, é o que a RLS avalia e é a primeira coluna
   * do índice do histórico de carga.
   *
   * `completed_at` acompanha `done`: marcar a série feita datá-la (é o que `lastWeightFor` lê),
   * desmarcar limpa a data. Série não concluída fica fora do histórico de carga.
   */
  async upsertSet(draft: SetLogDraft): Promise<SetLog> {
    const now = new Date().toISOString()
    const done = draft.done ?? false

    const { data, error } = await getSupabase()
      .from('set_logs')
      .upsert(
        {
          workout_log_id: draft.workoutLogId,
          student_id: draft.studentId,
          exercise_id: draft.exerciseId,
          exercise_name: draft.exerciseName,
          set_index: draft.setIndex,
          reps: draft.reps ?? null,
          weight_kg: draft.weightKg ?? null,
          rpe: draft.rpe ?? null,
          done,
          completed_at: done ? now : null,
          updated_at: now,
        },
        { onConflict: 'workout_log_id,exercise_id,set_index' },
      )
      .select('*')
      .single()
    if (error) throw error
    return toSet(data as SetLogRow)
  },

  /** Séries já registradas numa sessão, na ordem de execução. É o que o executor recarrega. */
  async listSets(workoutLogId: string): Promise<SetLog[]> {
    const { data, error } = await getSupabase()
      .from('set_logs')
      .select('*')
      .eq('workout_log_id', workoutLogId)
      .order('exercise_id', { ascending: true })
      .order('set_index', { ascending: true })
    if (error) throw error
    return ((data ?? []) as SetLogRow[]).map(toSet)
  },

  /**
   * Fecha a sessão. `completed_at` deixa de ser `null`, e é só isso que distingue sessão
   * concluída de sessão em andamento (ver `workoutLogStatus`).
   */
  async completeSession(logId: string): Promise<WorkoutLog> {
    const now = new Date().toISOString()
    const { data, error } = await getSupabase()
      .from('workout_logs')
      .update({ completed_at: now, updated_at: now })
      .eq('id', logId)
      .select('*')
      .single()
    if (error) throw error
    return toLog(data as WorkoutLogRow)
  },

  /**
   * Última carga que este aluno completou neste exercício — a referência que o executor mostra
   * ("na última vez: 60 kg x 10"). `null` quando ele nunca concluiu uma série do exercício.
   *
   * A ordem dos filtros segue o índice `(student_id, exercise_id, completed_at desc)`.
   *
   * O `.not('completed_at', 'is', null)` não é decoração: em Postgres, `order by ... desc` é
   * `nulls first`, então sem esse filtro a série ainda EM ANDAMENTO (`completed_at is null`)
   * viria primeiro e a tela mostraria como "última carga" um campo que o aluno acabou de digitar
   * e ainda não concluiu.
   */
  async lastWeightFor(studentId: string, exerciseId: string): Promise<LastWeightEntry | null> {
    const { data, error } = await getSupabase()
      .from('set_logs')
      .select('weight_kg, reps, completed_at')
      .eq('student_id', studentId)
      .eq('exercise_id', exerciseId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
    if (error) throw error

    const rows = (data ?? []) as Pick<SetLogRow, 'weight_kg' | 'reps' | 'completed_at'>[]
    const row = rows[0]
    if (!row || row.completed_at === null) return null

    return { weightKg: row.weight_kg, reps: row.reps, completedAt: row.completed_at }
  },

  /**
   * Séries CONCLUÍDAS deste aluno neste exercício, da mais recente para a mais antiga — a matéria
   * bruta do painel de evolução de carga (`groupHistorySessions` agrupa por sessão).
   *
   * Mesma varredura de índice de `lastWeightFor` (`student_id, exercise_id, completed_at desc`),
   * só com um teto maior: é uma leitura a mais do MESMO índice, e não um `join` com
   * `workout_logs`. Por isso o histórico sobrevive à ficha apagada — nada aqui depende de
   * `workout_plans`, e `exercise_name` vem denormalizado na própria série.
   *
   * `maxSessions` é convertido em teto de LINHAS (`× MAX_SETS_PER_SESSION`): o filtro é por série,
   * não por sessão, então pedir 6 sessões exige folga de linhas. Quem agrupa corta o excedente.
   */
  async listExerciseSets(
    studentId: string,
    exerciseId: string,
    maxSessions: number = DEFAULT_HISTORY_SESSIONS,
  ): Promise<SetLog[]> {
    const { data, error } = await getSupabase()
      .from('set_logs')
      .select('*')
      .eq('student_id', studentId)
      .eq('exercise_id', exerciseId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(Math.max(1, maxSessions) * MAX_SETS_PER_SESSION)
    if (error) throw error
    return ((data ?? []) as SetLogRow[]).map(toSet)
  },

  /**
   * Sessões do aluno, da mais recente para a mais antiga (índice
   * `workout_logs_student_started_idx`). A janela filtra por `started_at` — quando o aluno
   * treinou —, não por `created_at`.
   */
  async listSessions(studentId: string, range: SessionRange = {}): Promise<WorkoutLog[]> {
    let query = getSupabase().from('workout_logs').select('*').eq('student_id', studentId)

    if (range.from !== undefined) query = query.gte('started_at', range.from)
    if (range.to !== undefined) query = query.lte('started_at', range.to)

    const { data, error } = await query
      .order('started_at', { ascending: false })
      .limit(range.limit ?? DEFAULT_SESSION_LIMIT)
    if (error) throw error
    return ((data ?? []) as WorkoutLogRow[]).map(toLog)
  },
}
