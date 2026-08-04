import { describe, expect, it } from 'vitest'
import type {
  PosturalAssessment,
  PosturalCapture,
  PosturalMetric,
  PosturalView,
} from '../domain/posturalAssessment.types'
import {
  createEmptyPosturalAssessment,
  getCapturedViews,
  getMetricsForView,
  getPendingViews,
  isPosturalAssessmentComplete,
  replaceMetrics,
  upsertViewCapture,
} from '../domain/posturalSession'
import { POSTURAL_VIEWS } from '../domain/posturalViews'

function buildCapture(view: PosturalView, passed = true): PosturalCapture {
  return {
    id: `capture-${view}-${passed ? 'ok' : 'low'}`,
    view,
    imageReference: `assessment-1.postural.${view}`,
    createdAt: '2026-08-03T12:00:00.000Z',
    quality: { passed, score: passed ? 0.9 : 0.2, reasons: passed ? [] : ['motivo'] },
    landmarks: [],
  }
}

function buildMetric(view: PosturalView, suffix: string): PosturalMetric {
  return {
    id: `${view}.${suffix}`,
    label: suffix,
    view,
    value: 1,
    unit: 'degree',
    confidence: 0.9,
    status: 'within_expected_range',
    automaticObservation: 'observação',
    trainerValidation: 'pending',
  }
}

function assessmentWithViews(views: readonly PosturalView[]): PosturalAssessment {
  return views.reduce<PosturalAssessment>(
    (assessment, view) =>
      upsertViewCapture(assessment, buildCapture(view), [buildMetric(view, 'metricaA')]),
    createEmptyPosturalAssessment(),
  )
}

describe('upsertViewCapture', () => {
  it('acumula as quatro vistas sem sobrescrever as anteriores', () => {
    const assessment = assessmentWithViews(POSTURAL_VIEWS)

    expect(assessment.captures).toHaveLength(4)
    expect(getCapturedViews(assessment)).toEqual(POSTURAL_VIEWS)
    expect(assessment.metrics).toHaveLength(4)
  })

  it('substitui apenas a vista recapturada, preservando as métricas das demais', () => {
    const assessment = assessmentWithViews(['front', 'back'])
    const validated: PosturalMetric = {
      ...buildMetric('back', 'metricaA'),
      trainerValidation: 'accepted',
    }
    const withValidation = replaceMetrics(assessment, [validated])

    const recaptured = upsertViewCapture(withValidation, buildCapture('front'), [
      buildMetric('front', 'metricaB'),
    ])

    expect(recaptured.captures).toHaveLength(2)
    expect(getMetricsForView(recaptured, 'front').map((metric) => metric.id)).toEqual([
      'front.metricaB',
    ])
    expect(getMetricsForView(recaptured, 'back')[0].trainerValidation).toBe('accepted')
  })

  it('não muta a avaliação original', () => {
    const assessment = assessmentWithViews(['front'])
    const snapshot = JSON.stringify(assessment)

    upsertViewCapture(assessment, buildCapture('back'), [buildMetric('back', 'metricaA')])

    expect(JSON.stringify(assessment)).toBe(snapshot)
  })

  it('marca o consentimento como aceito ao registrar a primeira captura', () => {
    const assessment = upsertViewCapture(undefined, buildCapture('front'), [])
    expect(assessment.consentAccepted).toBe(true)
  })
})

describe('progresso da sessão', () => {
  it('só considera completa com as quatro vistas aprovadas', () => {
    const partial = assessmentWithViews(['front', 'left_side', 'right_side'])
    expect(isPosturalAssessmentComplete(partial)).toBe(false)
    expect(getPendingViews(partial)).toEqual(['back'])

    const complete = assessmentWithViews(POSTURAL_VIEWS)
    expect(isPosturalAssessmentComplete(complete)).toBe(true)
    expect(getPendingViews(complete)).toEqual([])
  })

  it('mantém pendente a vista cuja captura foi reprovada no quality gate', () => {
    const assessment = upsertViewCapture(
      assessmentWithViews(['front', 'left_side', 'right_side']),
      buildCapture('back', false),
      [],
    )

    expect(getCapturedViews(assessment)).toContain('back')
    expect(getPendingViews(assessment)).toEqual(['back'])
    expect(isPosturalAssessmentComplete(assessment)).toBe(false)
  })

  it('trata uma avaliação inexistente como incompleta', () => {
    expect(isPosturalAssessmentComplete(undefined)).toBe(false)
    expect(getCapturedViews(undefined)).toEqual([])
    expect(getMetricsForView(undefined, 'front')).toEqual([])
  })
})
