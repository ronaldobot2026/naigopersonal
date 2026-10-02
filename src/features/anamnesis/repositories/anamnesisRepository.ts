import { getSupabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/lib/supabase/database.types'
import type {
  Anamnesis,
  AnamnesisAnswers,
  AnamnesisFilledBy,
  AnamnesisStatus,
  AnamnesisTemplateId,
} from '../domain/anamnesis.types'

/**
 * Linha do Supabase (snake_case) a partir de `database.types.ts`. O Postgres só tem `check`
 * constraint (não enum) para template/filled_by/status e `jsonb` para `answers`, então o gerador
 * devolve `string`/`Json`; aqui se estreita de volta para os tipos de domínio que a migration
 * `20261001120000_anamneses.sql` garante. Nada disto sai deste arquivo — só `Anamnesis`.
 */
type AnamnesisRow = Omit<
  Database['public']['Tables']['anamneses']['Row'],
  'template_id' | 'filled_by' | 'status' | 'answers'
> & {
  template_id: AnamnesisTemplateId
  filled_by: AnamnesisFilledBy
  status: AnamnesisStatus
  answers: AnamnesisAnswers
}

function toDomain(row: AnamnesisRow): Anamnesis {
  return {
    id: row.id,
    studentId: row.student_id,
    trainerId: row.trainer_id,
    templateId: row.template_id,
    filledBy: row.filled_by,
    status: row.status,
    answers: row.answers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  }
}

interface CreateAnamnesisInput {
  studentId: string
  /** `auth.uid()` do personal — a RLS exige `trainer_id = auth.uid()`. */
  trainerId: string
  templateId: AnamnesisTemplateId
  filledBy: AnamnesisFilledBy
}

export const anamnesisRepository = {
  async findById(id: string): Promise<Anamnesis | null> {
    const { data, error } = await getSupabase()
      .from('anamneses')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toDomain(data as AnamnesisRow) : null
  },

  /** A RLS decide o que volta: o personal vê tudo do aluno; o aluno, só pendentes/concluídas. */
  async findByStudentId(studentId: string): Promise<Anamnesis[]> {
    const { data, error } = await getSupabase()
      .from('anamneses')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as AnamnesisRow[]).map(toDomain)
  },

  /** Personal preenche → `draft`; aluno preenche → `pending_student` (aparece no app do aluno). */
  async create(input: CreateAnamnesisInput): Promise<Anamnesis> {
    const { data, error } = await getSupabase()
      .from('anamneses')
      .insert({
        student_id: input.studentId,
        trainer_id: input.trainerId,
        template_id: input.templateId,
        filled_by: input.filledBy,
        status: input.filledBy === 'student' ? 'pending_student' : 'draft',
      })
      .select('*')
      .single()
    if (error) throw error
    return toDomain(data as AnamnesisRow)
  },

  async saveAnswers(anamnesis: Anamnesis, answers: AnamnesisAnswers): Promise<Anamnesis> {
    const { data, error } = await getSupabase()
      .from('anamneses')
      .update({ answers: answers as unknown as Json, updated_at: new Date().toISOString() })
      .eq('id', anamnesis.id)
      .select('*')
      .single()
    if (error) throw error
    return toDomain(data as AnamnesisRow)
  },

  async complete(anamnesis: Anamnesis, answers: AnamnesisAnswers): Promise<Anamnesis> {
    const now = new Date().toISOString()
    const { data, error } = await getSupabase()
      .from('anamneses')
      .update({
        answers: answers as unknown as Json,
        status: 'completed',
        updated_at: now,
        completed_at: now,
      })
      .eq('id', anamnesis.id)
      .select('*')
      .single()
    if (error) throw error
    return toDomain(data as AnamnesisRow)
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabase().from('anamneses').delete().eq('id', id)
    if (error) throw error
  },
}
