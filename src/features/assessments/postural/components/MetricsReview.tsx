import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { PosturalMetric, TrainerValidation } from '../domain/posturalAssessment.types'

type MetricsReviewProps = {
  metrics: PosturalMetric[]
  onChange: (metrics: PosturalMetric[]) => void
}

const STATUS_TONE: Record<PosturalMetric['status'], 'success' | 'warning' | 'neutral'> = {
  within_expected_range: 'success',
  attention: 'warning',
  low_confidence: 'neutral',
  not_available: 'neutral',
}

const STATUS_LABEL: Record<PosturalMetric['status'], string> = {
  within_expected_range: 'Dentro do esperado',
  attention: 'Atenção',
  low_confidence: 'Baixa confiança',
  not_available: 'Não disponível',
}

type MetricRowProps = {
  metric: PosturalMetric
  onValidate: (validation: TrainerValidation, note: string) => void
}

function MetricRow({ metric, onValidate }: MetricRowProps) {
  const [note, setNote] = useState(metric.trainerNote ?? '')

  return (
    <Card tone="elevated" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-text-primary">{metric.label}</p>
          <p className="text-sm text-text-secondary">{metric.automaticObservation}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[metric.status]}>{STATUS_LABEL[metric.status]}</Badge>
          <Badge tone="neutral">{Math.round(metric.confidence * 100)}% confiança</Badge>
        </div>
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Nota do treinador (opcional)"
        rows={2}
        className="w-full rounded-md border border-border bg-surface p-2 text-sm text-text-primary focus:border-action-primary focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant={metric.trainerValidation === 'accepted' ? 'primary' : 'secondary'}
          onClick={() => onValidate('accepted', note)}
        >
          Aceitar
        </Button>
        <Button
          variant={metric.trainerValidation === 'edited' ? 'primary' : 'secondary'}
          onClick={() => onValidate('edited', note)}
        >
          Editar observação
        </Button>
        <Button
          variant={metric.trainerValidation === 'rejected' ? 'primary' : 'secondary'}
          onClick={() => onValidate('rejected', note)}
        >
          Rejeitar
        </Button>
      </div>
    </Card>
  )
}

export function MetricsReview({ metrics, onChange }: MetricsReviewProps) {
  function handleValidate(metricId: string, validation: TrainerValidation, note: string): void {
    onChange(
      metrics.map((metric) =>
        metric.id === metricId
          ? { ...metric, trainerValidation: validation, trainerNote: note }
          : metric,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-secondary">
        Estes indicadores são visuais e não conclusivos — valide, edite ou rejeite cada um antes de
        salvar.
      </p>
      {metrics.map((metric) => (
        <MetricRow
          key={metric.id}
          metric={metric}
          onValidate={(validation, note) => handleValidate(metric.id, validation, note)}
        />
      ))}
    </div>
  )
}
