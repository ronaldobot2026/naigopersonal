import { Link } from 'react-router-dom'
import { buildWorkoutDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useStudentProgram } from '../hooks/useStudentProgram'

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function StudentWorkoutsPage() {
  const { status, program, errorMessage } = useStudentProgram()
  const plan = program?.plan
  const sessions = program?.sessions ?? []

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Programa atual"
        title="Treinos"
        description={
          plan?.publishedAt
            ? `Ficha montada pelo seu personal · atualizada em ${formatDate(plan.publishedAt)}`
            : 'Sua ficha de treino, montada pelo seu personal.'
        }
      />

      {status === 'loading' && <LoadingState label="Carregando treinos…" />}

      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar seus treinos"
          description={errorMessage ?? 'Verifique sua conexão e recarregue a página.'}
        />
      )}

      {status === 'ready' && sessions.length === 0 && (
        <EmptyState
          title="Nenhum treino publicado ainda"
          description="Assim que seu personal publicar sua ficha, ela aparece aqui."
        />
      )}

      {status === 'ready' && plan && (plan.objective || plan.weeklyFrequency || plan.notes) && (
        <Card className="mb-6 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {plan.objective && <Badge>{plan.objective}</Badge>}
            {plan.weeklyFrequency && <Badge>{plan.weeklyFrequency}x por semana</Badge>}
          </div>
          {plan.notes && <p className="text-sm text-text-secondary">{plan.notes}</p>}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
        {status === 'ready' &&
          sessions.map((session) => (
            <Card key={session.id} tone="elevated" className="flex flex-col gap-4">
              <div>
                {session.focusTag && (
                  <span className="font-mono text-xs uppercase tracking-wider text-action-primary">
                    {session.focusTag}
                  </span>
                )}
                <h3 className="font-display text-xl font-bold text-text-primary">{session.name}</h3>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Badge>
                    {session.exercises.length}{' '}
                    {session.exercises.length === 1 ? 'exercício' : 'exercícios'}
                  </Badge>
                  <Badge>~{session.durationMinutes} min</Badge>
                </div>
                <Link
                  to={buildWorkoutDetailPath(session.id)}
                  className="rounded-lg bg-action-primary px-4 py-2 font-bold text-sm text-action-primary-foreground hover:opacity-90"
                >
                  Ver treino
                </Link>
              </div>
            </Card>
          ))}
      </div>
    </div>
  )
}
