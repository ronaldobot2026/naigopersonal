import { useState } from 'react'
import { CaptureQualityIndicator } from '@/components/feedback/CaptureQualityIndicator'
import { Button } from '@/components/ui/Button'
import { toDomainLandmarks } from '../domain/landmarks'
import type { PosturalCapture, PosturalMetric } from '../domain/posturalAssessment.types'
import { getPosturalViewDefinition } from '../domain/posturalViews'
import { useCaptureImage } from '../hooks/useCaptureImage'
import { MetricsReview } from './MetricsReview'
import { SkeletonOverlay } from './SkeletonOverlay'

type CaptureReviewProps = {
  capture: PosturalCapture
  metrics: PosturalMetric[]
  onMetricsChange: (metrics: PosturalMetric[]) => void
  onRetake: () => void
  onBack: () => void
}

/**
 * Revisão de uma única vista: imagem capturada com skeleton sobreposto, resultado do quality
 * gate e validação das métricas daquela vista pelo treinador.
 */
export function CaptureReview({
  capture,
  metrics,
  onMetricsChange,
  onRetake,
  onBack,
}: CaptureReviewProps) {
  const [showSkeleton, setShowSkeleton] = useState(true)
  const [showReferenceLines, setShowReferenceLines] = useState(true)

  const definition = getPosturalViewDefinition(capture.view)
  const image = useCaptureImage(capture)
  const landmarks = toDomainLandmarks(capture.landmarks)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg text-text-primary">{definition.label}</h3>
        <Button variant="secondary" onClick={onBack}>
          Todas as vistas
        </Button>
      </div>

      <CaptureQualityIndicator quality={capture.quality} />

      {image && (
        <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border">
          <img
            src={image.url}
            alt={`Captura postural — ${definition.label.toLowerCase()}`}
            className="w-full"
          />
          <SkeletonOverlay
            landmarks={landmarks}
            view={capture.view}
            width={image.width}
            height={image.height}
            showSkeleton={showSkeleton}
            showReferenceLines={showReferenceLines}
          />
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4 text-sm text-text-secondary">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showSkeleton}
            onChange={(event) => setShowSkeleton(event.target.checked)}
            className="accent-action-primary"
          />
          Skeleton
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showReferenceLines}
            onChange={(event) => setShowReferenceLines(event.target.checked)}
            className="accent-action-primary"
          />
          Linhas de referência
        </label>
      </div>

      {capture.quality.passed ? (
        <MetricsReview metrics={metrics} onChange={onMetricsChange} />
      ) : (
        <p className="text-center text-sm text-error">
          A captura não atingiu a qualidade mínima necessária — as métricas desta vista não foram
          calculadas.
        </p>
      )}

      <Button
        variant={capture.quality.passed ? 'secondary' : 'primary'}
        onClick={onRetake}
        className="self-center"
      >
        {capture.quality.passed ? 'Repetir captura' : 'Tentar novamente'}
      </Button>
    </div>
  )
}
