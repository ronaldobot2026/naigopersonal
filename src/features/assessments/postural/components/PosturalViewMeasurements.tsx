import { CaptureQualityIndicator } from '@/components/feedback/CaptureQualityIndicator'
import { Card } from '@/components/ui/Card'
import { toDomainLandmarks } from '../domain/landmarks'
import type {
  PosturalAssessment,
  PosturalCapture,
  PosturalMetric,
} from '../domain/posturalAssessment.types'
import { getCaptureForView, getMetricsForView, replaceMetrics } from '../domain/posturalSession'
import { POSTURAL_VIEWS, getPosturalViewDefinition } from '../domain/posturalViews'
import { useCaptureImage } from '../hooks/useCaptureImage'
import { MetricsReview } from './MetricsReview'
import { SkeletonOverlay } from './SkeletonOverlay'

type PosturalViewMeasurementsProps = {
  assessment: PosturalAssessment
  onMetricsChange: (assessment: PosturalAssessment) => void
}

function CapturePhoto({ capture }: { capture: PosturalCapture }) {
  const image = useCaptureImage(capture)
  const label = getPosturalViewDefinition(capture.view).label.toLowerCase()
  if (!image) {
    return <div className="aspect-3/4 w-full rounded-md border border-border bg-surface-high" />
  }
  return (
    <div className="relative w-full overflow-hidden rounded-md border border-border">
      <img src={image.url} alt={`Foto analisada — ${label}`} className="w-full" />
      <SkeletonOverlay
        landmarks={toDomainLandmarks(capture.landmarks)}
        view={capture.view}
        width={image.width}
        height={image.height}
        showSkeleton
        showReferenceLines
      />
    </div>
  )
}

function summarize(metrics: PosturalMetric[]): string {
  const attention = metrics.filter((metric) => metric.status === 'attention').length
  const total = metrics.length === 1 ? '1 medição' : `${metrics.length} medições`
  return `${total} · ${attention} em atenção`
}

/**
 * Parte "completa" do relatório postural: para cada uma das quatro vistas, a foto analisada com
 * skeleton e linhas de referência, o resultado do quality gate e TODAS as medições da vista (não
 * só as que viraram ponto de atenção), com o valor medido e a validação do treinador.
 */
export function PosturalViewMeasurements({
  assessment,
  onMetricsChange,
}: PosturalViewMeasurementsProps) {
  return (
    <div className="flex flex-col gap-3">
      {POSTURAL_VIEWS.map((view) => {
        const definition = getPosturalViewDefinition(view)
        const capture = getCaptureForView(assessment, view)
        const metrics = getMetricsForView(assessment, view)
        const titleId = `view-measurements-${view}`
        return (
          <Card key={view} tone="glass">
            <section aria-labelledby={titleId} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h5 id={titleId} className="font-bold text-text-primary">
                  {definition.label}
                </h5>
                <span className="font-mono text-xs uppercase tracking-wider text-text-secondary">
                  {summarize(metrics)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                {capture && (
                  <div className="flex flex-col gap-2">
                    <CapturePhoto capture={capture} />
                    <CaptureQualityIndicator quality={capture.quality} />
                  </div>
                )}
                <MetricsReview
                  metrics={metrics}
                  onChange={(updated) => onMetricsChange(replaceMetrics(assessment, updated))}
                />
              </div>
            </section>
          </Card>
        )
      })}
    </div>
  )
}
