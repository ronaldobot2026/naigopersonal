import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildExerciseDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ExerciseAttribution } from '../components/ExerciseAttribution'
import { ExerciseFilterBar } from '../components/ExerciseFilterBar'
import { ExerciseMedia } from '../components/ExerciseMedia'
import { EMPTY_EXERCISE_FILTERS, type Exercise } from '../domain/exercise.types'
import { filterExercises } from '../domain/exerciseCatalog'
import { useExerciseCatalog } from '../hooks/useExerciseCatalog'

/** Quantos cartões renderizar por vez — 1.324 nós de uma vez travariam a rolagem. */
const PAGE_SIZE = 48

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <Link to={buildExerciseDetailPath(exercise.id)} className="group">
      <Card
        tone="glass"
        interactive
        className="flex h-full flex-col gap-3 overflow-hidden p-0 transition-[border-color,transform,box-shadow] duration-300 ease-out-quint group-hover:-translate-y-0.5 group-hover:border-action-primary/60 group-hover:shadow-glass group-active:translate-y-0 group-active:scale-[0.99]"
      >
        <ExerciseMedia exercise={exercise} className="rounded-t-lg" />
        <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
          <h3 className="font-display text-base font-bold leading-tight text-text-primary">
            {exercise.name}
          </h3>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <Badge tone="informative">{exercise.target}</Badge>
            <Badge>{exercise.equipment}</Badge>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export function ExerciseLibraryPage() {
  const { status, catalog, errorMessage } = useExerciseCatalog()
  const [filters, setFilters] = useState(EMPTY_EXERCISE_FILTERS)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const results = useMemo(
    () => (catalog ? filterExercises(catalog.exercises, filters) : []),
    [catalog, filters],
  )

  function handleFiltersChange(next: typeof filters): void {
    setFilters(next)
    setVisibleCount(PAGE_SIZE)
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Suporte"
        title="Biblioteca de Exercícios"
        description="Referência técnica completa para prescrição de treinos."
      />

      {status === 'loading' && <LoadingState label="Carregando catálogo de exercícios…" />}

      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar os exercícios"
          description={errorMessage ?? 'Verifique sua conexão e recarregue a página.'}
        />
      )}

      {status === 'ready' && catalog && (
        <>
          <ExerciseFilterBar
            exercises={catalog.exercises}
            filters={filters}
            onChange={handleFiltersChange}
            resultCount={results.length}
            visibleCount={visibleCount}
          />

          {results.length === 0 ? (
            <EmptyState
              icon="search_off"
              title="Nenhum exercício encontrado"
              description="Ajuste a busca ou limpe os filtros para ver mais resultados."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {results.slice(0, visibleCount).map((exercise) => (
                  <ExerciseCard key={exercise.id} exercise={exercise} />
                ))}
              </div>

              {visibleCount < results.length && (
                <div className="mt-8 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                    className="rounded-md border border-action-primary px-6 py-3 font-mono text-xs uppercase tracking-wider text-action-primary transition-colors hover:bg-action-primary/10"
                  >
                    Carregar mais {Math.min(PAGE_SIZE, results.length - visibleCount)} exercícios
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(results.length)}
                    className="font-mono text-xs uppercase tracking-wider text-text-secondary underline hover:text-action-primary"
                  >
                    Ver todos os {results.length}
                  </button>
                </div>
              )}
            </>
          )}

          <ExerciseAttribution
            attribution={catalog.mediaAttribution}
            source={catalog.source}
            className="mt-10 text-center"
          />
        </>
      )}
    </div>
  )
}
