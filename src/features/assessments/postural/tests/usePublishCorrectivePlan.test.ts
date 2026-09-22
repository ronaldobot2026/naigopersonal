import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exercise } from '@/features/workouts/domain/exercise.types'
import type { FindingSuggestion } from '../domain/correctivePlan'
import type { PosturalFinding } from '../domain/correctivePrescription.types'

const publish = vi.fn()

vi.mock('../repositories/correctivePlanRepository', () => ({
  correctivePlanRepository: {
    publish: (...args: unknown[]) => publish(...args),
  },
}))

import { usePublishCorrectivePlan } from '../hooks/usePublishCorrectivePlan'

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

describe('usePublishCorrectivePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('começa idle e vai a saving/success ao publicar com sucesso', async () => {
    publish.mockResolvedValue(undefined)
    const { result } = renderHook(() => usePublishCorrectivePlan())

    expect(result.current.status).toBe('idle')

    await act(async () => {
      await result.current.publish({
        suggestions: [buildSuggestion()],
        assessmentId: 'assessment-1',
        studentId: 'student-1',
        evaluatorId: 'trainer-1',
      })
    })

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(publish).toHaveBeenCalledTimes(1)

    const [plan, evaluatorId] = publish.mock.calls[0]
    expect(evaluatorId).toBe('trainer-1')
    expect(plan.assessmentId).toBe('assessment-1')
    expect(plan.studentId).toBe('student-1')
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0].exerciseId).toBe('0001')
  })

  it('vai a error e preserva a mensagem quando o repositório falha', async () => {
    publish.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => usePublishCorrectivePlan())

    await act(async () => {
      await result.current.publish({
        suggestions: [buildSuggestion()],
        assessmentId: 'assessment-1',
        studentId: 'student-1',
        evaluatorId: 'trainer-1',
      })
    })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.errorMessage).toBe('offline')
  })

  it('reset volta a idle e limpa o erro — confirmação antiga não vale para sugestões novas', async () => {
    publish.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => usePublishCorrectivePlan())

    await act(async () => {
      await result.current.publish({
        suggestions: [buildSuggestion()],
        assessmentId: 'assessment-1',
        studentId: 'student-1',
        evaluatorId: 'trainer-1',
      })
    })
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => result.current.reset())

    expect(result.current.status).toBe('idle')
    expect(result.current.errorMessage).toBeUndefined()
  })
})
