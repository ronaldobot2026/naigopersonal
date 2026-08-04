import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { PosturalMetric } from '@/features/assessments/postural/domain/posturalAssessment.types'
import {
  getCapturedViews,
  getMetricsForView,
} from '@/features/assessments/postural/domain/posturalSession'
import {
  POSTURAL_VIEWS,
  getPosturalViewDefinition,
} from '@/features/assessments/postural/domain/posturalViews'
import type { PhysicalAssessment, Student } from '@/types/domain'

type ReviewStepProps = {
  assessment: PhysicalAssessment
  student: Student
  onComplete: () => Promise<void>
}

const METRIC_STATUS_TONE: Record<PosturalMetric['status'], 'success' | 'warning' | 'neutral'> = {
  within_expected_range: 'success',
  attention: 'warning',
  low_confidence: 'neutral',
  not_available: 'neutral',
}

function formatValue(value: number | null, unit: string): string {
  return value === null ? '—' : `${value}${unit}`
}

function formatValidation(metric: PosturalMetric): string {
  return metric.trainerValidation === 'pending' ? 'Pendente de validação' : metric.trainerValidation
}

export function ReviewStep({ assessment, student, onComplete }: ReviewStepProps) {
  const postural = assessment.posturalAssessment
  const capturedViews = getCapturedViews(postural)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-3 font-display text-lg text-text-primary">Resumo</h3>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-text-secondary">Aluno</dt>
            <dd className="text-text-primary">{student.name}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Peso</dt>
            <dd className="text-text-primary">
              {formatValue(assessment.biometrics.weightKg, 'kg')}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Altura</dt>
            <dd className="text-text-primary">
              {formatValue(assessment.biometrics.heightCm, 'cm')}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Fotos de registro</dt>
            <dd className="text-text-primary">{assessment.visualRecords.length} de 4</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg text-text-primary">Avaliação postural</h3>
          <span className="font-mono text-xs uppercase tracking-wider text-text-secondary">
            {capturedViews.length} de {POSTURAL_VIEWS.length} vistas
          </span>
        </div>
        {capturedViews.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhuma captura postural registrada ainda.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {POSTURAL_VIEWS.map((view) => {
              const metrics = getMetricsForView(postural, view)
              if (metrics.length === 0) return null

              return (
                <div key={view} className="flex flex-col gap-2">
                  <p className="font-mono text-xs uppercase tracking-wider text-text-secondary">
                    {getPosturalViewDefinition(view).label}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {metrics.map((metric) => (
                      <li
                        key={metric.id}
                        className="flex items-center justify-between gap-4 text-sm"
                      >
                        <span className="text-text-primary">{metric.label}</span>
                        <Badge tone={METRIC_STATUS_TONE[metric.status]}>
                          {formatValidation(metric)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {assessment.status === 'completed' ? (
        <Badge tone="success" className="w-fit">
          Avaliação concluída
        </Badge>
      ) : (
        <Button onClick={() => void onComplete()} className="self-end">
          Concluir avaliação
        </Button>
      )}
    </div>
  )
}
