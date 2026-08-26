import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES, buildExerciseDetailPath } from '@/app/router/routes'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Tabs } from '@/components/ui/Tabs'
import { ExerciseAttribution } from '../components/ExerciseAttribution'
import { ExerciseMedia } from '../components/ExerciseMedia'
import {
  POSTURAL_CATEGORIES,
  selectPosturalExercises,
  type PosturalCategoryId,
} from '../domain/posturalProgram'
import { selectExercisesForFocus, type PosturalFocusId } from '../domain/posturalPrescription'
import { useExerciseCatalog } from '../hooks/useExerciseCatalog'
import { usePosturalFindings } from '../hooks/usePosturalFindings'

/** Quantas sugestões exibir por categoria — a lista é uma vitrine, não o catálogo inteiro. */
const SUGGESTIONS_LIMIT = 12

function formatAssessedAt(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Área de exercícios/mobilidade prescritos após a Avaliação Física — NÃO é a Avaliação
 * Postural (que fica em Personal → Nova Avaliação Física → aba Avaliação Postural).
 *
 * As sugestões seguem os achados da última avaliação postural do aluno: a região que a
 * avaliação destacou entra selecionada e filtra a vitrine. Sem avaliação — ou sem nenhum
 * destaque — a tela cai no recorte genérico por categoria, que era o comportamento anterior.
 */
export function PosturalCorrectionPage() {
  const [category, setCategory] = useState<PosturalCategoryId>(POSTURAL_CATEGORIES[0].id)
  const [chosenFocusId, setChosenFocusId] = useState<PosturalFocusId | null>(null)
  const { status, catalog, errorMessage } = useExerciseCatalog()
  const { status: findingsStatus, findings, assessedAt } = usePosturalFindings()

  const activeCategory =
    POSTURAL_CATEGORIES.find((item) => item.id === category) ?? POSTURAL_CATEGORIES[0]

  // O achado mais acentuado é o padrão; a escolha explícita do aluno tem precedência. Derivar
  // em vez de sincronizar com `useEffect` evita um render intermediário com o foco errado.
  const activeFinding =
    findings.find((finding) => finding.focus.id === chosenFocusId) ?? findings[0] ?? null

  const matching = useMemo(() => {
    if (!catalog) return []
    return activeFinding
      ? selectExercisesForFocus(catalog.exercises, activeFinding.focus.id, category)
      : selectPosturalExercises(catalog.exercises, category)
  }, [catalog, category, activeFinding])

  const suggestions = matching.slice(0, SUGGESTIONS_LIMIT)
  const hasFindings = findingsStatus === 'ready' && findings.length > 0

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Módulo"
        title="Correção Postural"
        description="Refine seu alinhamento através de mobilidade direcionada, alongamento e fortalecimento estrutural."
      />

      {hasFindings && activeFinding && (
        <Card tone="elevated" className="mb-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-mono text-xs uppercase tracking-widest text-action-primary">
              Direcionado pela sua avaliação postural
            </h2>
            {assessedAt && (
              <span className="font-mono text-[10px] uppercase text-text-secondary">
                Avaliação de {formatAssessedAt(assessedAt)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {findings.map((finding) => {
              const isActive = finding.focus.id === activeFinding.focus.id
              return (
                <button
                  key={finding.focus.id}
                  type="button"
                  onClick={() => setChosenFocusId(finding.focus.id)}
                  aria-pressed={isActive}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? 'border-action-primary bg-action-primary/15 text-action-primary'
                      : 'border-border text-text-secondary hover:border-action-primary hover:text-text-primary'
                  }`}
                >
                  {finding.focus.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm text-text-secondary">{activeFinding.focus.rationale}</p>
            <ul className="flex flex-col gap-1">
              {activeFinding.metrics.map((metric) => (
                <li key={metric.id} className="font-mono text-[11px] uppercase text-text-secondary">
                  {metric.label} — {Math.abs(metric.value ?? 0).toFixed(1)}°
                </li>
              ))}
            </ul>
            {!activeFinding.isTrainerValidated && (
              <Badge tone="warning" className="w-fit">
                <Icon name="pending" className="text-sm" />
                Aguardando validação do profissional
              </Badge>
            )}
          </div>
        </Card>
      )}

      <Tabs
        value={category}
        onValueChange={(value) => setCategory(value as PosturalCategoryId)}
        className="mb-6"
      >
        <Tabs.List>
          {POSTURAL_CATEGORIES.map((item) => (
            <Tabs.Trigger key={item.id} value={item.id}>
              {item.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
        <Card tone="elevated" className="md:col-span-8">
          <span className="mb-2 inline-block rounded bg-action-primary/20 px-2 py-1 font-mono text-xs uppercase text-action-primary">
            Sessão em destaque
          </span>
          <h3 className="mb-2 font-display text-xl font-bold text-text-primary">
            Descompressão Espinal Profunda
          </h3>
          <div className="flex gap-4 font-mono text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <Icon name="schedule" className="text-sm" /> 15 min
            </span>
            <span className="flex items-center gap-1">
              <Icon name="bolt" className="text-sm" /> Intermediário
            </span>
          </div>
        </Card>

        <Card className="flex flex-col gap-3 md:col-span-4">
          <h4 className="font-mono text-xs uppercase tracking-widest text-action-primary">
            Progresso semanal
          </h4>
          <ProgressBar value={82} label="Conformidade semanal" />
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div>
              <p className="font-mono text-[10px] uppercase text-text-secondary">Sessões</p>
              <p className="font-display text-xl text-text-primary">12</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-text-secondary">Total min</p>
              <p className="font-display text-xl text-text-primary">184</p>
            </div>
          </div>
        </Card>

        <div className="md:col-span-12">
          <h3 className="mb-1 font-mono text-xs uppercase tracking-widest text-text-secondary">
            {activeFinding
              ? `${activeCategory.label} para ${activeFinding.focus.label.toLowerCase()}`
              : `Sugestões de ${activeCategory.label.toLowerCase()}`}
          </h3>
          <p className="mb-4 text-sm text-text-secondary">{activeCategory.description}</p>

          {status === 'loading' && <LoadingState label="Carregando sugestões…" />}

          {status === 'error' && (
            <ErrorState
              title="Não foi possível carregar as sugestões"
              description={errorMessage ?? 'Verifique sua conexão e recarregue a página.'}
            />
          )}

          {status === 'ready' && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {suggestions.map((exercise) => (
                <Link key={exercise.id} to={buildExerciseDetailPath(exercise.id)} className="group">
                  <Card
                    tone="elevated"
                    className="flex h-full flex-col gap-2 p-0 transition-colors group-hover:border-action-primary"
                  >
                    <ExerciseMedia exercise={exercise} className="rounded-t-lg" />
                    <div className="flex flex-1 flex-col gap-2 p-3 pt-0">
                      <p className="text-sm font-bold leading-tight text-text-primary">
                        {exercise.name}
                      </p>
                      <Badge className="mt-auto w-fit">{exercise.target}</Badge>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {status === 'ready' && matching.length > suggestions.length && (
            <p className="mt-6 text-center text-sm text-text-secondary">
              Mostrando {suggestions.length} de {matching.length} exercícios desta categoria.{' '}
              <Link to={ROUTES.trainer.library} className="underline hover:text-action-primary">
                Ver a biblioteca completa
              </Link>
            </p>
          )}

          {catalog && (
            <ExerciseAttribution
              attribution={catalog.mediaAttribution}
              source={catalog.source}
              className="mt-8 text-center"
            />
          )}
        </div>
      </div>
    </div>
  )
}
