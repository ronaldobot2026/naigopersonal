import { describe, expect, it } from 'vitest'
import type { PosturalFinding } from '../domain/correctivePrescription.types'
import type { PosturalMetric } from '../domain/posturalAssessment.types'
import { formatFindingMeasurement, formatMetricValue } from '../domain/measurementFormat'

function buildFinding(overrides: Partial<PosturalFinding>): PosturalFinding {
  return {
    id: 'finding:left_side.headAlignment',
    kind: 'head_forward',
    side: 'left',
    sourceMetricId: 'left_side.headAlignment',
    view: 'left_side',
    measuredValue: 26.63,
    thresholdValue: 12,
    evidence: 'evidência',
    targetMuscles: [],
    rationale: 'justificativa',
    ...overrides,
  }
}

function buildMetric(overrides: Partial<PosturalMetric>): PosturalMetric {
  return {
    id: 'front.shoulderInclination',
    label: 'Inclinação dos ombros',
    view: 'front',
    value: 3.14,
    unit: 'degree',
    confidence: 0.9,
    status: 'attention',
    automaticObservation: 'observação',
    trainerValidation: 'pending',
    ...overrides,
  }
}

describe('formatFindingMeasurement', () => {
  it('mostra ângulos em graus, com vírgula decimal e uma casa', () => {
    expect(formatFindingMeasurement(buildFinding({ measuredValue: 26.63 }))).toBe('26,6°')
  })

  it('usa o módulo do ângulo — o sinal só indica o lado, que já aparece no texto', () => {
    expect(
      formatFindingMeasurement(buildFinding({ kind: 'shoulder_elevation', measuredValue: -4.21 })),
    ).toBe('4,2°')
  })

  it('mostra o desvio de joelho (razão da largura do corpo) em porcentagem, não em graus', () => {
    expect(formatFindingMeasurement(buildFinding({ kind: 'knee_valgus', measuredValue: 0.042 }))).toBe(
      '4,2%',
    )
  })
})

describe('formatMetricValue', () => {
  it('formata métricas em graus', () => {
    expect(formatMetricValue(buildMetric({ value: 11.66, unit: 'degree' }))).toBe('11,7°')
  })

  it('formata razões e distâncias normalizadas em porcentagem', () => {
    expect(formatMetricValue(buildMetric({ value: 0.031, unit: 'ratio' }))).toBe('3,1%')
    expect(formatMetricValue(buildMetric({ value: 0.2, unit: 'normalized_distance' }))).toBe('20,0%')
  })

  it('mostra travessão quando a medição não pôde ser calculada', () => {
    expect(formatMetricValue(buildMetric({ value: null, status: 'not_available' }))).toBe('—')
  })
})
