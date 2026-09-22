import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/features/workouts/domain/exercise.types'
import { buildCorrectivePlanFromSuggestions, buildFindingSuggestions } from '../domain/correctivePlan'
import { CORRECTIVE_PRESCRIPTION_VERSION } from '../domain/correctivePrescription.types'
import type { PosturalMetric } from '../domain/posturalAssessment.types'

function buildMetric(
  overrides: Partial<PosturalMetric> & Pick<PosturalMetric, 'id' | 'view'>,
): PosturalMetric {
  return {
    label: 'Métrica de teste',
    value: 10,
    unit: 'degree',
    confidence: 0.9,
    status: 'attention',
    automaticObservation: 'Indicador visual não conclusivo. Requer validação do profissional.',
    trainerValidation: 'pending',
    ...overrides,
  }
}

function buildExercise(
  overrides: Partial<Exercise> & Pick<Exercise, 'id' | 'target' | 'equipment'>,
): Exercise {
  return {
    name: `Exercício ${overrides.id}`,
    originalName: `exercise ${overrides.id}`,
    isNameTranslated: true,
    bodyPart: 'Ombros',
    muscleGroup: 'Ombros',
    secondaryMuscles: [],
    steps: ['Passo único.'],
    stepsLanguage: 'pt-BR',
    imageUrl: `https://cdn.example/${overrides.id}.jpg`,
    gifUrl: `https://cdn.example/${overrides.id}.gif`,
    searchText: overrides.id,
    ...overrides,
  }
}

/** Catálogo mínimo com um exercício de Trapézio (alvo de ombro elevado) e um de Glúteos. */
const catalog: Exercise[] = [
  buildExercise({ id: '0001', target: 'Trapézio', equipment: 'Halteres', muscleGroup: 'Ombros' }),
  buildExercise({ id: '0002', target: 'Glúteos', equipment: 'Peso corporal', muscleGroup: 'Quadril' }),
]

const HOME_EQUIPMENT = ['Peso corporal', 'Halteres', 'Elástico', 'Barra']

describe('buildFindingSuggestions', () => {
  it('retorna vazio quando nenhuma métrica está em attention', () => {
    const metric = buildMetric({
      id: 'front.shoulderInclination',
      view: 'front',
      status: 'within_expected_range',
    })
    expect(buildFindingSuggestions([metric], catalog, HOME_EQUIPMENT)).toEqual([])
  })

  it('deriva um achado e seleciona exercícios corretivos para ele', () => {
    const metric = buildMetric({ id: 'front.shoulderInclination', view: 'front', value: 4.2 })
    const suggestions = buildFindingSuggestions([metric], catalog, HOME_EQUIPMENT)

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].finding.kind).toBe('shoulder_elevation')
    expect(suggestions[0].selection.exercises.map((exercise) => exercise.id)).toEqual(['0001'])
    expect(suggestions[0].selection.fallback).toBe('none')
  })

  it('preserva o fallback empty e o motivo quando não há exercício no catálogo', () => {
    const metric = buildMetric({ id: 'front.shoulderInclination', view: 'front', value: 4.2 })
    const [suggestion] = buildFindingSuggestions([metric], [], HOME_EQUIPMENT)

    expect(suggestion.selection.exercises).toEqual([])
    expect(suggestion.selection.fallback).toBe('empty')
    expect(suggestion.selection.notice).toBeTruthy()
  })

  it('mantém a ordem dos achados da derivação', () => {
    const metrics = [
      buildMetric({ id: 'front.shoulderInclination', view: 'front', value: 4 }),
      buildMetric({ id: 'right_side.kneeAngle', view: 'right_side', value: 10 }),
    ]
    const suggestions = buildFindingSuggestions(metrics, catalog, HOME_EQUIPMENT)

    expect(suggestions.map((suggestion) => suggestion.finding.kind)).toEqual([
      'shoulder_elevation',
      'knee_hyperextension',
    ])
  })
})

describe('buildCorrectivePlanFromSuggestions', () => {
  const params = {
    id: 'plan-1',
    assessmentId: 'assessment-1',
    studentId: 'student-1',
    createdAt: '2026-09-22T12:00:00.000Z',
  }

  it('monta um plano rascunho com um item por exercício sugerido, séries 3x12-15 para achado padrão', () => {
    const metric = buildMetric({ id: 'front.shoulderInclination', view: 'front', value: 4.2 })
    const suggestions = buildFindingSuggestions([metric], catalog, HOME_EQUIPMENT)

    const plan = buildCorrectivePlanFromSuggestions(suggestions, params)

    expect(plan.id).toBe('plan-1')
    expect(plan.assessmentId).toBe('assessment-1')
    expect(plan.studentId).toBe('student-1')
    expect(plan.createdAt).toBe('2026-09-22T12:00:00.000Z')
    expect(plan.status).toBe('draft')
    expect(plan.prescriptionVersion).toBe(CORRECTIVE_PRESCRIPTION_VERSION)
    expect(plan.findings).toEqual(suggestions.map((suggestion) => suggestion.finding))

    expect(plan.items).toHaveLength(1)
    const [item] = plan.items
    expect(item.exerciseId).toBe('0001')
    expect(item.exerciseName).toBe('Exercício 0001')
    expect(item.findingId).toBe(suggestions[0].finding.id)
    expect(item.targetMuscles).toEqual(suggestions[0].finding.targetMuscles)
    expect(item.sets).toBe(3)
    expect(item.reps).toBe('12-15')
    expect(item.origin).toBe('suggested')
    expect(item.validation).toBe('pending')
  })

  it('usa 3x10-12 para achados de padrão de joelho/pelve', () => {
    const metric = buildMetric({ id: 'right_side.kneeAngle', view: 'right_side', value: 10 })
    const suggestions = buildFindingSuggestions([metric], catalog, HOME_EQUIPMENT)

    const plan = buildCorrectivePlanFromSuggestions(suggestions, params)

    expect(suggestions[0].finding.kind).toBe('knee_hyperextension')
    expect(plan.items.every((item) => item.sets === 3 && item.reps === '10-12')).toBe(true)
  })

  it('gera ids de item determinísticos e estáveis por achado + exercício (sem exercício repetido)', () => {
    const metric = buildMetric({ id: 'front.shoulderInclination', view: 'front', value: 4.2 })
    const suggestions = buildFindingSuggestions([metric], catalog, HOME_EQUIPMENT)

    const planA = buildCorrectivePlanFromSuggestions(suggestions, params)
    const planB = buildCorrectivePlanFromSuggestions(suggestions, params)

    expect(planA.items.map((item) => item.id)).toEqual(planB.items.map((item) => item.id))
    expect(new Set(planA.items.map((item) => item.id)).size).toBe(planA.items.length)
  })

  it('não inclui itens quando nenhum achado tem exercício aplicável', () => {
    const metric = buildMetric({ id: 'front.shoulderInclination', view: 'front', value: 4.2 })
    const suggestions = buildFindingSuggestions([metric], [], HOME_EQUIPMENT)

    const plan = buildCorrectivePlanFromSuggestions(suggestions, params)

    expect(plan.items).toEqual([])
    expect(plan.findings).toHaveLength(1)
  })
})
