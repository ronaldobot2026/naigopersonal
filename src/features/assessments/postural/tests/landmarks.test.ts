import { describe, expect, it } from 'vitest'
import { toDomainLandmarks } from '../domain/landmarks'
import { GOOD_FRONTAL_POSE, MISSING_LOWER_BODY_POSE } from './fixtures/landmarks.fixtures'

describe('toDomainLandmarks', () => {
  it('converte o array bruto indexado em um mapa por nome semântico', () => {
    const landmarks = toDomainLandmarks(GOOD_FRONTAL_POSE)
    expect(landmarks.leftShoulder).toEqual({ x: 0.4, y: 0.3, z: undefined, visibility: 0.95 })
    expect(landmarks.rightAnkle).toBeDefined()
  })

  it('retorna undefined para landmarks fora do array (sem lançar erro)', () => {
    const landmarks = toDomainLandmarks(MISSING_LOWER_BODY_POSE)
    expect(landmarks.leftHip).toBeUndefined()
    expect(landmarks.leftKnee).toBeUndefined()
    expect(landmarks.leftAnkle).toBeUndefined()
    // pontos presentes no array truncado continuam disponíveis
    expect(landmarks.leftShoulder).toBeDefined()
  })

  it('lida com entrada nula/indefinida sem lançar erro', () => {
    expect(() => toDomainLandmarks(undefined)).not.toThrow()
    expect(() => toDomainLandmarks(null)).not.toThrow()
    const landmarks = toDomainLandmarks(undefined)
    expect(landmarks.nose).toBeUndefined()
  })
})
