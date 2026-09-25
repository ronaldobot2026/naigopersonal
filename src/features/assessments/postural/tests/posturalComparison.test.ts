import { describe, expect, it } from 'vitest'
import type { PhysicalAssessment } from '@/types/domain'
import type { PosturalAssessment, PosturalMetric } from '../domain/posturalAssessment.types'
import {
  comparePosturalAssessments,
  selectComparablePair,
} from '../domain/posturalComparison'

function metric(id: string, value: number | null, overrides: Partial<PosturalMetric> = {}): PosturalMetric {
  const [view] = id.split('.')
  return {
    id,
    label: id,
    view: view as PosturalMetric['view'],
    value,
    unit: id.includes('kneeTracking') ? 'ratio' : 'degree',
    confidence: 0.9,
    status: value === null ? 'not_available' : 'within_expected_range',
    automaticObservation: '',
    trainerValidation: 'pending',
    ...overrides,
  }
}

function postural(metrics: PosturalMetric[]): PosturalAssessment {
  return { consentAccepted: true, captures: [], metrics, processingVersion: 'teste' }
}

function assessment(
  id: string,
  createdAt: string,
  overrides: Partial<PhysicalAssessment> = {},
): PhysicalAssessment {
  return {
    id,
    studentId: 'aluno-1',
    evaluatorId: 'personal-1',
    createdAt,
    updatedAt: createdAt,
    status: 'completed',
    biometrics: {} as PhysicalAssessment['biometrics'],
    anthropometry: {} as PhysicalAssessment['anthropometry'],
    visualRecords: [],
    ...overrides,
  }
}

describe('selectComparablePair', () => {
  it('encadeia por createdAt decrescente, ignorando updatedAt', () => {
    const antiga = assessment('a', '2026-01-01T00:00:00.000Z', {
      // updatedAt recente de propósito: reabrir para conferir não pode promover a avaliação.
      updatedAt: '2026-09-30T00:00:00.000Z',
    })
    const recente = assessment('b', '2026-02-01T00:00:00.000Z')

    const { current, previous } = selectComparablePair([antiga, recente])

    expect(current?.id).toBe('b')
    expect(previous?.id).toBe('a')
  })

  it('deixa rascunho fora do encadeamento', () => {
    const rascunho = assessment('draft', '2026-03-01T00:00:00.000Z', { status: 'draft' })
    const concluida1 = assessment('c1', '2026-02-01T00:00:00.000Z')
    const concluida2 = assessment('c2', '2026-01-01T00:00:00.000Z')

    const { current, previous } = selectComparablePair([rascunho, concluida1, concluida2])

    expect(current?.id).toBe('c1')
    expect(previous?.id).toBe('c2')
  })

  it('devolve previous nulo quando só existe uma avaliação concluída', () => {
    expect(selectComparablePair([assessment('c1', '2026-01-01T00:00:00.000Z')]).previous).toBeNull()
  })
})

