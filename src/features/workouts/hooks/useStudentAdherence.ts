import { useMemo } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { buildAdherenceSessions, type AdherenceSession } from '../domain/adherence'
import { summarizeWeek, type WeekProgress } from '../domain/trainingDay'
import { workoutLogRepository } from '../repositories/workoutLogRepository'
import { workoutPlanRepository } from '../repositories/workoutPlanRepository'
import type { WorkoutDivision } from '../domain/workout.types'
import type { SetLog, WorkoutLog } from '../domain/workoutLog.types'

/**
 * Quantas sessões a tela do personal lista. Cobre com folga a semana corrente (nenhum aluno
 * fecha 12 treinos em 7 dias), o que permite contar a semana a partir da MESMA lista em vez de
 * fazer uma segunda consulta que poderia discordar dela.
 */
const SESSION_WINDOW = 12

interface AdherenceData {
  logs: WorkoutLog[]
  sets: SetLog[]
  divisions: WorkoutDivision[]
  weeklyFrequency: number | null
  /** `false` = o personal ainda não publicou ficha para este aluno. */
  hasPlan: boolean
}

export interface UseStudentAdherenceResult {
  status: 'loading' | 'ready' | 'error'
  /** Sessões do aluno, da mais recente para a mais antiga. Vazio = nunca treinou. */
  sessions: AdherenceSession[]
  /** Séries de todas as sessões listadas — o drill-down não faz consulta nova. */
  sets: SetLog[]
  /** Divisões da ficha publicada, para comparar o feito com o prescrito. */
  divisions: WorkoutDivision[]
  /** Semana corrente contra `weekly_frequency`, pela mesma regra da home do aluno. */
  week: WeekProgress
  hasPlan: boolean
  errorMessage: string | undefined
}

const EMPTY_WEEK: WeekProgress = {
  completed: 0,
  target: null,
  weekStart: '',
  hasHistory: false,
}

/**
 * Aderência de UM aluno, para o personal (`/personal/alunos/:id`).
 *
 * Somente leitura, e não por disciplina de UI: a RLS da F10-1 dá ao personal apenas `select` em
 * `workout_logs`/`set_logs` (`public.is_my_student`). Este hook não expõe nenhuma escrita, então
 * não existe caminho na tela que tente gravar o treino do aluno e tome erro de RLS.
 *
 * A ficha vem de `findPublished` — a versão que o ALUNO vê —, e não do rascunho em edição: o
 * prescrito que faz sentido comparar é o que estava valendo para ele.
 */
export function useStudentAdherence(studentId: string | undefined): UseStudentAdherenceResult {
  const { status, data, errorMessage } = useAsyncData<AdherenceData>(async () => {
    if (!studentId) return new Promise<never>(() => undefined)

    const [plan, logs] = await Promise.all([
      workoutPlanRepository.findPublished(studentId),
      workoutLogRepository.listSessions(studentId, { limit: SESSION_WINDOW }),
    ])
    const sets = await workoutLogRepository.listSetsForSessions(logs.map((log) => log.id))

    return {
      logs,
      sets,
      divisions: plan?.divisions ?? [],
      weeklyFrequency: plan?.weeklyFrequency ?? null,
      hasPlan: plan !== null,
    }
  }, [studentId])

  const sessions = useMemo(
    () =>
      data
        ? buildAdherenceSessions({ logs: data.logs, sets: data.sets, divisions: data.divisions })
        : [],
    [data],
  )

  const week = useMemo(
    () =>
      data ? summarizeWeek({ logs: data.logs, weeklyFrequency: data.weeklyFrequency }) : EMPTY_WEEK,
    [data],
  )

  return {
    status,
    sessions,
    sets: data?.sets ?? [],
    divisions: data?.divisions ?? [],
    week,
    hasPlan: data?.hasPlan ?? false,
    errorMessage,
  }
}
