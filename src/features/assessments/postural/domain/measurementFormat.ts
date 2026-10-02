/**
 * Formatação dos valores medidos para o relatório postural (pt-BR, uma casa decimal).
 *
 * O sinal dos ângulos só codifica o lado (ex.: `shoulderInclination` > 0 = ombro esquerdo mais
 * alto), e o lado já aparece no texto de evidência — por isso o relatório mostra o módulo.
 * Razões (desvio de joelho relativo à largura do corpo) viram porcentagem, nunca graus.
 */
import type { FindingKind, PosturalFinding } from './correctivePrescription.types'
import type { PosturalMetric } from './posturalAssessment.types'

const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Achados cuja métrica de origem é razão (ver `kneeTrackingDeviation*` em `metrics.ts`). */
const RATIO_FINDING_KINDS = new Set<FindingKind>(['knee_valgus', 'knee_varus'])

function formatDegrees(value: number): string {
  return `${decimal.format(Math.abs(value))}°`
}

function formatPercent(ratio: number): string {
  return `${decimal.format(Math.abs(ratio) * 100)}%`
}

export function formatFindingMeasurement(finding: PosturalFinding): string {
  return RATIO_FINDING_KINDS.has(finding.kind)
    ? formatPercent(finding.measuredValue)
    : formatDegrees(finding.measuredValue)
}

export function formatMetricValue(metric: PosturalMetric): string {
  if (metric.value === null) return '—'
  return metric.unit === 'degree' ? formatDegrees(metric.value) : formatPercent(metric.value)
}
