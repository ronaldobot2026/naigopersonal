export interface MealItem {
  label: string
  macro: string
}

export interface Meal {
  id: string
  name: string
  time: string
  kcal: number
  icon: string
  items: MealItem[]
}

export interface DailyTargets {
  calories: number
  calorieProgressPercent: number
  proteinG: number
  carbsG: number
}
