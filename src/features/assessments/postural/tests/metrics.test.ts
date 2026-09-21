import { describe, expect, it } from 'vitest'
import { toDomainLandmarks } from '../domain/landmarks'
import { computeMetricsForView } from '../domain/metrics'
import { POSTURAL_VIEWS } from '../domain/posturalViews'
import { evaluateCaptureQuality } from '../domain/qualityGate'
import {
  FORWARD_HEAD_SIDE_POSE,
  GOOD_FRONTAL_POSE,
  GOOD_RIGHT_SIDE_POSE,
  KNEE_AND_PELVIS_DEVIATION_SIDE_POSE,
  KNEE_LATERAL_DEVIATION_FRONTAL_POSE,
  LOW_VISIBILITY_KNEE_SIDE_POSE,
  LOW_VISIBILITY_SHOULDERS_POSE,
  TILTED_SHOULDERS_POSE,
} from './fixtures/landmarks.fixtures'

const PASSING_QUALITY = { passed: true, score: 0.9, reasons: [] }

/** Busca uma métrica pelo sufixo do id (a parte após `${view}.`), independente da ordem no array. */
function findMetric(metrics: ReturnType<typeof computeMetricsForView>, suffix: string) {
  const metric = metrics.find((item) => item.id.endsWith(`.${suffix}`))
  if (!metric) throw new Error(`Métrica "${suffix}" não encontrada entre: ${metrics.map((m) => m.id).join(', ')}`)
  return metric
}

describe('computeMetricsForView — frente e costas', () => {
  it('marca ombros e quadris nivelados como "within_expected_range"', () => {
    const landmarks = toDomainLandmarks(GOOD_FRONTAL_POSE)
    const quality = evaluateCaptureQuality(landmarks, 'front')
    const [shoulderMetric, hipMetric] = computeMetricsForView(landmarks, quality, 'front')

    expect(shoulderMetric.status).toBe('within_expected_range')
    expect(shoulderMetric.value).toBeCloseTo(0, 1)
    expect(hipMetric.status).toBe('within_expected_range')
    expect(shoulderMetric.trainerValidation).toBe('pending')
  })

  it('marca a inclinação de ombros como "attention" quando o desvio ultrapassa o threshold', () => {
    const landmarks = toDomainLandmarks(TILTED_SHOULDERS_POSE)
    const quality = evaluateCaptureQuality(landmarks, 'front')
    const [shoulderMetric, hipMetric] = computeMetricsForView(landmarks, quality, 'front')

    expect(shoulderMetric.status).toBe('attention')
    expect(Math.abs(shoulderMetric.value ?? 0)).toBeGreaterThan(3)
    expect(shoulderMetric.automaticObservation).toMatch(/assimetria/i)
    // quadris não foram alterados nesta fixture — não devem ser afetados
    expect(hipMetric.status).toBe('within_expected_range')
  })

  it('usa as mesmas métricas na vista posterior, com ids e view próprios', () => {
    const landmarks = toDomainLandmarks(GOOD_FRONTAL_POSE)
    const metrics = computeMetricsForView(landmarks, PASSING_QUALITY, 'back')

    expect(metrics.map((metric) => metric.id)).toEqual([
      'back.shoulderInclination',
      'back.hipInclination',
      'back.kneeTrackingDeviationLeft',
      'back.kneeTrackingDeviationRight',
    ])
    expect(metrics.every((metric) => metric.view === 'back')).toBe(true)
  })

  it('retorna "not_available" para todas as métricas quando a captura não passou no quality gate', () => {
    const landmarks = toDomainLandmarks(GOOD_FRONTAL_POSE)
    const failedQuality = { passed: false, score: 0.2, reasons: ['motivo qualquer'] }
    const metrics = computeMetricsForView(landmarks, failedQuality, 'front')

    for (const metric of metrics) {
      expect(metric.status).toBe('not_available')
      expect(metric.value).toBeNull()
    }
  })

  it('marca como "low_confidence" quando a visibilidade dos pontos está abaixo do mínimo, mesmo se a captura for considerada aprovada', () => {
    const landmarks = toDomainLandmarks(LOW_VISIBILITY_SHOULDERS_POSE)
    const [shoulderMetric] = computeMetricsForView(landmarks, PASSING_QUALITY, 'front')

    expect(shoulderMetric.status).toBe('low_confidence')
    expect(shoulderMetric.automaticObservation).toMatch(/não conclusivo/i)
  })
})

