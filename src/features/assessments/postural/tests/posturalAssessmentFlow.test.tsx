import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exercise } from '@/features/workouts/domain/exercise.types'
import type { FindingSuggestion } from '../domain/correctivePlan'
import type { PosturalFinding } from '../domain/correctivePrescription.types'
import type { PhotoAnalyzer } from '../domain/posturalBatchAnalysis'
import {
  POSTURAL_PROCESSING_VERSION,
  type PosturalAssessment,
  type PosturalView,
} from '../domain/posturalAssessment.types'
import { POSTURAL_VIEWS } from '../domain/posturalViews'

const publish = vi.fn()
const analyze = vi.fn<PhotoAnalyzer>()
let suggestions: FindingSuggestion[] = []

vi.mock('../hooks/usePoseLandmarker', () => ({
  usePoseLandmarker: () => ({ status: 'ready', detect: vi.fn() }),
}))

vi.mock('../services/posturalPhotoAnalyzer', () => ({
  createPosturalPhotoAnalyzer: () => analyze,
}))

vi.mock('../hooks/useCorrectivePrescription', () => ({
  useCorrectivePrescription: () => ({ status: 'ready', suggestions, errorMessage: undefined }),
}))

vi.mock('../hooks/useCaptureImage', () => ({
  useCaptureImage: () => undefined,
}))

vi.mock('../components/CameraCapture', () => ({
  CameraCapture: ({ onCaptured }: { onCaptured: (blob: Blob) => void }) => (
    <button type="button" onClick={() => onCaptured(new Blob(['camera'], { type: 'image/jpeg' }))}>
      Capturar (câmera simulada)
    </button>
  ),
}))

vi.mock('../repositories/correctivePlanRepository', () => ({
  correctivePlanRepository: {
    publish: (...args: unknown[]) => publish(...args),
  },
}))

import { PosturalAssessmentFlow } from '../components/PosturalAssessmentFlow'

function buildExercise(id: string): Exercise {
  return {
    id,
    name: `Exercício ${id}`,
    originalName: `exercise ${id}`,
    isNameTranslated: true,
    bodyPart: 'Pescoço',
    muscleGroup: 'Pescoço',
    secondaryMuscles: [],
    steps: ['Passo único.'],
    stepsLanguage: 'pt-BR',
    imageUrl: `https://cdn.example/${id}.jpg`,
    gifUrl: `https://cdn.example/${id}.gif`,
    searchText: id,
    target: 'Flexores cervicais',
    equipment: 'Peso corporal',
  }
}

function headForwardSuggestion(): FindingSuggestion {
  const finding: PosturalFinding = {
    id: 'finding:left_side.headAlignment',
    kind: 'head_forward',
    side: 'left',
    sourceMetricId: 'left_side.headAlignment',
    view: 'left_side',
    measuredValue: 26.63,
    thresholdValue: 12,
    evidence: 'cabeça (lado esquerdo) ~26.6° projetada à frente do ombro',
    targetMuscles: ['levator scapulae'],
    rationale: 'justificativa',
  }
  return { finding, selection: { exercises: [buildExercise('0001')], fallback: 'none' } }
}

function passingAnalysis(view: PosturalView): Awaited<ReturnType<PhotoAnalyzer>> {
  return {
    capture: {
      id: `capture-${view}-${Math.random()}`,
      view,
      imageReference: `assessment-1.postural.${view}`,
      createdAt: '2026-09-22T10:00:00.000Z',
      quality: { passed: true, score: 0.95, reasons: [] },
      landmarks: [],
    },
    metrics: [],
  }
}

function completeAssessment(): PosturalAssessment {
  return {
    consentAccepted: true,
    processingVersion: POSTURAL_PROCESSING_VERSION,
    metrics: [],
    captures: POSTURAL_VIEWS.map((view) => passingAnalysis(view).capture),
  }
}

function photo(name: string): File {
  return new File([name], `${name}.jpg`, { type: 'image/jpeg' })
}

/** O fluxo é controlado pelo wizard (`posturalAssessment` + `onChange`); aqui um estado local faz esse papel. */
function Harness({ initial }: { initial?: PosturalAssessment }) {
  const [assessment, setAssessment] = useState<PosturalAssessment | undefined>(initial)
  return (
    <PosturalAssessmentFlow
      assessmentId="assessment-1"
      studentId="student-1"
      evaluatorId="trainer-1"
      posturalAssessment={assessment}
      onChange={setAssessment}
    />
  )
}

async function uploadBatch(files = [photo('1'), photo('2'), photo('3'), photo('4')]) {
  await userEvent.upload(screen.getByLabelText(/selecionar as 4 fotos/i), files)
}

