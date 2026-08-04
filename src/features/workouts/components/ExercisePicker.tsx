import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import type { Exercise } from '../domain/exercise.types'
import { filterExercises } from '../domain/exerciseCatalog'
import { ExerciseMedia } from './ExerciseMedia'

type ExercisePickerProps = {
  exercises: Exercise[]
  onAdd: (exercise: Exercise) => void
}

/** Quantos resultados mostrar de uma vez — o suficiente para escolher sem virar uma lista infinita. */
const MAX_RESULTS = 8

/**
 * Seletor por busca. Um `<select>` com 1.324 opções é impraticável: o treinador digita parte do
 * nome, do músculo ou do equipamento e adiciona direto do resultado.
 */
export function ExercisePicker({ exercises, onAdd }: ExercisePickerProps) {
  const [search, setSearch] = useState('')

  const results = useMemo(() => {
    if (search.trim().length < 2) return []
    return filterExercises(exercises, {
      search,
      bodyPart: null,
      equipment: null,
      target: null,
    }).slice(0, MAX_RESULTS)
  }, [exercises, search])

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Buscar na biblioteca"
        type="search"
        placeholder="Ex: supino, rosca, agachamento, glúteos…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        hint={`${exercises.length} exercícios disponíveis`}
      />

      {search.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-text-secondary">Nenhum exercício encontrado para essa busca.</p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => onAdd(exercise)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-2 text-left transition-colors hover:border-action-primary"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-border">
                  <ExerciseMedia exercise={exercise} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text-primary">{exercise.name}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {exercise.target} · {exercise.equipment}
                  </p>
                </div>
                <Badge tone="informative" className="shrink-0">
                  <Icon name="add" className="text-sm" />
                  Adicionar
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
