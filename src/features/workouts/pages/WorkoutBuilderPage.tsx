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

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Uma frase só dizendo onde a ficha está: rascunho salvo, o que o aluno vê, o que falta. */
function statusDaFicha(params: {
  totalExercicios: number
  savedAt: string | null
  publishedAt: string | null
  hasUnpublishedChanges: boolean
}): string {
  const { totalExercicios, savedAt, publishedAt, hasUnpublishedChanges } = params
  if (totalExercicios === 0) return 'Adicione ao menos um exercício para poder salvar.'
  if (!publishedAt) {
    return savedAt
      ? `Rascunho salvo em ${quando(savedAt)}. O aluno ainda não vê — publique quando estiver pronta.`
      : 'O aluno ainda não vê esta ficha — publique quando estiver pronta.'
  }
  if (hasUnpublishedChanges) {
    return `O aluno vê a versão de ${quando(publishedAt)}. Publique para enviar as alterações.`
  }
  return `O aluno já vê esta ficha · publicada em ${quando(publishedAt)}.`
}

export function WorkoutBuilderPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { status, catalog, errorMessage } = useExerciseCatalog()
  const {
    plan,
    loadState,
    updatePlan,
    save,
    publish,
    saving,
    savedAt,
    publishedAt,
    hasUnpublishedChanges,
    saveError,
  } = useWorkoutPlanDraft(studentId ?? '')
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

          <div className="flex flex-col gap-3">
            <Button
              variant="secondary"
              className="self-start"
              onClick={adicionarDivisao}
              disabled={!podeAdicionarDivisao}
            >
              <Icon name="add" />
              {podeAdicionarDivisao ? 'Adicionar divisão' : 'Divisões A–E completas'}
            </Button>

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:flex sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => void save()}
                disabled={saving || totalExercicios === 0}
              >
                <Icon name="save" />
                {saving ? 'Salvando…' : 'Salvar rascunho'}
              </Button>
              <Button
                onClick={() => void publish()}
                disabled={saving || totalExercicios === 0 || !hasUnpublishedChanges}
              >
                <Icon name={publishedAt && !hasUnpublishedChanges ? 'check_circle' : 'send'} />
                {publishedAt && !hasUnpublishedChanges ? 'Publicada' : 'Publicar'}
              </Button>
            </div>

            <p className="text-xs text-text-secondary sm:text-right">
              {statusDaFicha({ totalExercicios, savedAt, publishedAt, hasUnpublishedChanges })}
            </p>

            {saveError && (
              <Card tone="elevated" className="flex items-start gap-2 border-error">
                <Icon name="error" className="text-error" />
                <div>
                  <p className="font-bold text-error">Não foi possível salvar a ficha</p>
                  <p className="text-sm text-text-secondary">{saveError}</p>
                </div>
              </Card>
            )}
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