describe('computeMetricsForView — vistas laterais', () => {
  it('mede cabeça e tronco contra a vertical na lateral direita', () => {
    const landmarks = toDomainLandmarks(GOOD_RIGHT_SIDE_POSE)
    const quality = evaluateCaptureQuality(landmarks, 'right_side')
    const metrics = computeMetricsForView(landmarks, quality, 'right_side')

    expect(metrics.map((metric) => metric.id)).toEqual([
      'right_side.headAlignment',
      'right_side.trunkAlignment',
      'right_side.kneeAngle',
      'right_side.pelvicTilt',
    ])
    for (const metric of metrics) {
      expect(metric.view).toBe('right_side')
      expect(metric.status).toBe('within_expected_range')
      expect(metric.value).toBeCloseTo(0, 1)
    }
    expect(findMetric(metrics, 'headAlignment').automaticObservation).toMatch(/vertical/i)
    expect(findMetric(metrics, 'trunkAlignment').automaticObservation).toMatch(/vertical/i)
    expect(findMetric(metrics, 'kneeAngle').automaticObservation).toMatch(/alinhamento esperado/i)
    expect(findMetric(metrics, 'pelvicTilt').automaticObservation).toMatch(/alinhamento esperado/i)
  })

  it('marca a cabeça projetada à frente do ombro como "attention"', () => {
    const landmarks = toDomainLandmarks(FORWARD_HEAD_SIDE_POSE)
    const quality = evaluateCaptureQuality(landmarks, 'right_side')
    const [headMetric] = computeMetricsForView(landmarks, quality, 'right_side')

    expect(headMetric.status).toBe('attention')
    expect(headMetric.value ?? 0).toBeGreaterThan(12)
  })

  it('usa os landmarks do lado esquerdo na lateral esquerda', () => {
    const landmarks = toDomainLandmarks(GOOD_RIGHT_SIDE_POSE)
    const metrics = computeMetricsForView(landmarks, PASSING_QUALITY, 'left_side')

    expect(metrics.map((metric) => metric.id)).toEqual([
      'left_side.headAlignment',
      'left_side.trunkAlignment',
      'left_side.kneeAngle',
      'left_side.pelvicTilt',
    ])
    expect(metrics.every((metric) => metric.view === 'left_side')).toBe(true)
  })
})

describe('computeMetricsForView — joelho e pelve (ângulo de três pontos)', () => {
  it('marca o ângulo do joelho como "attention" quando o alinhamento quadril–joelho–tornozelo se rompe', () => {
    const landmarks = toDomainLandmarks(KNEE_AND_PELVIS_DEVIATION_SIDE_POSE)
    const quality = evaluateCaptureQuality(landmarks, 'right_side')
    const metrics = computeMetricsForView(landmarks, quality, 'right_side')
    const kneeAngle = findMetric(metrics, 'kneeAngle')

    expect(kneeAngle.status).toBe('attention')
    expect(kneeAngle.value ?? 0).toBeGreaterThan(5)
    expect(kneeAngle.automaticObservation).toMatch(/hiperextensão ou flexão/i)
    // Não-conclusivo: não afirma qual das duas direções é.
    expect(kneeAngle.automaticObservation).not.toMatch(/diagnóstico|lesão/i)
  })

  it('marca a inclinação da pelve como "attention" quando o alinhamento ombro–quadril–joelho se rompe', () => {
    const landmarks = toDomainLandmarks(KNEE_AND_PELVIS_DEVIATION_SIDE_POSE)
    const quality = evaluateCaptureQuality(landmarks, 'right_side')
    const metrics = computeMetricsForView(landmarks, quality, 'right_side')
    const pelvicTilt = findMetric(metrics, 'pelvicTilt')

    expect(pelvicTilt.status).toBe('attention')
    expect(pelvicTilt.value ?? 0).toBeGreaterThan(10)
    expect(pelvicTilt.automaticObservation).toMatch(/inclinação da pelve/i)
  })

  it('marca "low_confidence" quando a visibilidade do joelho está abaixo do mínimo, mesmo se a captura for considerada aprovada', () => {
    const landmarks = toDomainLandmarks(LOW_VISIBILITY_KNEE_SIDE_POSE)
    const metrics = computeMetricsForView(landmarks, PASSING_QUALITY, 'right_side')
    const kneeAngle = findMetric(metrics, 'kneeAngle')

    expect(kneeAngle.status).toBe('low_confidence')
    expect(kneeAngle.automaticObservation).toMatch(/não conclusivo/i)
  })

  it('retorna "not_available" quando a captura não passa no quality gate', () => {
    const landmarks = toDomainLandmarks(GOOD_RIGHT_SIDE_POSE)
    const failedQuality = { passed: false, score: 0.2, reasons: ['motivo qualquer'] }
    const metrics = computeMetricsForView(landmarks, failedQuality, 'right_side')

    expect(findMetric(metrics, 'kneeAngle').status).toBe('not_available')
    expect(findMetric(metrics, 'pelvicTilt').status).toBe('not_available')
  })
})

