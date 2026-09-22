import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FINDING_KIND_LABEL, type FindingSuggestion } from '../domain/correctivePlan'
import type { PublishCorrectivePlanStatus } from '../hooks/usePublishCorrectivePlan'

type CorrectiveFindingsStepProps = {
  suggestions: FindingSuggestion[]
  status: 'loading' | 'ready' | 'error'
  errorMessage?: string
  onBack: () => void
  /** Publicar é ação explícita do treinador (seção 6 da spec) — nada vai pro aluno sozinho. */
  onPublish: () => void
  publishStatus: PublishCorrectivePlanStatus
  publishErrorMessage?: string
}

/**
 * Tela de "Achados + correção sugerida" (docs/CORRECTIVE_PRESCRIPTION.md, seção 5.1/5.2):
 * lista os achados em "attention" e, para cada um, os exercícios corretivos sugeridos pelo motor
 * fino. É apresentacional — recebe as sugestões prontas; a derivação fica no hook
 * `useCorrectivePrescription` (chamado pelo fluxo).
 *
 * Regra de produto: nada aqui é diagnóstico. A leitura é automática e não-conclusiva; quem
 * decide o treino é o profissional.
 */
export function CorrectiveFindingsStep({
  suggestions,
  status,
  errorMessage,
  onBack,
  onPublish,
  publishStatus,
  publishErrorMessage,
}: CorrectiveFindingsStepProps) {
  // Um plano sem nenhum exercício não tem o que entregar ao aluno — não oferece publicar vazio.
  const hasExercises = suggestions.some(({ selection }) => selection.exercises.length > 0)
  const isPublishing = publishStatus === 'saving'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-lg text-text-primary">Achados e correção sugerida</h3>
        <p className="text-sm text-text-secondary">
          A partir das quatro vistas capturadas, o sistema lista as leituras fora do esperado e
          sugere exercícios de fortalecimento para cada uma. Você revisa e decide antes de publicar.
        </p>
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
        suggestions.map(({ finding, selection }) => (
          <Card key={finding.id} tone="elevated" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-text-primary">{FINDING_KIND_LABEL[finding.kind]}</h4>
              <p className="font-mono text-xs text-text-secondary">{finding.evidence}</p>
            </div>

            <p className="text-sm text-text-secondary">{finding.rationale}</p>

            {selection.notice && (
              <p className="text-sm text-warning">{selection.notice}</p>
            )}

            {selection.exercises.length > 0 && (
              <ul className="flex flex-col gap-2 border-t border-border pt-3">
                {selection.exercises.map((exercise) => (
                  <li key={exercise.id} className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-text-primary">{exercise.name}</span>
                    <span className="font-mono text-[11px] uppercase text-text-secondary">
                      {exercise.target}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}

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
        <Button variant="secondary" onClick={onBack}>
          Voltar às capturas
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
