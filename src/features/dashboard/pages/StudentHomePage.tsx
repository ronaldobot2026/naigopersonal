import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Reveal } from '@/components/motion/Reveal'
import { Icon } from '@/components/ui/Icon'
import { MetricCard } from '@/components/ui/MetricCard'
import { useAsyncData } from '@/hooks/useAsyncData'
import { physicalAssessmentRepository } from '@/features/assessments/physical/repositories/physicalAssessmentRepository'
import { studentRepository } from '@/features/students/repositories/studentRepository'
import { TrainingDayCard } from '@/features/workouts/components/TrainingDayCard'
import { useStudentProgram } from '@/features/workouts/hooks/useStudentProgram'
import { useStudentTrainingDay } from '@/features/workouts/hooks/useStudentTrainingDay'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import { summarizeBody, type BodyMetricSummary } from '../domain/studentBodySummary'

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('pt-BR')
}

/** Cartão de métrica a partir da avaliação real — "—" quando o personal não mediu o campo. */
function metricProps(summary: BodyMetricSummary, unit: string) {
  return {
    value: summary.value ?? '—',
    unit,
    trend:
      summary.changePercent === null || summary.changePercent === 0
        ? undefined
        : {
            direction: summary.changePercent > 0 ? ('up' as const) : ('down' as const),
            label: `${Math.abs(summary.changePercent).toFixed(1).replace('.', ',')}%`,
          },
  }
}

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
  const { status: programStatus, program, errorMessage: programError } = useStudentProgram()
  const trainingDay = useStudentTrainingDay(program)
  const { status: assessmentsStatus, data: assessments } = useAsyncData(
    () =>
      currentStudentId
        ? physicalAssessmentRepository.findByStudentId(currentStudentId)
        : Promise.resolve([]),
    [currentStudentId],
  )

  if (
    studentStatus === 'loading' ||
    programStatus === 'loading' ||
    assessmentsStatus === 'loading'
  ) {
    return <LoadingState label="Carregando sua Home…" />
  }

  if (studentStatus === 'error' || programStatus === 'error' || !currentStudent) {
    return (
      <ErrorState
        title="Não foi possível carregar sua Home"
        description={studentError ?? programError ?? 'Verifique sua conexão e recarregue a página.'}
      />
    )
  }

  const body = summarizeBody(assessments ?? [])

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Olá, {currentStudent.name.split(' ')[0]}!
        </h1>
        <p className="mt-1 text-text-secondary">Seja bem-vindo de volta.</p>
      </div>

      <div className="flex flex-col gap-6">
        <TrainingDayCard
          sessions={program?.sessions ?? []}
          today={trainingDay.today}
          week={trainingDay.week}
          suggestion={trainingDay.suggestion}
          loading={trainingDay.status === 'loading'}
        />

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
              <p className="text-sm text-text-secondary">Exercícios da sua avaliação postural</p>
            </div>
          </div>
          <Icon name="chevron_right" className="text-text-secondary" />
        </Link>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-mono text-xs uppercase tracking-widest text-text-secondary">
              Evolução atual
            </h3>
            <span className="font-mono text-[10px] uppercase text-text-secondary">
              {body.assessedAt
                ? `Avaliação de ${formatDate(body.assessedAt)}`
                : 'Sem avaliação ainda'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Reveal>
              <MetricCard label="Peso" {...metricProps(body.weightKg, 'kg')} />
            </Reveal>
            <Reveal delay={70}>
              <MetricCard label="% Gordura" {...metricProps(body.bodyFatPercent, '%')} />
            </Reveal>
            <Reveal delay={140}>
              <MetricCard label="Massa magra" {...metricProps(body.muscleMassKg, 'kg')} />
            </Reveal>
          </div>
        </section>

        <Link
          to={ROUTES.student.myAssessments}
          className="flex items-center justify-between rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-elevated"
        >
          <div>
            <h3 className="font-bold text-text-primary">Minhas avaliações</h3>
            <p className="text-sm text-text-secondary">
              {body.assessedAt
                ? `Última em ${formatDate(body.assessedAt)}`
                : 'Nenhuma avaliação concluída ainda'}
            </p>
          </div>
          <Icon name="chevron_right" className="text-text-secondary" />
        </Link>

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
