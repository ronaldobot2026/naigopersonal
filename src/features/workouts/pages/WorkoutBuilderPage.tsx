import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { Tabs } from '@/components/ui/Tabs'
import { ExerciseAttribution } from '../components/ExerciseAttribution'
import { ExercisePicker } from '../components/ExercisePicker'
import { WorkoutEntryCard } from '../components/WorkoutEntryCard'
import {
  createEmptyDivision,
  createEntry,
  duplicateEntry,
  moveEntry,
  nextDivisionId,
} from '../domain/createWorkoutPlan'
import { useExerciseCatalog } from '../hooks/useExerciseCatalog'
import { useWorkoutPlanDraft } from '../hooks/useWorkoutPlanDraft'
import type { Exercise } from '../domain/exercise.types'
import type { WorkoutDivisionId, WorkoutExerciseEntry } from '../domain/workout.types'

export function WorkoutBuilderPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { status, catalog, errorMessage } = useExerciseCatalog()
  const { plan, loadState, updatePlan, save, saving, savedAt } = useWorkoutPlanDraft(studentId ?? '')
  const [divisaoAtiva, setDivisaoAtiva] = useState<WorkoutDivisionId>('A')

  const exercisesById = useMemo(
    () => new Map((catalog?.exercises ?? []).map((exercise) => [exercise.id, exercise])),
    [catalog],
  )

  if (!studentId) {
    return <ErrorState title="Aluno não informado" description="Volte para a lista de alunos." />
  }

  /** Aplica uma transformação na lista de exercícios da divisão ativa. */
  function alterarEntradas(
    transformar: (entries: WorkoutExerciseEntry[]) => WorkoutExerciseEntry[],
  ): void {
    if (!plan) return
    updatePlan({
      divisions: plan.divisions.map((division) =>
        division.id === divisaoAtiva
          ? { ...division, entries: transformar(division.entries) }
          : division,
      ),
    })
  }

  function renomearDivisao(id: WorkoutDivisionId, label: string): void {
    if (!plan) return
    updatePlan({ divisions: plan.divisions.map((d) => (d.id === id ? { ...d, label } : d)) })
  }

  function adicionarExercicio(exercise: Exercise): void {
    alterarEntradas((entries) => [...entries, createEntry(exercise.id)])
  }

  function adicionarDivisao(): void {
    if (!plan) return
    const proxima = nextDivisionId(plan)
    if (!proxima) return
    updatePlan({ divisions: [...plan.divisions, createEmptyDivision(proxima)] })
    setDivisaoAtiva(proxima)
  }

  const totalExercicios = plan?.divisions.reduce((sum, d) => sum + d.entries.length, 0) ?? 0
  const podeAdicionarDivisao = plan ? nextDivisionId(plan) !== null : false

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Área do personal"
        title="Montar treino"
        description={plan ? `Ficha de ${plan.studentName}` : undefined}
      />

      {(loadState === 'loading' || status === 'loading') && (
        <LoadingState label="Carregando ficha e biblioteca de exercícios…" />
      )}

      {loadState === 'error' && (
        <ErrorState
          title="Não foi possível carregar a ficha"
          description="Verifique se o aluno existe e tente novamente."
        />
      )}

      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar a biblioteca"
          description={errorMessage ?? 'Verifique sua conexão e recarregue a página.'}
        />
      )}

      {loadState === 'ready' && status === 'ready' && plan && catalog && (
        <div className="flex flex-col gap-6">
          <Card className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
            <Input label="Aluno" value={plan.studentName} readOnly />
            <Input
              label="Objetivo"
              placeholder="Ex: hipertrofia, emagrecimento, condicionamento"
              value={plan.objective}
              onChange={(event) => updatePlan({ objective: event.target.value })}
            />
            <NumberInput
              label="Frequência semanal"
              unit="x/semana"
              min="1"
              max="7"
              value={plan.weeklyFrequency === null ? '' : String(plan.weeklyFrequency)}
              onChange={(event) =>
                updatePlan({
                  weeklyFrequency: event.target.value === '' ? null : Number(event.target.value),
                })
              }
            />
            <div className="md:col-span-3">
              <Input
                label="Observações"
                placeholder="Orientações gerais da ficha"
                value={plan.notes}
                onChange={(event) => updatePlan({ notes: event.target.value })}
              />
            </div>
          </Card>

          <Tabs
            value={divisaoAtiva}
            onValueChange={(value) => setDivisaoAtiva(value as WorkoutDivisionId)}
          >
            <Tabs.List className="mb-4">
              {plan.divisions.map((division) => (
                <Tabs.Trigger key={division.id} value={division.id}>
                  {division.label ? `${division.id} · ${division.label}` : `Treino ${division.id}`}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {plan.divisions.map((division) => (
              <Tabs.Panel key={division.id} value={division.id}>
                <div className="flex flex-col gap-3">
                  <Input
                    label={`Foco do treino ${division.id}`}
                    placeholder="Ex: Superior, Membros inferiores, Push"
                    value={division.label}
                    onChange={(event) => renomearDivisao(division.id, event.target.value)}
                  />

                  {division.entries.map((entry, index) => {
                    const exercise = exercisesById.get(entry.exerciseId)
                    if (!exercise) return null
                    return (
                      <WorkoutEntryCard
                        key={`${entry.exerciseId}-${index}`}
                        entry={entry}
                        exercise={exercise}
                        index={index}
                        total={division.entries.length}
                        onChange={(patch) =>
                          alterarEntradas((entries) =>
                            entries.map((item, i) => (i === index ? { ...item, ...patch } : item)),
                          )
                        }
                        onRemove={() =>
                          alterarEntradas((entries) => entries.filter((_, i) => i !== index))
                        }
                        onDuplicate={() =>
                          alterarEntradas((entries) => duplicateEntry(entries, index))
                        }
                        onMove={(direction) =>
                          alterarEntradas((entries) => moveEntry(entries, index, index + direction))
                        }
                      />
                    )
                  })}

                  {division.entries.length === 0 && (
                    <p className="px-2 text-sm text-text-secondary">
                      Nenhum exercício no treino {division.id} ainda. Adicione pela biblioteca
                      abaixo.
                    </p>
                  )}

                  <Card className="border-dashed">
                    <ExercisePicker exercises={catalog.exercises} onAdd={adicionarExercicio} />
                  </Card>
                </div>
              </Tabs.Panel>
            ))}
          </Tabs>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={adicionarDivisao} disabled={!podeAdicionarDivisao}>
              <Icon name="add" />
              {podeAdicionarDivisao ? 'Adicionar divisão' : 'Divisões A–E completas'}
            </Button>

            <div className="flex items-center gap-3">
              {savedAt && (
                <span className="font-mono text-xs text-text-secondary">
                  Salva em {new Date(savedAt).toLocaleString('pt-BR')}
                </span>
              )}
              <Button onClick={() => void save()} disabled={saving || totalExercicios === 0}>
                <Icon name="save" />
                {saving ? 'Salvando…' : 'Salvar ficha'}
              </Button>
            </div>
          </div>

          <ExerciseAttribution
            attribution={catalog.mediaAttribution}
            source={catalog.source}
            className="text-center"
          />
        </div>
      )}
    </div>
  )
}
