import {
  describeHistorySets,
  formatRelativeDay,
  formatShortDate,
  formatWeight,
} from '../domain/workoutHistory'
import { useExerciseHistory } from '../hooks/useExerciseHistory'

interface ExerciseHistoryPanelProps {
  exerciseId: string
  /** Nome atual no catálogo, usado só no rótulo acessível da lista. */
  exerciseName: string
}

/**
 * Evolução de carga de um exercício: uma linha por sessão passada, da mais recente para a mais
 * antiga.
 *
 * Lista, e não gráfico: a decisão que o aluno toma entre duas séries é "subo de 32 para 35?", e
 * para isso ele precisa dos NÚMEROS das últimas vezes, não de uma curva. Gráfico é enfeite aqui.
 *
 * O componente só é montado quando o painel está aberto — é ele que dispara a consulta.
 */
export function ExerciseHistoryPanel({ exerciseId, exerciseName }: ExerciseHistoryPanelProps) {
  const { status, sessions, errorMessage } = useExerciseHistory(exerciseId)

  if (status === 'loading')
    return (
      <p className="text-sm text-text-secondary" role="status">
        Carregando histórico…
      </p>
    )

  if (status === 'error')
    return (
      <p className="text-sm text-error" role="status">
        {errorMessage ?? 'Não foi possível carregar o histórico.'}
      </p>
    )

  if (sessions.length === 0)
    return (
      <p className="text-sm text-text-secondary">
        Primeira vez neste exercício. A carga de hoje já entra no histórico.
      </p>
    )

  return (
    <ul className="flex flex-col gap-2" aria-label={`Histórico de carga — ${exerciseName}`}>
      {sessions.map((session) => (
        <li
          key={session.logId}
          className="flex flex-col gap-0.5 border-l-2 border-border pl-3 text-sm"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-bold text-text-primary">
              {formatWeight(session.topWeightKg)}
              <span className="font-body font-normal text-text-secondary">
                {' '}
                · {session.sets.length} {session.sets.length === 1 ? 'série' : 'séries'} ·{' '}
                {session.totalReps} reps
              </span>
            </span>
            {/*
              `title` com a data absoluta: "2 semanas atrás" é o que importa de relance, mas quem
              quer conferir o ciclo precisa do dia.
            */}
            <span
              className="shrink-0 text-xs text-text-secondary"
              title={formatShortDate(session.completedAt)}
            >
              {formatRelativeDay(session.completedAt)}
            </span>
          </div>
          <span className="text-xs text-text-secondary">{describeHistorySets(session)}</span>
        </li>
      ))}
    </ul>
  )
}