describe('computeMetricsForView — rastreamento do joelho (valgo/varo)', () => {
  it('marca "within_expected_range" quando o joelho está alinhado com quadril e tornozelo', () => {
    const landmarks = toDomainLandmarks(GOOD_FRONTAL_POSE)
    const metrics = computeMetricsForView(landmarks, PASSING_QUALITY, 'front')

    expect(findMetric(metrics, 'kneeTrackingDeviationLeft').status).toBe('within_expected_range')
    expect(findMetric(metrics, 'kneeTrackingDeviationRight').status).toBe('within_expected_range')
  })

  it('marca "attention" quando o joelho se desvia lateralmente da linha quadril–tornozelo', () => {
    const landmarks = toDomainLandmarks(KNEE_LATERAL_DEVIATION_FRONTAL_POSE)
    const quality = evaluateCaptureQuality(landmarks, 'front')
    const metrics = computeMetricsForView(landmarks, quality, 'front')
    const rightKnee = findMetric(metrics, 'kneeTrackingDeviationRight')
    const leftKnee = findMetric(metrics, 'kneeTrackingDeviationLeft')

    expect(rightKnee.status).toBe('attention')
    expect(rightKnee.value ?? 0).toBeGreaterThan(0.03)
    expect(rightKnee.unit).toBe('ratio')
    expect(rightKnee.automaticObservation).toMatch(/valgo.*varo/i)
    // O joelho esquerdo não foi alterado nesta fixture — não deve ser afetado.
    expect(leftKnee.status).toBe('within_expected_range')
  })

  it('retorna "not_available" para os dois joelhos quando a captura não passa no quality gate', () => {
    const landmarks = toDomainLandmarks(GOOD_FRONTAL_POSE)
    const failedQuality = { passed: false, score: 0.2, reasons: ['motivo qualquer'] }
    const metrics = computeMetricsForView(landmarks, failedQuality, 'front')

    expect(findMetric(metrics, 'kneeTrackingDeviationLeft').status).toBe('not_available')
    expect(findMetric(metrics, 'kneeTrackingDeviationRight').status).toBe('not_available')
    expect(findMetric(metrics, 'kneeTrackingDeviationLeft').value).toBeNull()
  })
})

describe('linguagem das observações automáticas', () => {
  it('nunca usa linguagem clínica conclusiva, em nenhuma das quatro vistas', () => {
    const forbiddenTerms = /escoliose|cifose|lordose|diagnóstico|les(ã|a)o/i
    const poses = [TILTED_SHOULDERS_POSE, FORWARD_HEAD_SIDE_POSE, GOOD_FRONTAL_POSE]

    for (const view of POSTURAL_VIEWS) {
      for (const pose of poses) {
        const landmarks = toDomainLandmarks(pose)
        const quality = evaluateCaptureQuality(landmarks, view)
        for (const metric of computeMetricsForView(landmarks, quality, view)) {
          expect(metric.automaticObservation).not.toMatch(forbiddenTerms)
        }
      }
    }
  })
})
