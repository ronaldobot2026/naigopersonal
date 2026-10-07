import { toStudentSessions } from '../domain/studentSessions'
import type { WorkoutPlan, WorkoutSession } from '../domain/workout.types'
import { workoutPlanRepository } from './workoutPlanRepository'

/** O programa que o aluno vê: a ficha publicada e as sessões (divisões) derivadas dela. */
export interface StudentProgram {
  plan: WorkoutPlan
  sessions: WorkoutSession[]
}

/**
 * Treinos do aluno logado, lidos da ficha que o personal PUBLICOU (`workout_plans`, status
 * `published`). Antes devolvia um fixture igual para todos os alunos; agora cada aluno vê só o que
 * o próprio personal montou — e a RLS garante que ninguém lê a ficha de outro.
 */
export const workoutRepository = {
  /** `null` enquanto o personal não publicar nenhuma ficha para o aluno. */
  async findProgram(studentId: string): Promise<StudentProgram | null> {
    const plan = await workoutPlanRepository.findPublished(studentId)
    if (!plan) return null
    return { plan, sessions: toStudentSessions(plan) }
  },

  async findSession(studentId: string, sessionId: string): Promise<WorkoutSession | null> {
    const program = await this.findProgram(studentId)
    return program?.sessions.find((session) => session.id === sessionId) ?? null
  },
}
