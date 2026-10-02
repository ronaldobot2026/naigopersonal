import type { ReactNode } from 'react'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  FINDING_KIND_LABEL,
  defaultSetsAndReps,
  type FindingSuggestion,
} from '../domain/correctivePlan'
import { formatFindingMeasurement } from '../domain/measurementFormat'
import { getPosturalViewDefinition } from '../domain/posturalViews'
import type { PublishCorrectivePlanStatus } from '../hooks/usePublishCorrectivePlan'

type CorrectiveFindingsStepProps = {
  suggestions: FindingSuggestion[]
  status: 'loading' | 'ready' | 'error'
  errorMessage?: string
  onRetakePhotos: () => void
  /** Publicar é ação explícita do treinador (seção 6 da spec) — nada vai pro aluno sozinho. */
  onPublish: () => void
  publishStatus: PublishCorrectivePlanStatus
  publishErrorMessage?: string
  /** Medições completas por vista (foto com skeleton + todas as métricas), montadas pelo fluxo. */
  measurements?: ReactNode
}

function pluralize(count: number): string {
  return count === 1 ? '1 ponto de atenção' : `${count} pontos de atenção`
}

/**
 * Relatório postural (docs/CORRECTIVE_PRESCRIPTION.md, seção 5): aparece sozinho assim que as
 * quatro fotos são analisadas. Em ordem: resumo; cada ponto de atenção com o ângulo medido em
 * destaque, a leitura e os exercícios corretivos sugeridos (com a prescrição padrão que vai para o
 * plano); as medições completas por vista; e a publicação do plano. Apresentacional — as
 * sugestões chegam prontas de `useCorrectivePrescription`.
 *
 * Regra de produto: nada aqui é diagnóstico. A leitura é automática e não-conclusiva; quem
 * decide o treino é o profissional.
 */
export function CorrectiveFindingsStep({
  suggestions,
  status,
  errorMessage,
  onRetakePhotos,
  onPublish,
  publishStatus,
  publishErrorMessage,
  measurements,
}: CorrectiveFindingsStepProps) {
  // Um plano sem nenhum exercício não tem o que entregar ao aluno — não oferece publicar vazio.
  const hasExercises = suggestions.some(({ selection }) => selection.exercises.length > 0)
  const isPublishing = publishStatus === 'saving'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-lg text-text-primary">Relatório postural</h3>
        <p className="text-sm text-text-secondary">
          Leitura automática das quatro vistas. Confira os pontos de atenção, as medições e os
          exercícios sugeridos antes de publicar.
        </p>
        {status === 'ready' && (
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">4 vistas analisadas</Badge>
            <Badge tone={suggestions.length > 0 ? 'warning' : 'neutral'}>
              {pluralize(suggestions.length)}
            </Badge>
          </div>
        )}
      </div>

      {status === 'loading' && <LoadingState label="Montando sugestões corretivas…" />}

      {status === 'error' && (
        <ErrorState
          title="Não foi possível montar as sugestões"
          description={errorMessage ?? 'Verifique sua conexão e tente novamente.'}
        />
      )}

      {status === 'ready' && suggestions.length === 0 && (
        <Card tone="glass">
          <p className="text-sm text-text-secondary">
            Nenhuma alteração relevante foi detectada nas quatro vistas dentro dos limiares
            configurados.
          </p>
        </Card>
      )}

      {status === 'ready' &&
        suggestions.map(({ finding, selection }) => {
          const label = FINDING_KIND_LABEL[finding.kind]
          const titleId = `finding-title-${finding.id}`
          const prescription = defaultSetsAndReps(finding.kind)
          return (
            <Card key={finding.id} tone="elevated" className="flex flex-col gap-3">
              <article aria-labelledby={titleId} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h4 id={titleId} className="font-bold text-text-primary">
                      {label}
                    </h4>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
                      {getPosturalViewDefinition(finding.view).label}
                    </p>
                  </div>
                  <span className="font-display text-3xl leading-none text-warning">
                    {formatFindingMeasurement(finding)}
                  </span>
                </div>

                <p className="font-mono text-xs text-text-secondary">{finding.evidence}</p>
                <p className="text-sm text-text-secondary">{finding.rationale}</p>

                {selection.notice && <p className="text-sm text-warning">{selection.notice}</p>}

                {selection.exercises.length > 0 && (
                  <ul className="flex flex-col gap-2 border-t border-border pt-3">
                    {selection.exercises.map((exercise) => (
                      <li key={exercise.id} className="flex items-baseline justify-between gap-2">
                        <span className="flex flex-col">
                          <span className="text-sm text-text-primary">{exercise.name}</span>
                          <span className="font-mono text-[11px] uppercase text-text-secondary">
                            {exercise.target}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-text-primary">
                          {prescription.sets} × {prescription.reps}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </Card>
          )
        })}

      {measurements && (
        <section className="flex flex-col gap-3">
          <h4 className="font-display text-base text-text-primary">Medições por vista</h4>
          {measurements}
        </section>
      )}

      <p className="text-xs text-text-secondary">
        A leitura automática não é diagnóstico médico. Os exercícios são sugestões — o treino final
        é sempre validado pelo profissional.
      </p>

      {publishStatus === 'success' && (
        <p role="status" className="text-sm text-success">
          Plano corretivo publicado para o aluno.
        </p>
      )}

      {publishStatus === 'error' && (
        <div role="alert" className="flex flex-col gap-1 text-sm text-error">
          <p>Não foi possível publicar o plano corretivo.</p>
          {publishErrorMessage && <p className="font-mono text-xs">{publishErrorMessage}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onRetakePhotos}>
          Refazer fotos
        </Button>
        {status === 'ready' && (
          <Button onClick={onPublish} disabled={!hasExercises || isPublishing}>
            {isPublishing ? 'Publicando…' : 'Publicar plano corretivo'}
          </Button>
        )}
      </div>
    </div>
  )
}
