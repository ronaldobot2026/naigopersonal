import { Link, useParams } from 'react-router-dom'
import { ROUTES, buildExerciseDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ExerciseAttribution } from '../components/ExerciseAttribution'
import { ExerciseMedia } from '../components/ExerciseMedia'
import { useExerciseCatalog } from '../hooks/useExerciseCatalog'
import { useStudentProgram } from '../hooks/useStudentProgram'
import type { WorkoutExerciseEntry } from '../domain/workout.types'

/** Linha da prescrição exatamente como o personal preencheu — campos vazios ficam de fora. */
function describePrescription(entry: WorkoutExerciseEntry): string {
  const parts = [`${entry.sets} séries × ${entry.reps}`]
  if (entry.loadKg) parts.push(`${entry.loadKg}kg`)
  if (entry.rir !== null && entry.rir !== undefined) parts.push(`RIR ${entry.rir}`)
  if (entry.restSeconds) parts.push(`descanso ${entry.restSeconds}s`)
  if (entry.tempo) parts.push(`tempo ${entry.tempo}`)
  return parts.join(' · ')
}

export function WorkoutDetailPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const { status, catalog, errorMessage } = useExerciseCatalog()
  const { status: programStatus, program, errorMessage: programErrorMessage } = useStudentProgram()
  const workout = program?.sessions.find((session) => session.id === workoutId) ?? null

  if (programStatus === 'ready' && !workout) {
    return (
      <EmptyState
        title="Treino não encontrado"
        description="Ele pode ter saído da sua ficha. Volte para a lista de treinos."
        action={
          <Link to={ROUTES.student.workouts} className="underline hover:text-action-primary">
            Ver meus treinos
          </Link>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      {workout && (
        <PageHeader
          eyebrow={workout.focusTag || 'Treino'}
          title={workout.name}
          description={`~${workout.durationMinutes} minutos estimados`}
        />
      )}

      {(status === 'loading' || programStatus === 'loading') && (
        <LoadingState label="Carregando exercícios do treino…" />
      )}

      {(status === 'error' || programStatus === 'error') && (
        <ErrorState
          title="Não foi possível carregar os exercícios"
          description={
            errorMessage ?? programErrorMessage ?? 'Verifique sua conexão e recarregue a página.'
          }
        />
      )}

      {status === 'ready' && programStatus === 'ready' && catalog && workout && (
        <>
          <div className="flex flex-col gap-3">
            {workout.exercises.map((entry, index) => {
              const exercise = catalog.exercises.find((item) => item.id === entry.exerciseId)
              if (!exercise) return null

              return (
                <Link
                  key={`${entry.exerciseId}-${index}`}
                  to={buildExerciseDetailPath(exercise.id)}
                >
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
                        <p className="text-sm text-text-secondary">{describePrescription(entry)}</p>
                        {entry.notes && (
                          <p className="mt-1 text-xs italic text-text-secondary">{entry.notes}</p>
                        )}
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
