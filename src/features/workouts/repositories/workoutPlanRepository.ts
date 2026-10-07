import { getSupabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { WorkoutDivision, WorkoutPlan } from '../domain/workout.types'

/**
 * Formato da linha (snake_case), a partir de `database.types.ts`. `divisions` é `jsonb` e `status`
 * é `text` com `check` no Postgres, então o gerador devolve `Json`/`string`; a linha abaixo estreita
 * para o que a migration `20261007120000_workout_plans.sql` garante na prática — mesmo padrão de
 * `correctivePlanRepository.ts`. Nunca vaza para fora deste arquivo: só `WorkoutPlan` sai daqui.
 */
type WorkoutPlanRow = Omit<
  Database['public']['Tables']['workout_plans']['Row'],
  'divisions' | 'status'
> & {
  divisions: WorkoutDivision[]
  status: WorkoutPlanStatus
}

type WorkoutPlanStatus = 'draft' | 'published'

function toDomain(row: WorkoutPlanRow, studentName: string, publishedAt?: string): WorkoutPlan {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName,
    objective: row.objective,
    weeklyFrequency: row.weekly_frequency,
    notes: row.notes,
    divisions: row.divisions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: publishedAt ?? row.published_at ?? undefined,
  }
}

/** Sem `id`: o alvo do upsert é `(student_id, status)` e o uuid nasce no banco. */
function toPayload(plan: WorkoutPlan, trainerId: string, status: WorkoutPlanStatus, now: string) {
  return {
    student_id: plan.studentId,
    trainer_id: trainerId,
    status,
    objective: plan.objective,
    weekly_frequency: plan.weeklyFrequency,
    notes: plan.notes,
    // `WorkoutDivision[]` não tem index signature, então o TS não o vê como subtipo de `Json`
    // mesmo sendo serializável — mesmo cast de `correctivePlanRepository.ts`.
    divisions: plan.divisions as unknown as Json,
    updated_at: now,
    published_at: status === 'published' ? now : null,
  }
}

/** Fichas do personal para um aluno: o rascunho em edição e a versão que o aluno vê. */
export interface TrainerWorkoutPlans {
  draft: WorkoutPlan | null
  published: WorkoutPlan | null
}

/**
 * Ficha de treino no Supabase (substitui `indexedDbWorkoutPlanRepository`, que prendia a ficha ao
 * navegador do personal). Cada aluno tem no máximo duas linhas — `draft` e `published` — e a RLS
 * garante que o aluno só enxerga a publicada (ver migration).
 */
export const workoutPlanRepository = {
  async findForTrainer(studentId: string, studentName: string): Promise<TrainerWorkoutPlans> {
    const { data, error } = await getSupabase()
      .from('workout_plans')
      .select('*')
      .eq('student_id', studentId)
    if (error) throw error

    const rows = (data ?? []) as unknown as WorkoutPlanRow[]
    const publishedRow = rows.find((row) => row.status === 'published')
    const draftRow = rows.find((row) => row.status === 'draft')
    const publishedAt = publishedRow?.published_at ?? undefined

    return {
      draft: draftRow ? toDomain(draftRow, studentName, publishedAt) : null,
      published: publishedRow ? toDomain(publishedRow, studentName) : null,
    }
  },

  /** Ficha publicada para o aluno — `null` enquanto o personal não publicar nenhuma. */
  async findPublished(studentId: string, studentName = ''): Promise<WorkoutPlan | null> {
    const { data, error } = await getSupabase()
      .from('workout_plans')
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'published')
      .maybeSingle()
    if (error) throw error
    return data ? toDomain(data as unknown as WorkoutPlanRow, studentName) : null
  },

  async saveDraft(plan: WorkoutPlan, trainerId: string): Promise<WorkoutPlan> {
    const now = new Date().toISOString()
    const { data, error } = await getSupabase()
      .from('workout_plans')
      .upsert(toPayload(plan, trainerId, 'draft', now), { onConflict: 'student_id,status' })
      .select('*')
      .single()
    if (error) throw error
    return toDomain(data as unknown as WorkoutPlanRow, plan.studentName, plan.publishedAt)
  },

  /**
   * Grava o rascunho e a cópia publicada num único upsert (um só statement no Postgres, então as
   * duas linhas ficam iguais ou nenhuma muda). Daqui em diante o aluno vê esta versão.
   */
  async publish(plan: WorkoutPlan, trainerId: string): Promise<WorkoutPlan> {
    const now = new Date().toISOString()
    const { data, error } = await getSupabase()
      .from('workout_plans')
      .upsert(
        [toPayload(plan, trainerId, 'draft', now), toPayload(plan, trainerId, 'published', now)],
        { onConflict: 'student_id,status' },
      )
      .select('*')
    if (error) throw error

    const draftRow = ((data ?? []) as unknown as WorkoutPlanRow[]).find(
      (row) => row.status === 'draft',
    )
    if (!draftRow) throw new Error('A ficha foi publicada, mas o servidor não devolveu o rascunho.')
    return toDomain(draftRow, plan.studentName, now)
  },
}
