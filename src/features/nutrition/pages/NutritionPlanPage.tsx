import { useState } from 'react'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAsyncData } from '@/hooks/useAsyncData'
import { nutritionRepository } from '../repositories/nutritionRepository'

export function NutritionPlanPage() {
  const [checkedMeals, setCheckedMeals] = useState<Set<string>>(new Set())
  const {
    status: targetsStatus,
    data: dailyTargets,
    errorMessage: targetsError,
  } = useAsyncData(() => nutritionRepository.getDailyTargets(), [])
  const { status: mealsStatus, data: meals, errorMessage: mealsError } = useAsyncData(
    () => nutritionRepository.getMeals(),
    [],
  )

  function toggleMeal(mealId: string): void {
    setCheckedMeals((current) => {
      const next = new Set(current)
      if (next.has(mealId)) next.delete(mealId)
      else next.add(mealId)
      return next
    })
  }

  if (targetsStatus === 'loading' || mealsStatus === 'loading') {
    return <LoadingState label="Carregando plano alimentar…" />
  }

  if (targetsStatus === 'error' || mealsStatus === 'error' || !dailyTargets || !meals) {
    return (
      <ErrorState
        title="Não foi possível carregar o plano alimentar"
        description={targetsError ?? mealsError ?? 'Verifique sua conexão e recarregue a página.'}
      />
    )
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        title="Plano Alimentar"
        description="Foque na disciplina para atingir o seu potencial máximo."
      />

      <div className="mb-gutter grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="col-span-2 flex flex-col justify-between gap-3">
          <span className="font-mono text-xs uppercase text-action-primary">Calorias totais</span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-extrabold text-text-primary">
              {dailyTargets.calories.toLocaleString('pt-BR')}
            </span>
            <span className="text-text-secondary">kcal</span>
          </div>
          <ProgressBar
            value={dailyTargets.calorieProgressPercent}
            label="Progresso calórico do dia"
          />
        </Card>
        <Card className="flex flex-col justify-between gap-2">
          <span className="font-mono text-xs uppercase text-text-secondary">Proteínas</span>
          <span className="font-display text-2xl font-bold text-text-primary">
            {dailyTargets.proteinG}g
          </span>
        </Card>
        <Card className="flex flex-col justify-between gap-2">
          <span className="font-mono text-xs uppercase text-text-secondary">Carboidratos</span>
          <span className="font-display text-2xl font-bold text-text-primary">
            {dailyTargets.carbsG}g
          </span>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        {meals.map((meal) => {
          const isChecked = checkedMeals.has(meal.id)
          return (
            <Card key={meal.id} tone="elevated" className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-high text-action-primary">
                    <Icon name={meal.icon} />
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-text-primary">{meal.name}</h3>
                    <p className="text-sm text-text-secondary">
                      {meal.time} • {meal.kcal} kcal
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMeal(meal.id)}
                  aria-pressed={isChecked}
                  aria-label={`Marcar ${meal.name} como consumida`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                    isChecked
                      ? 'border-action-primary bg-action-primary text-action-primary-foreground'
                      : 'border-border text-text-secondary'
                  }`}
                >
                  <Icon name={isChecked ? 'done_all' : 'check'} />
                </button>
              </div>
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                {meal.items.map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-text-primary">{item.label}</span>
                    <span className="font-mono text-xs text-text-secondary">{item.macro}</span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
