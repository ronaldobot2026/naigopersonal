import { describe, expect, it } from 'vitest'
import { toDomainLandmarks } from '../domain/landmarks'
import { computeMetricsForView } from '../domain/metrics'
import { POSTURAL_VIEWS } from '../domain/posturalViews'
import { evaluateCaptureQuality } from '../domain/qualityGate'
import {
  FORWARD_HEAD_SIDE_POSE,
  GOOD_FRONTAL_POSE,
  GOOD_RIGHT_SIDE_POSE,
  LOW_VISIBILITY_SHOULDERS_POSE,
  TILTED_SHOULDERS_POSE,
} from './fixtures/landmarks.fixtures'

const PASSING_QUALITY = { passed: true, score: 0.9, reasons: [] }

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
    ])
    for (const metric of metrics) {
      expect(metric.view).toBe('right_side')
      expect(metric.status).toBe('within_expected_range')
      expect(metric.value).toBeCloseTo(0, 1)
      expect(metric.automaticObservation).toMatch(/vertical/i)
    }
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
    ])
    expect(metrics.every((metric) => metric.view === 'left_side')).toBe(true)
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
