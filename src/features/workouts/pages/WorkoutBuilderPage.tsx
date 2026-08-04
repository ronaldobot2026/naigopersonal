import { useMemo, useState } from 'react'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import type { WorkoutExerciseEntry } from '@/mocks/workouts'
import { ExerciseAttribution } from '../components/ExerciseAttribution'
import { ExerciseMedia } from '../components/ExerciseMedia'
import { ExercisePicker } from '../components/ExercisePicker'
import type { Exercise } from '../domain/exercise.types'
import { useExerciseCatalog } from '../hooks/useExerciseCatalog'

const DEFAULT_SETS = 3
const DEFAULT_REPS = '10-12'
const ESTIMATED_MINUTES_PER_SET = 3

export function WorkoutBuilderPage() {
  const { status, catalog, errorMessage } = useExerciseCatalog()
  const [name, setName] = useState('')
  const [entries, setEntries] = useState<WorkoutExerciseEntry[]>([])
  const [saved, setSaved] = useState(false)

  const exercisesById = useMemo(
    () => new Map((catalog?.exercises ?? []).map((exercise) => [exercise.id, exercise])),
    [catalog],
  )

  const totalSets = entries.reduce((sum, entry) => sum + entry.sets, 0)
  const estimatedMinutes = totalSets * ESTIMATED_MINUTES_PER_SET

  const muscleFocus = useMemo(() => {
    const targets = entries.map((entry) => exercisesById.get(entry.exerciseId)?.target)
    return [...new Set(targets.filter((target): target is string => Boolean(target)))]
  }, [entries, exercisesById])

  function addExercise(exercise: Exercise): void {
    setEntries((current) => [
      ...current,
      { exerciseId: exercise.id, sets: DEFAULT_SETS, reps: DEFAULT_REPS },
    ])
    setSaved(false)
  }

  function removeExercise(index: number): void {
    setEntries((current) => current.filter((_, i) => i !== index))
    setSaved(false)
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader eyebrow="Área do personal" title="Criar Novo Treino" />

      {status === 'loading' && <LoadingState label="Carregando biblioteca de exercícios…" />}

      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar a biblioteca"
          description={errorMessage ?? 'Verifique sua conexão e recarregue a página.'}
        />
      )}

      {status === 'ready' && catalog && (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
          <div className="flex flex-col gap-6 md:col-span-8">
            <Card>
              <Input
                label="Nome do treino"
                placeholder="Ex: Treino A - Superior"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Card>

            <div className="flex flex-col gap-3">
              <h3 className="px-2 font-mono text-xs uppercase tracking-widest text-text-secondary">
                Exercícios adicionados ({entries.length})
              </h3>

              {entries.map((entry, index) => {
                const exercise = exercisesById.get(entry.exerciseId)
                if (!exercise) return null

                return (
                  <Card
                    key={`${entry.exerciseId}-${index}`}
                    tone="elevated"
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-border">
                        <ExerciseMedia exercise={exercise} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-bold text-text-primary">{exercise.name}</h4>
                        <p className="font-mono text-xs text-text-secondary">
                          {entry.sets} séries × {entry.reps}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExercise(index)}
                      aria-label={`Remover ${exercise.name}`}
                      className="p-2 text-text-secondary hover:text-error"
                    >
                      <Icon name="delete" />
                    </button>
                  </Card>
                )
              })}

              <Card className="border-dashed">
                <ExercisePicker exercises={catalog.exercises} onAdd={addExercise} />
              </Card>
            </div>
          </div>

          <div className="md:col-span-4">
            <Card className="flex flex-col gap-4">
              <h5 className="font-mono text-xs uppercase tracking-widest text-action-primary">
                Resumo do plano
              </h5>
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-text-secondary">Tempo estimado</span>
                <span className="font-mono text-text-primary">~{estimatedMinutes} min</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-text-secondary">Volume total</span>
                <span className="font-mono text-text-primary">{totalSets} séries</span>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {muscleFocus.map((target) => (
                  <Badge key={target}>{target}</Badge>
                ))}
              </div>
              <Button onClick={() => setSaved(true)} disabled={!name || entries.length === 0}>
                <Icon name="save" />
                Salvar treino
              </Button>
              {saved && (
                <p className="text-center text-sm text-success">
                  Treino salvo (demonstração — ainda não persiste).
                </p>
              )}
            </Card>
          </div>

          <div className="md:col-span-12">
            <ExerciseAttribution
              attribution={catalog.mediaAttribution}
              source={catalog.source}
              className="text-center"
            />
          </div>
        </div>
      )}
    </div>
  )
}
