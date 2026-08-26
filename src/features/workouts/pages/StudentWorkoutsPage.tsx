import { Link } from 'react-router-dom'
import { buildWorkoutDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAsyncData } from '@/hooks/useAsyncData'
import { workoutRepository } from '../repositories/workoutRepository'

export function StudentWorkoutsPage() {
  const { status, data: workouts, errorMessage } = useAsyncData(
    () => workoutRepository.findAll(),
    [],
  )

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Programa atual"
        title="Treinos"
        description="Sua trilha de performance personalizada. Complete cada sessão para evoluir seu físico."
      />

      {status === 'loading' && <LoadingState label="Carregando treinos…" />}

      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar seus treinos"
          description={errorMessage ?? 'Verifique sua conexão e recarregue a página.'}
        />
      )}

      {status === 'ready' && workouts?.length === 0 && (
        <EmptyState title="Nenhum treino atribuído" description="Fale com seu personal." />
      )}

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
        {status === 'ready' &&
          workouts?.map((workout) => (
            <Card key={workout.id} tone="elevated" className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-action-primary">
                    {workout.focusTag}
                  </span>
                  <h3 className="font-display text-xl font-bold text-text-primary">
                    {workout.name}
                  </h3>
                </div>
                <span className="font-mono text-sm text-action-primary">
                  {workout.progressPercent}%
                </span>
              </div>
              <ProgressBar value={workout.progressPercent} label={`Progresso — ${workout.name}`} />
              <div className="flex items-center justify-between">
                <Badge>{workout.durationMinutes} min</Badge>
                <Link
                  to={buildWorkoutDetailPath(workout.id)}
                  className="rounded-lg bg-action-primary px-4 py-2 font-bold text-sm text-action-primary-foreground hover:opacity-90"
                >
                  Iniciar sessão
                </Link>
              </div>
            </Card>
          ))}
      </div>
    </div>
  )
}
