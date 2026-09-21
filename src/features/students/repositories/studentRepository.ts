import { getSupabase } from '@/lib/supabase/client'
import type { Student } from '@/types/domain'

/**
 * Formato das linhas do Supabase (snake_case) — espelha as migrations
 * `identity_foundation.sql` (`profiles` + `students`). Mapeado à mão até existir
 * `database.types.ts` (gerado via `supabase gen types`). Nunca vaza para fora deste
 * arquivo: só o tipo `Student` de `src/types/domain.ts` sai daqui, via `toDomain`.
 */
interface StudentRow {
  id: string
  trainer_id: string
  status: string
}

interface ProfileRow {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

function toDomain(studentRow: StudentRow, profile: ProfileRow): Student {
  return {
    id: studentRow.id,
    name: profile.full_name,
    email: profile.email,
    avatarUrl: profile.avatar_url ?? undefined,
    trainerId: studentRow.trainer_id,
  }
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
}
