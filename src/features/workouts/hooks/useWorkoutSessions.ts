import { useAsyncData } from '@/hooks/useAsyncData'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import type { SessionRange, WorkoutLog } from '../domain/workoutLog.types'
import { workoutLogRepository } from '../repositories/workoutLogRepository'

interface UseWorkoutSessionsResult {
  status: 'loading' | 'ready' | 'error'
  /** Sessões da mais recente para a mais antiga. Vazio quando o aluno nunca treinou. */
  sessions: WorkoutLog[]
  errorMessage: string | undefined
}

/**
 * Histórico de treinos do aluno logado, no trio loading/ready/error do `useAsyncData` (Fase 5) —
 * mesmo padrão de `usePosturalFindings`, para não haver um segundo jeito de buscar dado no app.
 *
 * O aluno é o `auth.uid()` da sessão real; sem sessão devolve lista vazia em vez de assumir um
 * aluno mockado.
 *
 * `range` entra nas deps por campo (e não pelo objeto) porque um literal `{}` escrito no JSX é
 * uma referência nova a cada render e refaria a consulta para sempre.
 */
export function useWorkoutSessions(range: SessionRange = {}): UseWorkoutSessionsResult {
  const { userId } = useAuthUser()
  const { status, data, errorMessage } = useAsyncData(
    () =>
      userId
        ? workoutLogRepository.listSessions(userId, range)
        : Promise.resolve([] as WorkoutLog[]),
    [userId, range.from, range.to, range.limit],
  )

  return { status, sessions: data ?? [], errorMessage }
}
