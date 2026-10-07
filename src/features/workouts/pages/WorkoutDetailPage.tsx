import { Link, useParams } from 'react-router-dom'
import { ROUTES, buildExerciseDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
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

/** Volume com separador pt-BR; `0` aparece como `0 kg`, nunca como campo vazio. */
function formatKg(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
}

/**
 * Duração REAL da sessão. `null` = sessão sem `completed_at` (não há duração a mostrar) e `0` vira
 * "menos de 1 min" — arredondar 40 segundos para "1 minuto" já seria um número inventado.
 */
function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes === 0) return 'menos de 1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`
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
  const completed = execution.status === 'completed'

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
          <Card tone="glass" className="mb-4 flex flex-col gap-4">
            {completed ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-text-primary">Treino concluído hoje</p>
                    <p className="text-sm text-text-secondary">
                      {execution.session?.completedAt
                        ? `Finalizado às ${new Date(execution.session.completedAt).toLocaleTimeString(
                            'pt-BR',
                            { hour: '2-digit', minute: '2-digit' },
                          )}`
                        : 'Sessão fechada'}
                    </p>
                  </div>
                  <Icon name="check_circle" filled className="text-3xl text-action-primary" />
                </div>
                {/*
                  Resumo honesto: séries FEITAS sobre as prescritas (não "100% concluído"), volume
                  somando só o que foi marcado como feito e a duração medida de started_at a
                  completed_at — não a estimativa da ficha.
                */}
                <dl className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                      Séries
                    </dt>
                    <dd className="font-display text-lg font-bold text-text-primary">
                      {execution.summary.setsDone}/{execution.summary.setsPrescribed}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                      Volume
                    </dt>
                    <dd className="font-display text-lg font-bold text-text-primary">
                      {formatKg(execution.summary.volumeKg)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                      Duração
                    </dt>
                    <dd className="font-display text-lg font-bold text-text-primary">
                      {formatDuration(execution.summary.durationMinutes)}
                    </dd>
                  </div>
                </dl>
                <Link
                  to={ROUTES.student.home}
                  className="text-center text-sm text-text-secondary underline hover:text-action-primary"
                >
                  Voltar para a home
                </Link>
              </>
            ) : executing ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-text-primary">Treino em andamento</p>
                    <p className="text-sm text-text-secondary">
                      {execution.progress.done} de {execution.progress.total} séries feitas ·{' '}
                      {formatKg(execution.summary.volumeKg)}
                    </p>
                  </div>
                  <SaveIndicator status={execution.saveStatus} />
                </div>
                <Button onClick={() => void execution.complete()} className="w-full">
                  Concluir treino
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4">
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
              </div>
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
