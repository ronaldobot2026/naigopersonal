import { describe, expect, it, vi } from 'vitest'
import {
  analyzePosturalPhotos,
  assignPhotosToViews,
  isReadyForAutomaticAnalysis,
  type PhotoAnalyzer,
} from '../domain/posturalBatchAnalysis'
import {
  POSTURAL_PROCESSING_VERSION,
  type PosturalAssessment,
  type PosturalCapture,
  type PosturalMetric,
  type PosturalView,
} from '../domain/posturalAssessment.types'

function photo(name: string): Blob {
  return new Blob([name], { type: 'image/jpeg' })
}

function capture(view: PosturalView, passed = true): PosturalCapture {
  return {
    id: `capture-${view}`,
    view,
    imageReference: `a.postural.${view}`,
    createdAt: '2026-09-22T10:00:00.000Z',
    quality: { passed, score: passed ? 0.9 : 0.3, reasons: passed ? [] : ['Corpo cortado'] },
    landmarks: [],
  }
}

function metric(view: PosturalView): PosturalMetric {
  return {
    id: `${view}.m`,
    label: 'Métrica',
    view,
    value: 1,
    unit: 'degree',
    confidence: 0.9,
    status: 'within_expected_range',
    automaticObservation: 'ok',
    trainerValidation: 'pending',
  }
}

function assessmentWith(captures: PosturalCapture[]): PosturalAssessment {
  return {
    consentAccepted: true,
    captures,
    metrics: captures.map((item) => metric(item.view)),
    processingVersion: POSTURAL_PROCESSING_VERSION,
  }
}

const okAnalyzer: PhotoAnalyzer = async (view) => ({ capture: capture(view), metrics: [metric(view)] })

describe('assignPhotosToViews', () => {
  it('distribui um lote de quatro fotos na ordem frente, lateral esq., lateral dir., costas', () => {
    const files = [photo('1'), photo('2'), photo('3'), photo('4')]
    expect(assignPhotosToViews(files, undefined, {})).toEqual({
      front: files[0],
      left_side: files[1],
      right_side: files[2],
      back: files[3],
    })
  })

  it('um lote de quatro substitui todas as vistas, mesmo as já aprovadas (refazer tudo)', () => {
    const files = [photo('1'), photo('2'), photo('3'), photo('4')]
    const complete = assessmentWith(['front', 'left_side', 'right_side', 'back'].map((v) => capture(v as PosturalView)))
    expect(Object.keys(assignPhotosToViews(files, complete, {}))).toEqual([
      'front',
      'left_side',
      'right_side',
      'back',
    ])
  })

  it('com menos de quatro, preenche só as vistas em aberto, sem sobrescrever aprovada nem já escolhida', () => {
    const assessment = assessmentWith([capture('front'), capture('right_side', false)])
    const pending = { left_side: photo('pendente') }
    const files = [photo('a'), photo('b')]

    expect(assignPhotosToViews(files, assessment, pending)).toEqual({
      right_side: files[0],
      back: files[1],
    })
  })
})

describe('isReadyForAutomaticAnalysis', () => {
  it('fica pronto quando cada vista tem foto nova ou captura aprovada', () => {
    const assessment = assessmentWith([capture('front'), capture('left_side')])
    expect(
      isReadyForAutomaticAnalysis(assessment, { right_side: photo('r'), back: photo('b') }),
    ).toBe(true)
  })

  it('não dispara com vista faltando nem com captura reprovada sem foto nova', () => {
    expect(isReadyForAutomaticAnalysis(undefined, { front: photo('f') })).toBe(false)
    const assessment = assessmentWith([capture('front'), capture('left_side'), capture('right_side', false)])
    expect(isReadyForAutomaticAnalysis(assessment, { back: photo('b') })).toBe(false)
  })

  it('não dispara sem nenhuma foto nova — nada a analisar', () => {
    const complete = assessmentWith(['front', 'left_side', 'right_side', 'back'].map((v) => capture(v as PosturalView)))
    expect(isReadyForAutomaticAnalysis(complete, {})).toBe(false)
  })
})

describe('analyzePosturalPhotos', () => {
  it('analisa as quatro fotos em sequência e monta a avaliação completa', async () => {
    const analyze = vi.fn(okAnalyzer)
    const onViewStart = vi.fn()
    const photos = { front: photo('f'), left_side: photo('l'), right_side: photo('r'), back: photo('b') }

    const outcome = await analyzePosturalPhotos(undefined, photos, analyze, onViewStart)

    expect(analyze.mock.calls.map(([view]) => view)).toEqual(['front', 'left_side', 'right_side', 'back'])
    expect(onViewStart.mock.calls.map(([view]) => view)).toEqual(['front', 'left_side', 'right_side', 'back'])
    expect(outcome.errors).toEqual({})
    expect(outcome.assessment.consentAccepted).toBe(true)
    expect(outcome.assessment.captures.map((item) => item.view).sort()).toEqual(
      ['back', 'front', 'left_side', 'right_side'],
    )
    expect(outcome.assessment.metrics).toHaveLength(4)
  })

  it('preserva as vistas já analisadas e reprocessa só as fotos novas', async () => {
    const base = assessmentWith([capture('front'), capture('left_side'), capture('right_side')])
    const analyze = vi.fn(okAnalyzer)

    const outcome = await analyzePosturalPhotos(base, { back: photo('b') }, analyze)

    expect(analyze).toHaveBeenCalledTimes(1)
    expect(outcome.assessment.captures).toHaveLength(4)
  })

  it('uma foto que falha no processamento não derruba as outras', async () => {
    const analyze: PhotoAnalyzer = async (view) => {
      if (view === 'left_side') throw new Error('decode falhou')
      return okAnalyzer(view, photo(view))
    }
    const photos = { front: photo('f'), left_side: photo('l'), right_side: photo('r'), back: photo('b') }

    const outcome = await analyzePosturalPhotos(undefined, photos, analyze)

    expect(Object.keys(outcome.errors)).toEqual(['left_side'])
    expect(outcome.errors.left_side).toMatch(/não foi possível processar/i)
    expect(outcome.assessment.captures.map((item) => item.view)).not.toContain('left_side')
    expect(outcome.assessment.captures).toHaveLength(3)
  })
})
