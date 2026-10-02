import { Link } from 'react-router-dom'
import { ROUTES, buildWorkoutDetailPath } from '@/app/router/routes'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Reveal } from '@/components/motion/Reveal'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { MetricCard } from '@/components/ui/MetricCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAsyncData } from '@/hooks/useAsyncData'
import { studentRepository } from '@/features/students/repositories/studentRepository'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import { workoutRepository } from '@/features/workouts/repositories/workoutRepository'

export function StudentHomePage() {
  const { userId: currentStudentId } = useAuthUser()
  const {
    status: studentStatus,
    data: currentStudent,
    errorMessage: studentError,
  } = useAsyncData(
    () => (currentStudentId ? studentRepository.findById(currentStudentId) : Promise.resolve(null)),
    [currentStudentId],
  )
  const {
    status: workoutsStatus,
    data: workouts,
    errorMessage: workoutsError,
  } = useAsyncData(() => workoutRepository.findAll(), [])

  if (studentStatus === 'loading' || workoutsStatus === 'loading') {
    return <LoadingState label="Carregando sua Home…" />
  }

  if (
    studentStatus === 'error' ||
    workoutsStatus === 'error' ||
    !currentStudent ||
    !workouts?.length
  ) {
    return (
      <ErrorState
        title="Não foi possível carregar sua Home"
        description={studentError ?? workoutsError ?? 'Verifique sua conexão e recarregue a página.'}
      />
    )
  }

  const todaysWorkout = workouts[0]

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Olá, {currentStudent.name.split(' ')[0]}!
        </h1>
        <p className="mt-1 text-text-secondary">Seja bem-vindo de volta.</p>
      </div>

      <div className="flex flex-col gap-6">
        <Card tone="elevated" className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="rounded border border-action-primary/20 bg-action-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-action-primary">
                Treino do dia
              </span>
              <h2 className="mt-2 font-display text-xl font-bold text-text-primary">
                {todaysWorkout.name}
              </h2>
            </div>
            <Icon name="fitness_center" className="text-3xl text-action-primary" />
          </div>
          <Link
            to={buildWorkoutDetailPath(todaysWorkout.id)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-action-primary py-3 font-bold text-action-primary-foreground active:scale-95"
          >
            <Icon name="play_arrow" filled />
            VER TREINO
          </Link>
        </Card>

        <Link
          to={ROUTES.student.posturalCorrection}
          className="flex items-center justify-between rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-elevated"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-high text-action-primary">
              <Icon name="accessibility_new" />
            </div>
            <div>
              <h3 className="font-bold text-text-primary">Correção Postural</h3>
              <p className="text-sm text-text-secondary">Sessão 1: Mobilidade e Ativação</p>
            </div>
          </div>
          <Icon name="chevron_right" className="text-text-secondary" />
        </Link>

        <section>
          <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-text-secondary">
            Evolução atual
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <Reveal>
              <MetricCard
                label="Peso"
                value={78.4}
                unit="kg"
                trend={{ direction: 'up', label: '1,2%' }}
              />
            </Reveal>
            <Reveal delay={70}>
              <MetricCard
                label="% Gordura"
                value={14.2}
                unit="%"
                trend={{ direction: 'down', label: '0,8%' }}
              />
            </Reveal>
            <Reveal delay={140}>
              <MetricCard
                label="Massa magra"
                value={67.3}
                unit="kg"
                trend={{ direction: 'up', label: '2,1%' }}
              />
            </Reveal>
          </div>
        </section>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-text-primary">Próxima Avaliação</h3>
            <span className="font-mono text-xs text-text-secondary">20/06/2026</span>
          </div>
          <ProgressBar value={65} label="Progresso até a próxima avaliação" />
          <p className="text-center text-sm italic text-text-secondary">
            Faltam 12 dias para sua nova evolução.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Link
            to={ROUTES.student.nutrition}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-elevated"
          >
            <Icon name="restaurant" className="text-action-primary" />
            <span className="font-mono text-xs text-text-primary">Plano Alimentar</span>
          </Link>
          <Link
            to={ROUTES.student.billing}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-elevated"
          >
            <Icon name="payments" className="text-action-primary" />
            <span className="font-mono text-xs text-text-primary">Financeiro</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
