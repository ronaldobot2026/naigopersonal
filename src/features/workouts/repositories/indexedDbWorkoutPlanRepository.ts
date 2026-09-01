import { getAllByIndex, getById, INDEX_NAMES, put, remove, STORE_NAMES } from '@/lib/storage/db'
import type { WorkoutPlan } from '../domain/workout.types'

/**
 * Fichas de treinamento montadas pelo personal, persistidas no IndexedDB — mesmo
 * padrão do PhysicalAssessmentRepository. Vira cutover para Supabase junto com os demais.
 */
export const indexedDbWorkoutPlanRepository = {
  async findById(id: string): Promise<WorkoutPlan | null> {
    return (await getById<WorkoutPlan>(STORE_NAMES.workoutPlans, id)) ?? null
  },

  async findByStudentId(studentId: string): Promise<WorkoutPlan[]> {
    const plans = await getAllByIndex<WorkoutPlan>(
      STORE_NAMES.workoutPlans,
      INDEX_NAMES.studentId,
      studentId,
    )
    return plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  async save(plan: WorkoutPlan): Promise<WorkoutPlan> {
    const updated: WorkoutPlan = { ...plan, updatedAt: new Date().toISOString() }
    await put<WorkoutPlan>(STORE_NAMES.workoutPlans, updated)
    return updated
  },

  async delete(id: string): Promise<void> {
    await remove(STORE_NAMES.workoutPlans, id)
  },
}
