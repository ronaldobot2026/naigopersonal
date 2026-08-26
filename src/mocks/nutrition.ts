import type { DailyTargets, Meal } from '@/features/nutrition/domain/nutrition.types'

export type { DailyTargets, Meal, MealItem } from '@/features/nutrition/domain/nutrition.types'

/** Dados fictícios — plano alimentar ainda não vem de um nutricionista/backend real. */
export const MOCK_DAILY_TARGETS: DailyTargets = {
  calories: 2450,
  calorieProgressPercent: 75,
  proteinG: 180,
  carbsG: 220,
}

export const MOCK_MEALS: Meal[] = [
  {
    id: 'cafe-manha',
    name: 'Café da Manhã Reforçado Pré-Treino',
    time: '07:30',
    kcal: 450,
    icon: 'light_mode',
    items: [
      { label: 'Ovos Mexidos com Espinafre e Queijo Cottage (3 un)', macro: '18g Prot' },
      { label: 'Pão Integral Multigrãos com Sementes (2 fatias)', macro: '24g Carb' },
      { label: 'Abacate (50g)', macro: '7g Gord' },
    ],
  },
  {
    id: 'almoco',
    name: 'Almoço',
    time: '12:30',
    kcal: 750,
    icon: 'wb_sunny',
    items: [
      { label: 'Frango Grelhado (150g)', macro: '45g Prot' },
      { label: 'Arroz Branco (200g)', macro: '56g Carb' },
      { label: 'Brócolis e Cenoura', macro: 'Fibra' },
    ],
  },
  {
    id: 'lanche-tarde',
    name: 'Lanche da Tarde',
    time: '16:00',
    kcal: 320,
    icon: 'coffee',
    items: [
      { label: 'Whey Protein (1 scoop)', macro: '24g Prot' },
      { label: 'Aveia em flocos (30g)', macro: '18g Carb' },
    ],
  },
  {
    id: 'jantar',
    name: 'Jantar',
    time: '20:00',
    kcal: 650,
    icon: 'dark_mode',
    items: [
      { label: 'Filé de Tilápia (150g)', macro: '38g Prot' },
      { label: 'Batata Doce (150g)', macro: '30g Carb' },
    ],
  },
]
