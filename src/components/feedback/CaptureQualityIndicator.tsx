import type { CaptureQuality } from '@/features/assessments/postural/domain/posturalAssessment.types'
import { Badge } from '../ui/Badge'
import { Icon } from '../ui/Icon'

type CaptureQualityIndicatorProps = {
  quality: CaptureQuality
}

export function CaptureQualityIndicator({ quality }: CaptureQualityIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col gap-2 rounded-lg border p-4 ${quality.passed ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10'}`}
    >
      <div className="flex items-center gap-2">
        <Icon
          name={quality.passed ? 'check_circle' : 'warning'}
          filled
          className={quality.passed ? 'text-success' : 'text-warning'}
        />
        <span className="text-sm font-medium text-text-primary">
          {quality.passed ? 'Qualidade suficiente' : 'Qualidade insuficiente'}
        </span>
        <Badge tone={quality.passed ? 'success' : 'warning'} className="ml-auto">
          {Math.round(quality.score * 100)}%
        </Badge>
      </div>
      {quality.reasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-text-secondary">
          {quality.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
