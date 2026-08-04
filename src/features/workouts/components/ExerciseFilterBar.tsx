import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { Exercise, ExerciseFilters } from '../domain/exercise.types'
import { collectFacet } from '../domain/exerciseCatalog'

type ExerciseFilterBarProps = {
  exercises: Exercise[]
  filters: ExerciseFilters
  onChange: (filters: ExerciseFilters) => void
  resultCount: number
  /** Quantos estão renderizados agora — a lista é paginada, e o contador precisa dizer isso. */
  visibleCount: number
}

const ALL_OPTION = { value: '', label: 'Todos' }

function toOptions(values: string[]) {
  return [ALL_OPTION, ...values.map((value) => ({ value, label: value }))]
}

/** Busca textual + três facetas derivadas do próprio catálogo (região, equipamento, músculo). */
export function ExerciseFilterBar({
  exercises,
  filters,
  onChange,
  resultCount,
  visibleCount,
}: ExerciseFilterBarProps) {
  const shown = Math.min(visibleCount, resultCount)
  return (
    <div className="mb-6 flex flex-col gap-4">
      <Input
        label="Buscar exercício"
        type="search"
        placeholder="Ex: rosca halteres, agachamento, glúteos…"
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select
          label="Região do corpo"
          value={filters.bodyPart ?? ''}
          onChange={(event) => onChange({ ...filters, bodyPart: event.target.value || null })}
          options={toOptions(collectFacet(exercises, 'bodyPart'))}
        />
        <Select
          label="Equipamento"
          value={filters.equipment ?? ''}
          onChange={(event) => onChange({ ...filters, equipment: event.target.value || null })}
          options={toOptions(collectFacet(exercises, 'equipment'))}
        />
        <Select
          label="Músculo principal"
          value={filters.target ?? ''}
          onChange={(event) => onChange({ ...filters, target: event.target.value || null })}
          options={toOptions(collectFacet(exercises, 'target'))}
        />
      </div>

      <p
        aria-live="polite"
        className="font-mono text-xs uppercase tracking-wider text-text-secondary"
      >
        {shown === resultCount
          ? `${resultCount} ${resultCount === 1 ? 'exercício' : 'exercícios'}`
          : `Mostrando ${shown} de ${resultCount} exercícios`}
      </p>
    </div>
  )
}
