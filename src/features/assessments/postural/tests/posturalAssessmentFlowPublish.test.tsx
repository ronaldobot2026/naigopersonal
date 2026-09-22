import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exercise } from '@/features/workouts/domain/exercise.types'
import type { FindingSuggestion } from '../domain/correctivePlan'
import type { PosturalFinding } from '../domain/correctivePrescription.types'
import { POSTURAL_PROCESSING_VERSION, type PosturalAssessment } from '../domain/posturalAssessment.types'
import { POSTURAL_VIEWS } from '../domain/posturalViews'

const publish = vi.fn()
let suggestions: FindingSuggestion[] = []

vi.mock('../hooks/usePoseLandmarker', () => ({
  usePoseLandmarker: () => ({ status: 'ready', detect: vi.fn() }),
}))

vi.mock('../hooks/useCorrectivePrescription', () => ({
  useCorrectivePrescription: () => ({ status: 'ready', suggestions, errorMessage: undefined }),
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
    bodyPart: 'Ombros',
    muscleGroup: 'Ombros',
    secondaryMuscles: [],
    steps: ['Passo único.'],
    stepsLanguage: 'pt-BR',
    imageUrl: `https://cdn.example/${id}.jpg`,
    gifUrl: `https://cdn.example/${id}.gif`,
    searchText: id,
    target: 'Trapézio',
    equipment: 'Halteres',
  }
}

function buildSuggestion(): FindingSuggestion {
  const finding: PosturalFinding = {
    id: 'finding:front.shoulderInclination',
    kind: 'shoulder_elevation',
    side: 'right',
    sourceMetricId: 'front.shoulderInclination',
    view: 'front',
    measuredValue: 4.2,
    thresholdValue: 3,
    evidence: 'ombro direito ~4,2° acima da linha dos ombros',
    targetMuscles: ['traps'],
    rationale: 'justificativa',
  }
  return { finding, selection: { exercises: [buildExercise('0001')], fallback: 'none' } }
}

/** As quatro vistas com qualidade aprovada — o checklist só libera "Ver achados" assim. */
function completeAssessment(): PosturalAssessment {
  return {
    consentAccepted: true,
    processingVersion: POSTURAL_PROCESSING_VERSION,
    metrics: [],
    captures: POSTURAL_VIEWS.map((view) => ({
      id: `capture-${view}`,
      view,
      imageReference: `assessment-1.postural.${view}`,
      createdAt: '2026-09-22T10:00:00.000Z',
      quality: { passed: true, score: 1, reasons: [] },
      landmarks: [],
    })),
  }
}

function renderFlow() {
  render(
    <PosturalAssessmentFlow
      assessmentId="assessment-1"
      studentId="student-1"
      evaluatorId="trainer-1"
      posturalAssessment={completeAssessment()}
      onChange={() => {}}
    />,
  )
  screen.getByRole('button', { name: /ver achados e correção sugerida/i }).click()
}

describe('PosturalAssessmentFlow — publicação do plano corretivo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    suggestions = [buildSuggestion()]
  })

  it('publica com o aluno, a avaliação e o treinador vindos do wizard', async () => {
    publish.mockResolvedValue(undefined)
    renderFlow()

    ;(await screen.findByRole('button', { name: /publicar plano corretivo/i })).click()

    await screen.findByText(/plano corretivo publicado/i)
    expect(publish).toHaveBeenCalledTimes(1)
    const [plan, evaluatorId] = publish.mock.calls[0]
    expect(evaluatorId).toBe('trainer-1')
    expect(plan.studentId).toBe('student-1')
    expect(plan.assessmentId).toBe('assessment-1')
    expect(plan.items).toHaveLength(1)
  })

  it('não confirma publicação quando o repositório falha', async () => {
    publish.mockRejectedValue(new Error('permission denied for table corrective_plans'))
    renderFlow()

    ;(await screen.findByRole('button', { name: /publicar plano corretivo/i })).click()

    await screen.findByText('permission denied for table corrective_plans')
    expect(screen.queryByText(/plano corretivo publicado/i)).not.toBeInTheDocument()
  })

  it('esquece a confirmação anterior ao sair e voltar aos achados', async () => {
    publish.mockResolvedValue(undefined)
    renderFlow()

    ;(await screen.findByRole('button', { name: /publicar plano corretivo/i })).click()
    await screen.findByText(/plano corretivo publicado/i)

    screen.getByRole('button', { name: /voltar às capturas/i }).click()
    ;(await screen.findByRole('button', { name: /ver achados e correção sugerida/i })).click()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /publicar plano corretivo/i })).toBeInTheDocument(),
    )
    expect(screen.queryByText(/plano corretivo publicado/i)).not.toBeInTheDocument()
  })
})
