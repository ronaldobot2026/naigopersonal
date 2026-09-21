import { describe, expect, it } from 'vitest'
import {
  CORRECTIVE_TARGET_LINKS,
  deriveFindingsFromMetrics,
} from '../domain/correctivePrescription'
import type { FindingKind } from '../domain/correctivePrescription.types'
import type { PosturalMetric } from '../domain/posturalAssessment.types'

function buildMetric(overrides: Partial<PosturalMetric> & Pick<PosturalMetric, 'id' | 'view'>): PosturalMetric {
  return {
    label: 'Métrica de teste',
    value: 10,
    unit: 'degree',
    confidence: 0.9,
    status: 'attention',
    automaticObservation: 'Indicador visual não conclusivo. Requer validação do profissional.',
    trainerValidation: 'pending',
    ...overrides,
  }
}

describe('CORRECTIVE_TARGET_LINKS', () => {
  it('cobre os 10 achados da spec, cada um com alvos e justificativa', () => {
    const kinds: FindingKind[] = [
      'shoulder_elevation',
      'shoulder_depression',
      'hip_inclination',
      'head_forward',
      'trunk_lateral_deviation',
      'knee_hyperextension',
      'knee_valgus',
      'knee_varus',
      'pelvic_tilt_anterior',
      'pelvic_tilt_posterior',
    ]

    for (const kind of kinds) {
      const link = CORRECTIVE_TARGET_LINKS[kind]
      expect(link.targetMuscles.length).toBeGreaterThan(0)
      expect(link.rationale.length).toBeGreaterThan(0)
    }
  })

  it('vincula ombro elevado a trapézio/levantador da escápula/deltoides, como pedido no áudio', () => {
    expect(CORRECTIVE_TARGET_LINKS.shoulder_elevation.targetMuscles).toEqual([
      'traps',
      'levator scapulae',
      'delts',
    ])
  })
})

describe('deriveFindingsFromMetrics', () => {
  it('ignora métricas que não estão em "attention"', () => {
    const metric = buildMetric({ id: 'front.shoulderInclination', view: 'front', status: 'within_expected_range' })
    expect(deriveFindingsFromMetrics([metric])).toEqual([])
  })

  it('ignora métricas sem valor numérico', () => {
    const metric = buildMetric({ id: 'front.shoulderInclination', view: 'front', value: null, status: 'attention' })
    expect(deriveFindingsFromMetrics([metric])).toEqual([])
  })

  it('ignora métricas sem regra de vínculo definida, sem lançar erro', () => {
    const metric = buildMetric({ id: 'front.unknownMetric', view: 'front' })
    expect(() => deriveFindingsFromMetrics([metric])).not.toThrow()
    expect(deriveFindingsFromMetrics([metric])).toEqual([])
  })

  it('deriva ombro elevado do lado esquerdo quando o valor é positivo', () => {
    const metric = buildMetric({ id: 'front.shoulderInclination', view: 'front', value: 4.2 })
    const [finding] = deriveFindingsFromMetrics([metric])

    expect(finding.kind).toBe('shoulder_elevation')
    expect(finding.side).toBe('left')
    expect(finding.sourceMetricId).toBe('front.shoulderInclination')
    expect(finding.measuredValue).toBe(4.2)
    expect(finding.thresholdValue).toBe(3)
    expect(finding.evidence).toBe('ombro esquerdo ~4.2° acima da linha dos ombros')
    expect(finding.targetMuscles).toEqual(CORRECTIVE_TARGET_LINKS.shoulder_elevation.targetMuscles)
    expect(finding.rationale).toBe(CORRECTIVE_TARGET_LINKS.shoulder_elevation.rationale)
  })

  it('deriva ombro elevado do lado direito quando o valor é negativo', () => {
    const metric = buildMetric({ id: 'back.shoulderInclination', view: 'back', value: -5 })
    const [finding] = deriveFindingsFromMetrics([metric])

    expect(finding.side).toBe('right')
    expect(finding.evidence).toMatch(/ombro direito/)
  })

  it('deriva inclinação de quadril como achado bilateral', () => {
    const metric = buildMetric({ id: 'front.hipInclination', view: 'front', value: 3.5 })
    const [finding] = deriveFindingsFromMetrics([metric])

    expect(finding.kind).toBe('hip_inclination')
    expect(finding.side).toBe('bilateral')
  })

  it('deriva cabeça anteriorizada com o lado da vista lateral', () => {
    const metric = buildMetric({ id: 'left_side.headAlignment', view: 'left_side', value: 14 })
    const [finding] = deriveFindingsFromMetrics([metric])

    expect(finding.kind).toBe('head_forward')
    expect(finding.side).toBe('left')
  })

  it('deriva hiperextensão de joelho a partir de kneeAngle, sem afirmar a direção', () => {
    const metric = buildMetric({ id: 'right_side.kneeAngle', view: 'right_side', value: 12 })
    const [finding] = deriveFindingsFromMetrics([metric])

    expect(finding.kind).toBe('knee_hyperextension')
    expect(finding.side).toBe('right')
    expect(finding.targetMuscles).toEqual(['hamstrings', 'glutes', 'quads'])
    expect(finding.evidence).not.toMatch(/diagnóstico|lesão/i)
  })

  it('deriva joelho valgo a partir de kneeTrackingDeviation, com evidência em porcentagem', () => {
    const metric = buildMetric({
      id: 'front.kneeTrackingDeviationRight',
      view: 'front',
      value: 0.4,
      unit: 'ratio',
    })
    const [finding] = deriveFindingsFromMetrics([metric])

    expect(finding.kind).toBe('knee_valgus')
    expect(finding.side).toBe('right')
    expect(finding.evidence).toBe('joelho direito com desvio lateral de ~40.0% da largura do corpo')
  })

  it('deriva múltiplos achados de uma lista de métricas, preservando a ordem', () => {
    const metrics = [
      buildMetric({ id: 'front.shoulderInclination', view: 'front', value: 4 }),
      buildMetric({ id: 'front.hipInclination', view: 'front', status: 'within_expected_range' }),
      buildMetric({ id: 'right_side.kneeAngle', view: 'right_side', value: 10 }),
    ]

    const findings = deriveFindingsFromMetrics(metrics)
    expect(findings.map((finding) => finding.kind)).toEqual(['shoulder_elevation', 'knee_hyperextension'])
  })
})