describe('PosturalAssessmentFlow — envio em lote e relatório automático', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    suggestions = [headForwardSuggestion()]
    analyze.mockImplementation(async (view) => passingAnalysis(view))
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('depois do consentimento vai direto para o envio das quatro fotos', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByText('Fotos da avaliação postural')).toBeInTheDocument()
    expect(screen.getByLabelText(/selecionar as 4 fotos/i)).toBeInTheDocument()
  })

  it('analisa as quatro fotos sozinho e mostra o relatório com o ângulo, sem clique extra', async () => {
    render(<Harness initial={{ ...completeAssessment(), captures: [] }} />)

    await uploadBatch()

    expect(await screen.findByText('Relatório postural')).toBeInTheDocument()
    expect(analyze.mock.calls.map(([view]) => view)).toEqual(['front', 'left_side', 'right_side', 'back'])
    expect(screen.getByRole('article', { name: 'Cabeça anteriorizada' })).toHaveTextContent('26,6°')
    expect(screen.getByRole('heading', { name: /medições por vista/i })).toBeInTheDocument()
  })

  it('não analisa enquanto faltar foto', async () => {
    render(<Harness initial={{ ...completeAssessment(), captures: [] }} />)

    await uploadBatch([photo('1'), photo('2'), photo('3')])

    expect(analyze).not.toHaveBeenCalled()
    expect(screen.getByText('Fotos da avaliação postural')).toBeInTheDocument()
  })

  it('foto recusada no quality gate: pede outra e reanalisa só aquela vista', async () => {
    analyze.mockImplementation(async (view) => {
      const result = passingAnalysis(view)
      if (view === 'right_side') {
        result.capture.quality = { passed: false, score: 0.2, reasons: ['Corpo cortado no enquadramento.'] }
      }
      return result
    })
    render(<Harness initial={{ ...completeAssessment(), captures: [] }} />)

    await uploadBatch()

    expect(await screen.findByText('Corpo cortado no enquadramento.')).toBeInTheDocument()
    expect(screen.queryByText('Relatório postural')).not.toBeInTheDocument()

    analyze.mockClear()
    analyze.mockImplementation(async (view) => passingAnalysis(view))
    await userEvent.upload(screen.getByLabelText(/foto da vista lateral direita/i), photo('nova'))

    expect(await screen.findByText('Relatório postural')).toBeInTheDocument()
    expect(analyze.mock.calls.map(([view]) => view)).toEqual(['right_side'])
  })

  it('a câmera continua disponível como opção por vista', async () => {
    const withoutBack = completeAssessment()
    withoutBack.captures = withoutBack.captures.filter((item) => item.view !== 'back')
    render(<Harness initial={withoutBack} />)

    await userEvent.click(screen.getByRole('button', { name: /câmera — vista posterior/i }))
    await userEvent.click(screen.getByRole('button', { name: /câmera simulada/i }))

    expect(await screen.findByText('Relatório postural')).toBeInTheDocument()
    expect(analyze.mock.calls.map(([view]) => view)).toEqual(['back'])
  })

  it('avaliação já completa abre direto no relatório', () => {
    render(<Harness initial={completeAssessment()} />)

    expect(screen.getByText('Relatório postural')).toBeInTheDocument()
  })

  describe('publicação do plano corretivo', () => {
    it('publica com o aluno, a avaliação e o treinador vindos do wizard', async () => {
      publish.mockResolvedValue(undefined)
      render(<Harness initial={completeAssessment()} />)

      await userEvent.click(screen.getByRole('button', { name: /publicar plano corretivo/i }))

      await screen.findByText(/plano corretivo publicado/i)
      const [plan, evaluatorId] = publish.mock.calls[0]
      expect(evaluatorId).toBe('trainer-1')
      expect(plan.studentId).toBe('student-1')
      expect(plan.assessmentId).toBe('assessment-1')
      expect(plan.items).toHaveLength(1)
    })

    it('não confirma publicação quando o repositório falha', async () => {
      publish.mockRejectedValue(new Error('permission denied for table corrective_plans'))
      render(<Harness initial={completeAssessment()} />)

      await userEvent.click(screen.getByRole('button', { name: /publicar plano corretivo/i }))

      await screen.findByText('permission denied for table corrective_plans')
      expect(screen.queryByText(/plano corretivo publicado/i)).not.toBeInTheDocument()
    })

    it('refazer fotos descarta a confirmação anterior — o relatório novo ainda não foi publicado', async () => {
      publish.mockResolvedValue(undefined)
      render(<Harness initial={completeAssessment()} />)

      await userEvent.click(screen.getByRole('button', { name: /publicar plano corretivo/i }))
      await screen.findByText(/plano corretivo publicado/i)

      await userEvent.click(screen.getByRole('button', { name: /refazer fotos/i }))
      await uploadBatch()

      await screen.findByText('Relatório postural')
      await waitFor(() => expect(analyze).toHaveBeenCalledTimes(4))
      expect(screen.queryByText(/plano corretivo publicado/i)).not.toBeInTheDocument()
    })
  })
})
