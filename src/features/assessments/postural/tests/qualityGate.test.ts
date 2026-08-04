import { describe, expect, it } from 'vitest'
import { toDomainLandmarks } from '../domain/landmarks'
import { evaluateCaptureQuality } from '../domain/qualityGate'
import {
  FRONTAL_POSE_LABELED_AS_SIDE,
  GOOD_FRONTAL_POSE,
  GOOD_RIGHT_SIDE_POSE,
  LOW_VISIBILITY_SHOULDERS_POSE,
  MISSING_LOWER_BODY_POSE,
  TOO_FAR_POSE,
} from './fixtures/landmarks.fixtures'

describe('evaluateCaptureQuality', () => {
  it('aprova uma captura frontal completa e com alta confiança', () => {
    const result = evaluateCaptureQuality(toDomainLandmarks(GOOD_FRONTAL_POSE), 'front')
    expect(result.passed).toBe(true)
    expect(result.reasons).toHaveLength(0)
    expect(result.score).toBeGreaterThanOrEqual(0.6)
  })

  it('reprova quando landmarks obrigatórios estão ausentes', () => {
    const result = evaluateCaptureQuality(toDomainLandmarks(MISSING_LOWER_BODY_POSE), 'front')
    expect(result.passed).toBe(false)
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('reprova quando a confiança dos landmarks está abaixo do mínimo', () => {
    const result = evaluateCaptureQuality(toDomainLandmarks(LOW_VISIBILITY_SHOULDERS_POSE), 'front')
    expect(result.passed).toBe(false)
    expect(result.reasons.some((reason) => reason.toLowerCase().includes('confiança'))).toBe(true)
  })

  it('reprova quando a pessoa está pequena demais no enquadramento', () => {
    const result = evaluateCaptureQuality(toDomainLandmarks(TOO_FAR_POSE), 'front')
    expect(result.passed).toBe(false)
    expect(result.reasons.some((reason) => reason.toLowerCase().includes('pequena'))).toBe(true)
  })

  it('nunca lança exceção, mesmo sem nenhum landmark detectado', () => {
    expect(() => evaluateCaptureQuality(toDomainLandmarks(undefined), 'front')).not.toThrow()
    const result = evaluateCaptureQuality(toDomainLandmarks(undefined), 'front')
    expect(result.passed).toBe(false)
  })

  it('aprova uma captura de perfil válida em ambas as laterais', () => {
    const landmarks = toDomainLandmarks(GOOD_RIGHT_SIDE_POSE)
    expect(evaluateCaptureQuality(landmarks, 'right_side').passed).toBe(true)
    expect(evaluateCaptureQuality(landmarks, 'left_side').passed).toBe(true)
  })

  it('aprova a mesma pose frontal também na vista posterior', () => {
    const result = evaluateCaptureQuality(toDomainLandmarks(GOOD_FRONTAL_POSE), 'back')
    expect(result.passed).toBe(true)
  })

  it('reprova quando a pessoa está de frente mas a vista escolhida é lateral', () => {
    const result = evaluateCaptureQuality(
      toDomainLandmarks(FRONTAL_POSE_LABELED_AS_SIDE),
      'right_side',
    )
    expect(result.passed).toBe(false)
    expect(result.reasons.some((reason) => reason.toLowerCase().includes('perfil'))).toBe(true)
  })

  it('reprova quando a pessoa está de perfil mas a vista escolhida é frontal', () => {
    const result = evaluateCaptureQuality(toDomainLandmarks(GOOD_RIGHT_SIDE_POSE), 'front')
    expect(result.passed).toBe(false)
    expect(result.reasons.some((reason) => reason.toLowerCase().includes('perfil'))).toBe(true)
  })
})
