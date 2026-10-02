import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  POSTURAL_PROCESSING_VERSION,
  type PosturalAssessment,
  type PosturalMetric,
  type PosturalView,
} from '../domain/posturalAssessment.types'
import { POSTURAL_VIEWS } from '../domain/posturalViews'

vi.mock('../hooks/useCaptureImage', () => ({
  useCaptureImage: () => ({ url: 'blob:foto', width: 300, height: 400 }),
}))

// O overlay desenha em <canvas>, que o jsdom não implementa.
vi.mock('../components/SkeletonOverlay', () => ({
  SkeletonOverlay: () => <div data-testid="skeleton" />,
}))

import { PosturalViewMeasurements } from '../components/PosturalViewMeasurements'

function metric(view: PosturalView, overrides: Partial<PosturalMetric> = {}): PosturalMetric {
  return {
    id: `${view}.m`,
    label: 'Alinhamento da cabeça',
    view,
    value: 8.04,
    unit: 'degree',
    confidence: 0.91,
    status: 'within_expected_range',
    automaticObservation: 'Dentro da faixa observada.',
    trainerValidation: 'pending',
    ...overrides,
  }
}

function assessment(metrics: PosturalMetric[]): PosturalAssessment {
  return {
    consentAccepted: true,
    processingVersion: POSTURAL_PROCESSING_VERSION,
    metrics,
    captures: POSTURAL_VIEWS.map((view) => ({
      id: `capture-${view}`,
      view,
      imageReference: `a.postural.${view}`,
      createdAt: '2026-09-22T10:00:00.000Z',
      quality: { passed: true, score: 0.93, reasons: [] },
      landmarks: [],
    })),
  }
}

describe('PosturalViewMeasurements', () => {
  it('mostra as quatro vistas com a foto analisada e o skeleton sobreposto', () => {
    render(<PosturalViewMeasurements assessment={assessment([])} onMetricsChange={() => {}} />)

    expect(screen.getAllByRole('img')).toHaveLength(4)
    expect(screen.getAllByTestId('skeleton')).toHaveLength(4)
    expect(screen.getByText('Vista lateral direita')).toBeInTheDocument()
  })

  it('lista todas as medições da vista com o valor medido, não só as em atenção', () => {
    const metrics = [
      metric('left_side', { id: 'left_side.headAlignment', value: 26.63, status: 'attention' }),
      metric('left_side', { id: 'left_side.kneeAngle', label: 'Ângulo do joelho', value: 2.1 }),
    ]
    render(<PosturalViewMeasurements assessment={assessment(metrics)} onMetricsChange={() => {}} />)

    const view = screen.getByRole('region', { name: 'Vista lateral esquerda' })
    expect(within(view).getByText('26,6°')).toBeInTheDocument()
    expect(within(view).getByText('2,1°')).toBeInTheDocument()
    expect(within(view).getByText('Ângulo do joelho')).toBeInTheDocument()
  })

  it('resume cada vista: quantas medições e quantas em atenção', () => {
    const metrics = [
      metric('front', { id: 'front.a', status: 'attention' }),
      metric('front', { id: 'front.b' }),
      metric('front', { id: 'front.c' }),
    ]
    render(<PosturalViewMeasurements assessment={assessment(metrics)} onMetricsChange={() => {}} />)

    const view = screen.getByRole('region', { name: 'Vista frontal' })
    expect(view).toHaveTextContent('3 medições')
    expect(view).toHaveTextContent('1 em atenção')
  })

  it('mantém a validação do treinador por medição', () => {
    const onMetricsChange = vi.fn()
    const metrics = [metric('back', { id: 'back.shoulderInclination', status: 'attention' })]
    render(<PosturalViewMeasurements assessment={assessment(metrics)} onMetricsChange={onMetricsChange} />)

    within(screen.getByRole('region', { name: 'Vista posterior' }))
      .getByRole('button', { name: 'Rejeitar' })
      .click()

    const [updated] = onMetricsChange.mock.calls[0] as [PosturalAssessment]
    expect(updated.metrics).toEqual([
      expect.objectContaining({ id: 'back.shoulderInclination', trainerValidation: 'rejected' }),
    ])
    expect(updated.captures).toHaveLength(4)
  })
})
