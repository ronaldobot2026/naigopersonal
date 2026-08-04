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
import { useExerciseCatalog } from '../hooks/useExerciseCatalog'

/** Quantas sugestões exibir por categoria — a lista é uma vitrine, não o catálogo inteiro. */
const SUGGESTIONS_LIMIT = 12

/**
 * Área de exercícios/mobilidade prescritos após a Avaliação Física — NÃO é a Avaliação
 * Postural (que fica em Personal → Nova Avaliação Física → aba Avaliação Postural).
 */
export function PosturalCorrectionPage() {
  const [category, setCategory] = useState<PosturalCategoryId>(POSTURAL_CATEGORIES[0].id)
  const { status, catalog, errorMessage } = useExerciseCatalog()

  const activeCategory =
    POSTURAL_CATEGORIES.find((item) => item.id === category) ?? POSTURAL_CATEGORIES[0]

  const matching = useMemo(
    () => (catalog ? selectPosturalExercises(catalog.exercises, category) : []),
    [catalog, category],
  )
  const suggestions = matching.slice(0, SUGGESTIONS_LIMIT)

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Módulo"
        title="Correção Postural"
        description="Refine seu alinhamento através de mobilidade direcionada, alongamento e fortalecimento estrutural."
      />

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
            Sugestões de {activeCategory.label.toLowerCase()}
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