describe('comparePosturalAssessments', () => {
  it('sinaliza quando não há avaliação anterior', () => {
    const atual = assessment('c1', '2026-02-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('left_side.pelvicTilt', 5)]),
    })
    expect(comparePosturalAssessments(atual, null)).toEqual({ kind: 'no_previous' })
  })

  it('sinaliza quando a atual não tem avaliação postural', () => {
    expect(comparePosturalAssessments(assessment('c1', '2026-02-01T00:00:00.000Z'), null)).toEqual({
      kind: 'current_without_postural',
    })
  })

  it('sinaliza explicitamente quando a anterior não tem avaliação postural', () => {
    const atual = assessment('c1', '2026-02-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('left_side.pelvicTilt', 5)]),
    })
    const anterior = assessment('c0', '2026-01-01T00:00:00.000Z')

    expect(comparePosturalAssessments(atual, anterior)).toEqual({
      kind: 'previous_without_postural',
      previousCreatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('compara pelo MÓDULO: sinal codifica lado, não gravidade', () => {
    const atual = assessment('c1', '2026-02-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('left_side.pelvicTilt', 2)]),
    })
    const anterior = assessment('c0', '2026-01-01T00:00:00.000Z', {
      // -8° é desvio de 8° para o outro lado: mudar para +2° é REDUÇÃO de desvio.
      posturalAssessment: postural([metric('left_side.pelvicTilt', -8)]),
    })

    const resultado = comparePosturalAssessments(atual, anterior)
    if (resultado.kind !== 'available') throw new Error('esperava comparação disponível')
    const pelve = resultado.metrics.find((m) => m.id === 'left_side.pelvicTilt')

    expect(pelve?.delta).toBe(-6)
    expect(pelve?.direction).toBe('improved')
  })

  it('marca piora quando o módulo do desvio cresce', () => {
    const atual = assessment('c1', '2026-02-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('left_side.headAlignment', -12)]),
    })
    const anterior = assessment('c0', '2026-01-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('left_side.headAlignment', 4)]),
    })

    const resultado = comparePosturalAssessments(atual, anterior)
    if (resultado.kind !== 'available') throw new Error('esperava comparação disponível')
    expect(resultado.metrics[0]?.direction).toBe('worsened')
    expect(resultado.metrics[0]?.delta).toBe(8)
  })

  it('trata variação abaixo do ruído de captura como estável', () => {
    const atual = assessment('c1', '2026-02-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('left_side.kneeAngle', 5.3)]),
    })
    const anterior = assessment('c0', '2026-01-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('left_side.kneeAngle', 5)]),
    })

    const resultado = comparePosturalAssessments(atual, anterior)
    if (resultado.kind !== 'available') throw new Error('esperava comparação disponível')
    expect(resultado.metrics[0]?.direction).toBe('stable')
  })

  it('usa limiar de razão (e não de grau) para o rastreamento de joelho', () => {
    const atual = assessment('c1', '2026-02-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('front.kneeTrackingDeviationLeft', 0.09)]),
    })
    const anterior = assessment('c0', '2026-01-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('front.kneeTrackingDeviationLeft', 0.05)]),
    })

    const resultado = comparePosturalAssessments(atual, anterior)
    if (resultado.kind !== 'available') throw new Error('esperava comparação disponível')
    expect(resultado.metrics[0]?.unit).toBe('ratio')
    expect(resultado.metrics[0]?.direction).toBe('worsened')
  })

  it('não conclui nada quando uma das leituras tem baixa confiança', () => {
    const atual = assessment('c1', '2026-02-01T00:00:00.000Z', {
      posturalAssessment: postural([
        metric('left_side.pelvicTilt', 2, { status: 'low_confidence', confidence: 0.2 }),
      ]),
    })
    const anterior = assessment('c0', '2026-01-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('left_side.pelvicTilt', 9)]),
    })

    const resultado = comparePosturalAssessments(atual, anterior)
    if (resultado.kind !== 'available') throw new Error('esperava comparação disponível')
    expect(resultado.metrics[0]?.direction).toBe('inconclusive')
    expect(resultado.metrics[0]?.lowConfidence).toBe(true)
    expect(resultado.metrics[0]?.delta).toBeNull()
    expect(resultado.metrics[0]?.note).toContain('não conclusiva')
  })

  it('não inventa delta quando um valor é nulo', () => {
    const atual = assessment('c1', '2026-02-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('left_side.kneeAngle', null)]),
    })
    const anterior = assessment('c0', '2026-01-01T00:00:00.000Z', {
      posturalAssessment: postural([metric('left_side.kneeAngle', 7)]),
    })

    const resultado = comparePosturalAssessments(atual, anterior)
    if (resultado.kind !== 'available') throw new Error('esperava comparação disponível')
    expect(resultado.metrics[0]?.currentValue).toBeNull()
    expect(resultado.metrics[0]?.delta).toBeNull()
    expect(resultado.metrics[0]?.direction).toBe('inconclusive')
  })

  it('ignora métricas fora do escopo (ombro/tronco) e mantém as de joelho, pelve e cabeça', () => {
    const metrics = [
      metric('left_side.shoulderInclination', 3),
      metric('left_side.trunkAlignment', 3),
      metric('left_side.pelvicTilt', 3),
      metric('left_side.headAlignment', 3),
      metric('left_side.kneeAngle', 3),
      metric('front.kneeTrackingDeviationLeft', 0.02),
      metric('front.kneeTrackingDeviationRight', 0.02),
    ]
    const atual = assessment('c1', '2026-02-01T00:00:00.000Z', { posturalAssessment: postural(metrics) })
    const anterior = assessment('c0', '2026-01-01T00:00:00.000Z', { posturalAssessment: postural(metrics) })

    const resultado = comparePosturalAssessments(atual, anterior)
    if (resultado.kind !== 'available') throw new Error('esperava comparação disponível')
    const ids = resultado.metrics.map((m) => m.id)

    expect(ids).not.toContain('left_side.shoulderInclination')
    expect(ids).not.toContain('left_side.trunkAlignment')
    expect(ids).toEqual(
      expect.arrayContaining([
        'left_side.pelvicTilt',
        'left_side.headAlignment',
        'left_side.kneeAngle',
        'front.kneeTrackingDeviationLeft',
        'front.kneeTrackingDeviationRight',
      ]),
    )
    expect(resultado.metrics.every((m) => m.direction === 'stable')).toBe(true)
  })
})
