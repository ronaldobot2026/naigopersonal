import { Link } from 'react-router-dom'
import { ROUTES, buildWorkoutDetailPath } from '@/app/router/routes'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import type { DivisionSuggestion, TrainingDayStatus, WeekProgress } from '../domain/trainingDay'
import type { WorkoutSession } from '../domain/workout.types'

interface TrainingDayCardProps {
  /** Divisões da ficha publicada, na ordem do ciclo. Vazio = sem ficha. */
  sessions: WorkoutSession[]
  today: TrainingDayStatus
  week: WeekProgress
  suggestion: DivisionSuggestion
  /** `true` enquanto as sessões do aluno ainda estão sendo lidas. */
  loading: boolean
}

const STATE_LABEL: Record<TrainingDayStatus['state'], string> = {
  todo: 'A fazer',
  in_progress: 'Em andamento',
  completed_today: 'Concluído hoje',
}

function sessionLabel(session: WorkoutSession): string {
  return session.focusTag ? `${session.name} · ${session.focusTag}` : session.name
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Card "TREINO DE HOJE" da home do aluno.
 *
 * Ele não decide nada: recebe o estado já derivado das sessões reais (`useStudentTrainingDay`) e
 * só escolhe palavras. A regra que importa está na escrita: **cada número nasce de uma sessão
 * gravada**. Sem histórico na semana, o lugar da sequência semanal mostra o estado vazio — o card
 * antigo exibia um volume fixo de 78,4 kg que nunca existiu, e é esse tipo de mentira
 * tranquilizadora que esta tela não pode repetir.
 */
export function TrainingDayCard({
  sessions,
  today,
  week,
  suggestion,
  loading,
}: TrainingDayCardProps) {
  const byId = new Map(sessions.map((session) => [session.id, session]))
  const activeKey = today.session?.divisionKey ?? null
  // A divisão da sessão pode ter saído da ficha (o personal republicou): nesse caso o card ainda
  // diz o estado honesto e manda o aluno para a lista, em vez de linkar uma rota inexistente.
  const activeSession = activeKey === null ? null : (byId.get(activeKey) ?? null)
  const suggested =
    suggestion.divisionKey === null ? null : (byId.get(suggestion.divisionKey) ?? null)
  const target = today.state === 'todo' ? suggested : activeSession

  const title = (() => {
    if (sessions.length === 0) return 'Aguardando sua ficha'
    if (target) return sessionLabel(target)
    if (activeKey) return `Treino ${activeKey}`
    return 'Escolha um treino'
  })()

  const otherPending = suggestion.pending.filter((key) => key !== target?.id)

  return (
    <Card tone="elevated" className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <span className="rounded border border-action-primary/20 bg-action-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-action-primary">
            Treino de hoje
          </span>
          <h2 className="mt-2 font-display text-xl font-bold text-text-primary">{title}</h2>
          {sessions.length === 0 ? (
            <p className="mt-1 text-sm text-text-secondary">
              Seu personal ainda não publicou sua ficha de treino.
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-secondary" data-testid="training-day-state">
              {loading
                ? 'Verificando seus treinos…'
                : today.state === 'completed_today'
                  ? `${STATE_LABEL.completed_today}${
                      today.session?.completedAt
                        ? ` às ${formatTime(today.session.completedAt)}`
                        : ''
                    }`
                  : today.state === 'in_progress'
                    ? `${STATE_LABEL.in_progress} desde ${
                        today.session ? formatTime(today.session.startedAt) : '—'
                      }`
                    : suggestion.cycleComplete
                      ? `${STATE_LABEL.todo} · ciclo da semana fechado, reiniciando`
                      : STATE_LABEL.todo}
            </p>
          )}
        </div>
        <Icon
          name={today.state === 'completed_today' ? 'check_circle' : 'fitness_center'}
          filled={today.state === 'completed_today'}
          className="text-3xl text-action-primary"
        />
      </div>

      {/*
        Sequência semanal. Com histórico, o número é contado das sessões concluídas; sem histórico,
        o card diz que não há nada registrado em vez de desenhar uma barra em zero que parece
        progresso. A meta só aparece quando o personal preencheu `weekly_frequency` na ficha.
      */}
      {sessions.length > 0 && !loading && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
            Esta semana
          </p>
          {week.hasHistory ? (
            <p className="mt-1 text-sm text-text-primary">
              <span className="font-display text-lg font-bold">{week.completed}</span>
              {week.target === null
                ? ` ${week.completed === 1 ? 'treino concluído' : 'treinos concluídos'}`
                : ` de ${week.target} treinos da sua ficha`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-secondary">
              Nenhum treino registrado nesta semana ainda
              {week.target === null ? '.' : ` · sua ficha prevê ${week.target} por semana.`}
            </p>
          )}
        </div>
      )}

      {target && today.state !== 'completed_today' && (
        <Link
          to={buildWorkoutDetailPath(target.id)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-action-primary py-3 font-bold text-action-primary-foreground active:scale-95"
        >
          <Icon name="play_arrow" filled />
          {today.state === 'in_progress' ? 'CONTINUAR TREINO' : 'INICIAR TREINO'}
        </Link>
      )}

      {target && today.state === 'completed_today' && (
        <Link
          to={buildWorkoutDetailPath(target.id)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface py-3 font-bold text-text-primary active:scale-95"
        >
          <Icon name="visibility" />
          VER O RESUMO
        </Link>
      )}

      {/*
        O empate não fica escondido: quando mais de uma divisão continua pendente no ciclo, a
        sugestão é só um atalho e as outras ficam à mão. O aluno escolhe.
      */}
      {otherPending.length > 0 && (
        <p className="text-center text-sm text-text-secondary">
          Ainda nesta semana:{' '}
          {otherPending.map((key, index) => (
            <span key={key}>
              {index > 0 && ', '}
              <Link
                to={buildWorkoutDetailPath(key)}
                className="underline hover:text-action-primary"
              >
                {byId.get(key)?.name ?? `Treino ${key}`}
              </Link>
            </span>
          ))}
        </p>
      )}

      {sessions.length > 1 && (
        <Link
          to={ROUTES.student.workouts}
          className="text-center text-sm text-text-secondary underline hover:text-action-primary"
        >
          Ver os {sessions.length} treinos da ficha
        </Link>
      )}
    </Card>
  )
}
