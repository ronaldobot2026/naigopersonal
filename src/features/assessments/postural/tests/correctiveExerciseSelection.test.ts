import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/features/workouts/domain/exercise.types'
import { selectCorrectiveExercises } from '../domain/correctiveExerciseSelection'
import type { PosturalFinding } from '../domain/correctivePrescription.types'

function buildExercise(overrides: Partial<Exercise> & Pick<Exercise, 'id' | 'target' | 'equipment'>): Exercise {
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

/** Achado "ombro elevado" — mesmo vínculo de target usado em correctivePrescription.ts. */
const SHOULDER_ELEVATION_FINDING: PosturalFinding = {
  id: 'finding:front.shoulderInclination',
  kind: 'shoulder_elevation',
  side: 'left',
  sourceMetricId: 'front.shoulderInclination',
  view: 'front',
  measuredValue: 4.2,
  thresholdValue: 3,
  evidence: 'ombro esquerdo ~4.2° acima da linha dos ombros',
  targetMuscles: ['traps', 'levator scapulae', 'delts'],
  rationale: 'Ombro elevado: fortalecer trapézio/deltoides com puxadas.',
}

describe('selectCorrectiveExercises — filtro, prioridade e diversificação', () => {
  const catalog: Exercise[] = [
    buildExercise({
      id: '0001',
      target: 'Trapézio',
      equipment: 'Peso corporal',
      muscleGroup: 'Ombros',
      secondaryMuscles: ['Deltoides'],
      steps: ['a', 'b'],
    }),
    buildExercise({
      id: '0002',
      target: 'Trapézio',
      equipment: 'Halteres',
      muscleGroup: 'Ombros',
      steps: ['a'],
    }),
    buildExercise({
      id: '0003',
      target: 'Deltoides',
      equipment: 'Peso corporal',
      muscleGroup: 'Ombros',
      steps: ['a', 'b', 'c'],
    }),
    buildExercise({
      id: '0004',
      target: 'Levantador da escápula',
      equipment: 'Elástico',
      muscleGroup: 'Pescoço',
      secondaryMuscles: ['Trapézio'],
      steps: ['a'],
    }),
    buildExercise({
      id: '0005',
      target: 'Trapézio',
      equipment: 'Peso corporal',
      muscleGroup: 'Costas',
      steps: ['a'],
    }),
  ]

  it('filtra por target e por equipamento disponível, tratando peso corporal como sempre disponível', () => {
    const result = selectCorrectiveExercises(SHOULDER_ELEVATION_FINDING, catalog, {
      availableEquipment: ['Elástico'],
    })

    // 0002 exige Halteres, fora do perfil do aluno — não pode aparecer.
    expect(result.exercises.map((exercise) => exercise.id)).not.toContain('0002')
    expect(result.fallback).toBe('none')
  })

  it('prioriza peso corporal, depois sinergia via secondaryMuscles, depois menos passos, e diversifica muscleGroup', () => {
    const result = selectCorrectiveExercises(SHOULDER_ELEVATION_FINDING, catalog, {
      availableEquipment: ['Elástico'],
      perFinding: 3,
    })

    // 0001 (peso corporal + sinergia) > 0005 (peso corporal, sem sinergia, menos passos que 0003)
    // > 0004 (não é peso corporal, mas diversifica o muscleGroup); 0003 fica de fora porque
    // repetiria o muscleGroup "Ombros" já coberto por 0001 e ainda há alternativa (0004).
    expect(result.exercises.map((exercise) => exercise.id)).toEqual(['0001', '0005', '0004'])
  })

  it('corta no perFinding informado', () => {
    const result = selectCorrectiveExercises(SHOULDER_ELEVATION_FINDING, catalog, {
      availableEquipment: ['Elástico'],
      perFinding: 2,
    })

    expect(result.exercises).toHaveLength(2)
    expect(result.exercises.map((exercise) => exercise.id)).toEqual(['0001', '0005'])
  })

  it('usa 3 como perFinding padrão quando não informado', () => {
    const result = selectCorrectiveExercises(SHOULDER_ELEVATION_FINDING, catalog, {
      availableEquipment: ['Elástico'],
    })

    expect(result.exercises).toHaveLength(3)
  })

  it('é determinística: mesma entrada produz a mesma saída, mesmo com o catálogo em outra ordem', () => {
    const first = selectCorrectiveExercises(SHOULDER_ELEVATION_FINDING, catalog, {
      availableEquipment: ['Elástico'],
    })
    const second = selectCorrectiveExercises(SHOULDER_ELEVATION_FINDING, [...catalog].reverse(), {
      availableEquipment: ['Elástico'],
    })

    expect(second.exercises.map((exercise) => exercise.id)).toEqual(
      first.exercises.map((exercise) => exercise.id),
    )
  })
})

describe('selectCorrectiveExercises — fallbacks', () => {
  it('relaxa o equipamento quando nada bate com o target e o equipamento disponível', () => {
    const catalog: Exercise[] = [
      buildExercise({ id: '1001', target: 'Quadríceps', equipment: 'Barra', muscleGroup: 'Pernas', steps: ['a'] }),
      buildExercise({
        id: '1002',
        target: 'Quadríceps',
        equipment: 'Halteres',
        muscleGroup: 'Pernas',
        steps: ['a', 'b'],
      }),
    ]
    const finding: PosturalFinding = {
      ...SHOULDER_ELEVATION_FINDING,
      kind: 'knee_hyperextension',
      targetMuscles: ['quads'],
    }

    const result = selectCorrectiveExercises(finding, catalog, { availableEquipment: ['Elástico'] })

    expect(result.fallback).toBe('equipment_relaxed')
    expect(result.notice).toBeTruthy()
    expect(result.exercises.map((exercise) => exercise.id)).toEqual(['1001', '1002'])
  })

  it('relaxa para bodyPart quando nenhum exercício do catálogo tem o target do achado', () => {
    const catalog: Exercise[] = [
      buildExercise({
        id: '2001',
        target: 'Peitoral',
        bodyPart: 'Pescoço',
        equipment: 'Peso corporal',
        muscleGroup: 'Pescoço',
        steps: ['a'],
      }),
      buildExercise({
        id: '2002',
        target: 'Peitoral',
        bodyPart: 'Peito',
        equipment: 'Peso corporal',
        muscleGroup: 'Peito',
        steps: ['a'],
      }),
    ]
    // 'neck' não é um `target` real do catálogo (é `bodyPart`) — força o fallback 2, igual à nota
    // da seção 2.2 da spec para o achado head_forward.
    const finding: PosturalFinding = {
      ...SHOULDER_ELEVATION_FINDING,
      kind: 'head_forward',
      targetMuscles: ['neck'],
    }

    const result = selectCorrectiveExercises(finding, catalog, { availableEquipment: [] })

    expect(result.fallback).toBe('body_part')
    expect(result.notice).toBeTruthy()
    expect(result.exercises.map((exercise) => exercise.id)).toEqual(['2001'])
  })

  it('devolve lista vazia com motivo quando o catálogo não tem nada aplicável', () => {
    const result = selectCorrectiveExercises(SHOULDER_ELEVATION_FINDING, [], {
      availableEquipment: ['Peso corporal'],
    })

    expect(result.exercises).toEqual([])
    expect(result.fallback).toBe('empty')
    expect(result.notice).toBeTruthy()
  })

  it('nunca inventa exercício fora do catálogo mesmo quando nada bate em nenhum nível de fallback', () => {
    const catalog: Exercise[] = [
      buildExercise({ id: '3001', target: 'Peitoral', bodyPart: 'Peito', equipment: 'Barra', steps: ['a'] }),
    ]
    const result = selectCorrectiveExercises(SHOULDER_ELEVATION_FINDING, catalog, {
      availableEquipment: ['Peso corporal'],
    })

    expect(result.exercises).toEqual([])
    expect(result.fallback).toBe('empty')
  })
})
