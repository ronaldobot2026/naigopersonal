import { FunctionsHttpError } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { Student } from '@/types/domain'

/**
 * Formato das linhas do Supabase (snake_case), a partir de `database.types.ts` (gerado via
 * `supabase gen types typescript --linked` — regenerar depois de toda migration nova). `Pick`
 * reflete só as colunas de fato pedidas no `.select(...)` abaixo. Nunca vaza para fora deste
 * arquivo: só o tipo `Student` de `src/types/domain.ts` sai daqui, via `toDomain`.
 */
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'trainer_id' | 'status'>

type ProfileRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'email' | 'avatar_url'
>

function toDomain(studentRow: StudentRow, profile: ProfileRow): Student {
  return {
    id: studentRow.id,
    name: profile.full_name,
    email: profile.email,
    avatarUrl: profile.avatar_url ?? undefined,
    trainerId: studentRow.trainer_id,
  }
}

export interface InviteStudentInput {
  email: string
  fullName: string
}

interface InviteStudentResponse {
  studentId: string
}

/**
 * A Edge Function devolve `{ error: string }` no corpo em qualquer resposta não-2xx (ver
 * `supabase/functions/invite-student/index.ts`) — essa mensagem já é a que a UI deve mostrar
 * (ex.: "Só um personal pode convidar alunos.", "E-mail já cadastrado"). Sem isso o usuário só
 * veria um `FunctionsHttpError` genérico.
 */
async function resolveInviteErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string }
      if (body.error) return body.error
    } catch {
      // corpo não era JSON — cai no fallback abaixo
    }
  }
  return 'Não foi possível convidar o aluno. Tente novamente.'
}

/**
 * Alunos reais do Supabase (Fase 8 do docs/ROADMAP.md). A RLS já garante o isolamento:
 * `students_all_trainer` só devolve linhas com `trainer_id = auth.uid()`, então um personal
 * nunca vê aluno de outro. Os dados de nome/e-mail vivem em `profiles` (FK 1:1 via `students.id`).
 */
export const studentRepository = {
  /** Alunos vinculados ao personal logado (RLS filtra por `trainer_id = auth.uid()`). */
  async findAll(): Promise<Student[]> {
    const supabase = getSupabase()
    const { data: studentRows, error } = await supabase.from('students').select('id, trainer_id, status')
    if (error) throw error

    const rows = (studentRows ?? []) as StudentRow[]
    if (rows.length === 0) return []

    const ids = rows.map((row) => row.id)
    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', ids)
    if (profilesError) throw profilesError

    const profilesById = new Map<string, ProfileRow>()
    for (const profile of (profileRows ?? []) as ProfileRow[]) {
      profilesById.set(profile.id, profile)
    }

    return rows
      .map((row) => {
        const profile = profilesById.get(row.id)
        return profile ? toDomain(row, profile) : null
      })
      .filter((student): student is Student => student !== null)
  },

  async findById(id: string): Promise<Student | null> {
    const supabase = getSupabase()
    const { data: studentRow, error } = await supabase
      .from('students')
      .select('id, trainer_id, status')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!studentRow) return null

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('id', id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile) return null

    return toDomain(studentRow as StudentRow, profile as ProfileRow)
  },

  /**
   * Convida um aluno novo (Fase 8). Sempre via Edge Function — service_role nunca chega ao
   * cliente, e é a função que valida, no servidor, que quem chama é de fato um trainer antes de
   * criar o usuário e gravar `students.trainer_id` (ver comentário no topo da função).
   */
  async invite(input: InviteStudentInput): Promise<InviteStudentResponse> {
    const supabase = getSupabase()
    const { data, error } = await supabase.functions.invoke<InviteStudentResponse>('invite-student', {
      body: { email: input.email, full_name: input.fullName },
    })
    if (error) throw new Error(await resolveInviteErrorMessage(error))
    if (!data) throw new Error('Convite enviado, mas a resposta do servidor veio vazia.')
    return data
  },
}
