import { Link, useParams } from 'react-router-dom'
import { buildExerciseDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { MOCK_WORKOUTS } from '@/mocks/workouts'
import { ExerciseAttribution } from '../components/ExerciseAttribution'
import { ExerciseMedia } from '../components/ExerciseMedia'
import { useExerciseCatalog } from '../hooks/useExerciseCatalog'

export function WorkoutDetailPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const { status, catalog, errorMessage } = useExerciseCatalog()
  const workout = MOCK_WORKOUTS.find((item) => item.id === workoutId)

  if (!workout) {
    return <EmptyState title="Treino não encontrado" description="Volte para a lista de treinos." />
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow={workout.focusTag}
        title={workout.name}
        description={`${workout.durationMinutes} minutos estimados`}
      />

      {status === 'loading' && <LoadingState label="Carregando exercícios do treino…" />}

      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar os exercícios"
          description={errorMessage ?? 'Verifique sua conexão e recarregue a página.'}
        />
      )}

      {status === 'ready' && catalog && (
        <>
          <div className="flex flex-col gap-3">
            {workout.exercises.map((entry) => {
              const exercise = catalog.exercises.find((item) => item.id === entry.exerciseId)
              if (!exercise) return null

              return (
                <Link key={entry.exerciseId} to={buildExerciseDetailPath(exercise.id)}>
                  <Card
                    tone="elevated"
                    className="flex items-center justify-between gap-4 transition-colors hover:border-action-primary"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                        <ExerciseMedia exercise={exercise} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-text-primary">{exercise.name}</p>
                        <p className="text-sm text-text-secondary">
                          {entry.sets} séries × {entry.reps}
                          {entry.loadKg ? ` · ${entry.loadKg}kg` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge className="shrink-0">{exercise.target}</Badge>
                  </Card>
                </Link>
              )
            })}
          </div>

          <ExerciseAttribution
            attribution={catalog.mediaAttribution}
            source={catalog.source}
            className="mt-10 text-center"
          />
        </>
      )}
    </div>
  )
}
