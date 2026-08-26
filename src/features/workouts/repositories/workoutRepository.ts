import { MOCK_WORKOUTS } from '@/mocks/workouts'
import type { WorkoutSession } from '../domain/workout.types'

/**
 * Fonte de dados de sessões de treino do aluno. Hoje devolve o fixture de `@/mocks/workouts` —
 * nenhuma página deve importar `MOCK_WORKOUTS` diretamente (ver `docs/ARCHITECTURE.md`). Vira
 * cutover para Postgres/Supabase na Fase 10 do roadmap, mesma assinatura.
 */
export const workoutRepository = {
  async findAll(): Promise<WorkoutSession[]> {
    return MOCK_WORKOUTS
  },

  async findById(id: string): Promise<WorkoutSession | null> {
    return MOCK_WORKOUTS.find((workout) => workout.id === id) ?? null
  },
}
