import { Link, useParams } from 'react-router-dom'
import { ROUTES, buildExerciseDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ExerciseAttribution } from '../components/ExerciseAttribution'
import { ExerciseMedia } from '../components/ExerciseMedia'
import { WorkoutExecutionCard } from '../components/WorkoutExecutionCard'
import { useExerciseCatalog } from '../hooks/useExerciseCatalog'
import { useStudentProgram } from '../hooks/useStudentProgram'
import { useWorkoutExecution, type SaveStatus } from '../hooks/useWorkoutExecution'
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

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Salvando…',
  saved: 'Salvo',
  error: 'Falhou ao salvar',
}

/**
 * Selo de gravação. É o único feedback de que o treino está sendo registrado — não existe botão
 * "salvar" nesta tela, de propósito: o aluno está de pé entre duas séries.
 */
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  const tone = status === 'error' ? 'text-error' : 'text-text-secondary'
  return (
    <p role="status" aria-live="polite" className={`text-xs ${tone}`}>
      {SAVE_LABEL[status]}
    </p>
  )
}

export function WorkoutDetailPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const { status, catalog, errorMessage } = useExerciseCatalog()
  const { status: programStatus, program, errorMessage: programErrorMessage } = useStudentProgram()
  const workout = program?.sessions.find((session) => session.id === workoutId) ?? null

  const execution = useWorkoutExecution({
    divisionKey: workoutId,
    planId: program?.plan.id ?? null,
    entries: workout?.exercises ?? [],
    // O nome vai DENORMALIZADO para o log: é o rótulo do dia do treino, e o histórico tem de
    // continuar legível se o catálogo renomear o exercício depois (ver workoutLog.types.ts).
    exerciseName: (exerciseId) =>
      catalog?.exercises.find((item) => item.id === exerciseId)?.name ?? exerciseId,
    ready: status === 'ready' && programStatus === 'ready' && Boolean(catalog) && Boolean(workout),
  })

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

  const executing = execution.status === 'ready' && execution.groups.length > 0

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
          <Card tone="glass" className="mb-4 flex items-center justify-between gap-4">
            {executing ? (
              <>
                <div>
                  <p className="font-bold text-text-primary">Treino em andamento</p>
                  <p className="text-sm text-text-secondary">
                    {execution.progress.done} de {execution.progress.total} séries feitas
                  </p>
                </div>
                <SaveIndicator status={execution.saveStatus} />
              </>
            ) : (
              <>
                <div>
                  <p className="font-bold text-text-primary">Pronto para treinar?</p>
                  <p className="text-sm text-text-secondary">
                    Registre carga e repetições série por série.
                  </p>
                </div>
                <Button
                  onClick={() => void execution.start()}
                  disabled={execution.status === 'loading'}
                >
                  Iniciar treino
                </Button>
              </>
            )}
          </Card>

          {execution.status === 'error' && (
            <ErrorState
              title="Não foi possível registrar o treino"
              description={execution.errorMessage ?? 'Tente novamente em alguns segundos.'}
            />
          )}

          <div className="flex flex-col gap-3">
            {executing
              ? execution.groups.map((group) => (
                  <WorkoutExecutionCard
                    key={group.exerciseId}
                    group={group}
                    onChange={execution.updateRow}
                  />
                ))
              : workout.exercises.map((entry, index) => {
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
                            <p className="text-sm text-text-secondary">
                              {describePrescription(entry)}
                            </p>
                            {entry.notes && (
                              <p className="mt-1 text-xs italic text-text-secondary">
                                {entry.notes}
                              </p>
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
