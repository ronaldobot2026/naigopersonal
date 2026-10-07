import { useAsyncData } from '@/hooks/useAsyncData'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import { workoutRepository, type StudentProgram } from '../repositories/workoutRepository'

interface UseStudentProgramResult {
  status: 'loading' | 'ready' | 'error'
  /** `null` quando o personal ainda não publicou nenhuma ficha para o aluno. */
  program: StudentProgram | null
  errorMessage: string | undefined
}

/**
 * Programa de treino do aluno logado — a ficha que o personal publicou. Sem sessão fica em
 * `loading` (nunca consulta com id vazio nem cai num aluno mockado).
 */
export function useStudentProgram(): UseStudentProgramResult {
  const { userId, status: authStatus } = useAuthUser()
  const { status, data, errorMessage } = useAsyncData(
    () =>
      userId
        ? workoutRepository.findProgram(userId)
        : authStatus === 'unauthenticated'
          ? Promise.reject(new Error('Sessão expirada. Faça login novamente.'))
          : new Promise<never>(() => undefined),
    [userId, authStatus],
  )
  return { status, program: data ?? null, errorMessage }
}
