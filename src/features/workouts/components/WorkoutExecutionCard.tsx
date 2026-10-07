import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import type { ExecutionExerciseGroup, ExecutionSetRow } from '../domain/workoutExecution'
import type { WorkoutExerciseEntry } from '../domain/workout.types'

interface WorkoutExecutionCardProps {
  group: ExecutionExerciseGroup
  onChange: (exerciseId: string, setIndex: number, patch: Partial<ExecutionSetRow>) => void
}

/** A prescrição resumida, para o aluno comparar com o que está fazendo. */
function prescriptionLine(entry: WorkoutExerciseEntry): string {
  const parts = [`${entry.sets} × ${entry.reps}`]
  if (entry.loadKg) parts.push(`${entry.loadKg}kg`)
  if (entry.restSeconds) parts.push(`descanso ${entry.restSeconds}s`)
  return parts.join(' · ')
}

/**
 * Classe dos campos numéricos da execução.
 *
 * `text-base` (16px) não é estética: no iOS, um `<input>` com fonte menor que 16px faz o Safari
 * dar zoom na página ao focar e o aluno perde o treino de vista. `min-h-11` mantém o alvo de
 * toque em 44px, o mínimo das HIG da Apple — a tela é usada em pé, com a mão suada.
 */
const FIELD_CLASS =
  'min-h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-center font-body text-base text-text-primary transition-colors focus:border-action-primary focus:outline-none focus:ring-2 focus:ring-action-primary/20'

/** Um exercício em execução: a prescrição no topo e uma linha por série. */
export function WorkoutExecutionCard({ group, onChange }: WorkoutExecutionCardProps) {
  return (
    <Card tone="elevated" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-text-primary">{group.exerciseName}</p>
          <p className="text-sm text-text-secondary">{prescriptionLine(group.prescription)}</p>
          {group.prescription.notes && (
            <p className="mt-1 text-xs italic text-text-secondary">{group.prescription.notes}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2 text-xs uppercase tracking-wide text-text-secondary">
        <span className="sr-only">Série</span>
        <span aria-hidden="true" />
        <span className="text-center">Reps</span>
        <span className="text-center">Carga (kg)</span>
        <span className="text-center">Feita</span>
      </div>

      {group.rows.map((row) => {
        const rowLabel = `${group.exerciseName}, série ${row.setIndex}`
        return (
          <div key={row.setIndex} className="grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2">
            <span className="font-display text-lg font-extrabold text-text-secondary">
              {row.setIndex}
            </span>

            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={row.reps}
              aria-label={`Repetições — ${rowLabel}`}
              className={FIELD_CLASS}
              onChange={(event) =>
                onChange(group.exerciseId, row.setIndex, { reps: event.target.value })
              }
            />

            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={row.weightKg}
              aria-label={`Carga em quilos — ${rowLabel}`}
              className={FIELD_CLASS}
              onChange={(event) =>
                onChange(group.exerciseId, row.setIndex, { weightKg: event.target.value })
              }
            />

            {/*
              Botão, e não `<input type="checkbox">`: um checkbox nativo tem ~16px de alvo e seria
              o único elemento da linha impossível de acertar sem olhar. `aria-pressed` mantém o
              estado legível para leitor de tela.

              O ícone muda com o estado (círculo vazio → check), e não só a cor de fundo: de
              relance, no celular, quatro checks cinza e bege parecem quatro séries feitas.
            */}
            <button
              type="button"
              aria-pressed={row.done}
              aria-label={`Marcar como feita — ${rowLabel}`}
              onClick={() => onChange(group.exerciseId, row.setIndex, { done: !row.done })}
              className={`flex h-11 w-11 items-center justify-center rounded-md border transition-colors duration-[110ms] active:scale-[0.97] ${
                row.done
                  ? 'border-action-primary bg-action-primary text-action-primary-foreground'
                  : 'border-border bg-surface text-text-secondary'
              }`}
            >
              <Icon name={row.done ? 'check' : 'radio_button_unchecked'} className="text-xl" />
            </button>
          </div>
        )
      })}
    </Card>
  )
}
