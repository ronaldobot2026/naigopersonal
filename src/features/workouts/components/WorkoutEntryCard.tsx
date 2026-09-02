import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { ExerciseMedia } from './ExerciseMedia'
import type { Exercise } from '../domain/exercise.types'
import type { WorkoutExerciseEntry } from '../domain/workout.types'

type WorkoutEntryCardProps = {
  entry: WorkoutExerciseEntry
  exercise: Exercise
  index: number
  total: number
  onChange: (patch: Partial<WorkoutExerciseEntry>) => void
  onRemove: () => void
  onDuplicate: () => void
  onMove: (direction: -1 | 1) => void
}

/** Converte o valor do input numérico: vazio vira `null`, não `0`. */
function numeroOuNulo(valor: string): number | null {
  if (valor.trim() === '') return null
  const n = Number(valor)
  return Number.isNaN(n) ? null : n
}

export function WorkoutEntryCard({
  entry,
  exercise,
  index,
  total,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: WorkoutEntryCardProps) {
  const [aberto, setAberto] = useState(false)

  return (
    <Card tone="elevated" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-xs text-text-secondary">{index + 1}</span>
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-border">
            <ExerciseMedia exercise={exercise} />
          </div>
          <div className="min-w-0">
            <h4 className="truncate font-bold text-text-primary">{exercise.name}</h4>
            <p className="font-mono text-xs text-text-secondary">
              {exercise.target} · {entry.sets}x{entry.reps}
              {entry.loadKg ? ` · ${entry.loadKg}kg` : ''}
              {entry.rir !== null && entry.rir !== undefined ? ` · RIR ${entry.rir}` : ''}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <IconButton
            icon="arrow_upward"
            label={`Mover ${exercise.name} para cima`}
            onClick={() => onMove(-1)}
            disabled={index === 0}
          />
          <IconButton
            icon="arrow_downward"
            label={`Mover ${exercise.name} para baixo`}
            onClick={() => onMove(1)}
            disabled={index === total - 1}
          />
          <IconButton
            icon="content_copy"
            label={`Duplicar ${exercise.name}`}
            onClick={onDuplicate}
          />
          <IconButton icon="delete" label={`Remover ${exercise.name}`} onClick={onRemove} />
          <IconButton
            icon={aberto ? 'expand_less' : 'expand_more'}
            label={aberto ? `Fechar detalhes de ${exercise.name}` : `Editar ${exercise.name}`}
            onClick={() => setAberto((v) => !v)}
          />
        </div>
      </div>

      {aberto && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 md:grid-cols-3">
          <NumberInput
            label="Séries"
            min="1"
            value={String(entry.sets)}
            onChange={(e) => onChange({ sets: Math.max(1, Number(e.target.value) || 1) })}
          />
          <Input
            label="Repetições"
            placeholder="10-12"
            value={entry.reps}
            onChange={(e) => onChange({ reps: e.target.value })}
          />
          <NumberInput
            label="Carga"
            unit="kg"
            step="0.5"
            value={entry.loadKg === undefined ? '' : String(entry.loadKg)}
            onChange={(e) => onChange({ loadKg: numeroOuNulo(e.target.value) ?? undefined })}
          />
          <NumberInput
            label="RIR"
            min="0"
            max="10"
            value={entry.rir === null || entry.rir === undefined ? '' : String(entry.rir)}
            onChange={(e) => onChange({ rir: numeroOuNulo(e.target.value) })}
          />
          <NumberInput
            label="Intervalo"
            unit="s"
            min="0"
            step="15"
            value={
              entry.restSeconds === null || entry.restSeconds === undefined
                ? ''
                : String(entry.restSeconds)
            }
            onChange={(e) => onChange({ restSeconds: numeroOuNulo(e.target.value) })}
          />
          <Input
            label="Tempo de execução"
            placeholder="3-1-2 ou 30s"
            hint="Opcional"
            value={entry.tempo ?? ''}
            onChange={(e) => onChange({ tempo: e.target.value })}
          />
          <div className="col-span-2 md:col-span-3">
            <Input
              label="Observações do professor"
              placeholder="Ex: pegada aberta, focar na fase excêntrica"
              value={entry.notes ?? ''}
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </div>
        </div>
      )}

      {!aberto && (entry.notes || entry.tempo) && (
        <p className="flex items-center gap-1 border-t border-border pt-2 text-xs text-text-secondary">
          <Icon name="sticky_note_2" className="text-sm" />
          {[entry.tempo && `Tempo ${entry.tempo}`, entry.notes].filter(Boolean).join(' · ')}
        </p>
      )}
    </Card>
  )
}
