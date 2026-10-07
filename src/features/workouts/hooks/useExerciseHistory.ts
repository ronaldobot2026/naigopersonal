import { useCallback, useEffect, useState } from 'react'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import {
  DEFAULT_HISTORY_SESSIONS,
  groupHistorySessions,
  type ExerciseHistorySession,
} from '../domain/workoutHistory'
import { workoutLogRepository } from '../repositories/workoutLogRepository'

export type HistoryStatus = 'loading' | 'ready' | 'error'

export interface UseExerciseHistoryResult {
  status: HistoryStatus
  sessions: ExerciseHistorySession[]
  errorMessage: string | undefined
  /** Recarrega sob demanda (o aluno fecha e reabre o painel depois de concluir uma série). */
  reload: () => void
}

/**
 * Evolução de carga de UM exercício: as últimas sessões em que o aluno concluiu séries dele.
 *
 * Carrega ao montar, e o componente só é montado quando o aluno abre o painel — o custo é pago
 * por quem pede, não por todo mundo que entra na tela de execução. Durante o treino, nada aqui é
 * refeito a cada tecla: a fonte de verdade dos campos é o estado da execução
 * (`useWorkoutExecution`), e o histórico é a referência do PASSADO.
 */
export function useExerciseHistory(
  exerciseId: string,
  maxSessions: number = DEFAULT_HISTORY_SESSIONS,
): UseExerciseHistoryResult {
  const { userId, status: authStatus } = useAuthUser()
  const [status, setStatus] = useState<HistoryStatus>('loading')
  const [sessions, setSessions] = useState<ExerciseHistorySession[]>([])
  const [errorMessage, setErrorMessage] = useState<string>()
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      setStatus('error')
      setErrorMessage('Sessão expirada. Faça login novamente.')
      return
    }
    if (!userId) return

    let cancelled = false
    setStatus('loading')

    workoutLogRepository
      .listExerciseSets(userId, exerciseId, maxSessions)
      .then((sets) => {
        if (cancelled) return
        setSessions(groupHistorySessions(sets, maxSessions))
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setStatus('error')
        setErrorMessage(
          error instanceof Error ? error.message : 'Não foi possível carregar o histórico.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [userId, authStatus, exerciseId, maxSessions, reloadToken])

  return { status, sessions, errorMessage, reload }
}
