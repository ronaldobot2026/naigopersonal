import { MOCK_DAILY_TARGETS, MOCK_MEALS } from '@/mocks/nutrition'
import type { DailyTargets, Meal } from '../domain/nutrition.types'

/**
 * Fonte de dados do plano alimentar do aluno. Hoje devolve o fixture de `@/mocks/nutrition`;
 * cutover para plano real editável pelo personal é a Fase 16 do roadmap.
 */
export const nutritionRepository = {
  async getDailyTargets(): Promise<DailyTargets> {
    return MOCK_DAILY_TARGETS
  },

  async getMeals(): Promise<Meal[]> {
    return MOCK_MEALS
  },
}
