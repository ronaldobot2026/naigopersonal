import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { ExerciseAttribution } from '../components/ExerciseAttribution'
import { TRANSLATED_STEPS_LANGUAGE } from '../domain/exerciseCatalog'
import { ExerciseMedia } from '../components/ExerciseMedia'
import { useExerciseCatalog } from '../hooks/useExerciseCatalog'

interface SetRow {
  reps: number
  loadKg: number
  done: boolean
}

const INITIAL_SETS: SetRow[] = [
  { reps: 12, loadKg: 20, done: false },
  { reps: 10, loadKg: 20, done: false },
  { reps: 10, loadKg: 20, done: false },
]

export function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const { status, catalog, errorMessage } = useExerciseCatalog()
  const [sets, setSets] = useState<SetRow[]>(INITIAL_SETS)

  if (status === 'loading') return <LoadingState label="Carregando exercício…" />
  if (status === 'error') {
    return (
      <ErrorState
        title="Não foi possível carregar o exercício"
        description={errorMessage ?? 'Verifique sua conexão e recarregue a página.'}
      />
    )
  }

  const exercise = catalog?.exercises.find((item) => item.id === exerciseId)
  if (!exercise) {
    return <EmptyState title="Exercício não encontrado" description="Volte para o treino." />
  }

  function toggleSet(index: number): void {
    setSets((current) => current.map((set, i) => (i === index ? { ...set, done: !set.done } : set)))
  }

  function addSet(): void {
    setSets((current) => [
      ...current,
      { reps: current.at(-1)?.reps ?? 10, loadKg: current.at(-1)?.loadKg ?? 20, done: false },
    ])
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg border border-border">
          <ExerciseMedia exercise={exercise} animated />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="informative">{exercise.target}</Badge>
            <Badge>{exercise.equipment}</Badge>
            <Badge>{exercise.bodyPart}</Badge>
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary">{exercise.name}</h1>
          {exercise.isNameTranslated && (
            <p className="font-mono text-xs text-text-secondary">{exercise.originalName}</p>
          )}
          <p className="text-sm text-text-secondary">
            Músculos secundários: {exercise.secondaryMuscles.join(', ') || '—'}
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-action-primary">
            Execução
          </h3>
          {exercise.stepsLanguage !== TRANSLATED_STEPS_LANGUAGE && (
            <Badge tone="warning">Instruções ainda em inglês</Badge>
          )}
        </div>
        <ol className="flex flex-col gap-3">
          {exercise.steps.map((step, index) => (
            <li key={step} className="flex gap-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-high text-xs font-bold text-text-primary">
                {index + 1}
              </span>
              <p className="text-text-secondary">{step}</p>
            </li>
          ))}
        </ol>
      </Card>

      <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-text-secondary">
        Progresso da sessão atual
      </h3>
      <div className="flex flex-col gap-2">
        {sets.map((set, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs text-text-secondary">SÉRIE {index + 1}</span>
              <span className="text-text-primary">{set.reps} reps</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-action-primary">{set.loadKg}kg</span>
              <button
                type="button"
                onClick={() => toggleSet(index)}
                aria-pressed={set.done}
                aria-label={`Marcar série ${index + 1} como concluída`}
                className={`flex h-8 w-8 items-center justify-center rounded border ${
                  set.done
                    ? 'border-action-primary bg-action-primary/10 text-action-primary'
                    : 'border-border text-text-secondary'
                }`}
              >
                <Icon name="check" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addSet}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-text-secondary hover:border-action-primary hover:text-action-primary"
        >
          <Icon name="add" />
          <span className="font-mono text-xs">Adicionar série</span>
        </button>
      </div>

      {catalog && (
        <ExerciseAttribution
          attribution={catalog.mediaAttribution}
          source={catalog.source}
          className="mt-10 text-center"
        />
      )}
    </div>
  )
}
