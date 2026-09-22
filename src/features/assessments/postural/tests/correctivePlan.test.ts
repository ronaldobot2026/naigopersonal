import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/features/workouts/domain/exercise.types'
import { buildFindingSuggestions } from '../domain/correctivePlan'
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
