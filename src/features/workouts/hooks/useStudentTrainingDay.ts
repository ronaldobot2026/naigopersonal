import { useMemo } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import {
  resolveTrainingDay,
  startOfTrainingWeek,
  suggestDivision,
  summarizeWeek,
  type DivisionSuggestion,
  type TrainingDayStatus,
  type WeekProgress,
} from '../domain/trainingDay'
import { workoutLogRepository } from '../repositories/workoutLogRepository'
import type { WorkoutLog } from '../domain/workoutLog.types'
import type { StudentProgram } from '../repositories/workoutRepository'

export interface UseStudentTrainingDayResult {
  status: 'loading' | 'ready' | 'error'
  /** `todo` / `in_progress` / `completed_today`, com a sessão que justifica o estado. */
  today: TrainingDayStatus
  /** Treinos concluídos nesta semana contra a frequência da ficha (pode ser `null`). */
  week: WeekProgress
  /** Divisão sugerida e as pendentes do ciclo — ver `suggestDivision` para a regra. */
  suggestion: DivisionSuggestion
  errorMessage: string | undefined
}

const EMPTY_DAY: TrainingDayStatus = { state: 'todo', session: null }

/**
 * O "treino de hoje" do aluno logado, para a home.
 *
 * Recebe o programa já carregado (`useStudentProgram`) em vez de buscá-lo de novo: a home precisa
 * dele para o nome da divisão, e dois fetches da mesma ficha abririam espaço para a home mostrar
 * uma divisão sugerida que não existe mais no card ao lado.
 *
 * A janela lida é a semana corrente; a sessão ABERTA é buscada à parte e unida à lista, porque um
 * treino aberto na semana passada e nunca fechado ficaria fora da janela e a home diria "a fazer"
 * para um aluno que tem uma sessão pendurada.
 */
export function useStudentTrainingDay(program: StudentProgram | null): UseStudentTrainingDayResult {
  const { userId, status: authStatus } = useAuthUser()

  const divisionKeys = useMemo(
    () => (program?.sessions ?? []).map((session) => session.id),
    [program],
  )
  const divisionSignature = divisionKeys.join('|')

  const { status, data, errorMessage } = useAsyncData<WorkoutLog[]>(
    async () => {
      if (!userId) {
        if (authStatus === 'unauthenticated') {
          throw new Error('Sessão expirada. Faça login novamente.')
        }
        return new Promise<never>(() => undefined)
      }

      const [weekLogs, open] = await Promise.all([
        workoutLogRepository.listSessions(userId, {
          from: startOfTrainingWeek(new Date()).toISOString(),
        }),
        workoutLogRepository.findOpenSession(userId),
      ])

      const merged = [...weekLogs]
      if (open && !merged.some((log) => log.id === open.id)) merged.push(open)
      return merged
    },
    [userId, authStatus, program?.plan.id ?? null, divisionSignature],
  )

  const logs = data ?? []

  const today = useMemo(
    () => (status === 'ready' ? resolveTrainingDay(logs, new Date()) : EMPTY_DAY),
    // `logs` é um array novo a cada render quando `data` é undefined; o status é o portão.
    [status, data], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const week = useMemo(
    () =>
      summarizeWeek({
        logs,
        weeklyFrequency: program?.plan.weeklyFrequency ?? null,
      }),
    [data, program], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const suggestion = useMemo(
    () => suggestDivision({ divisionKeys, logs }),
    [data, divisionKeys], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return { status, today, week, suggestion, errorMessage }
}
