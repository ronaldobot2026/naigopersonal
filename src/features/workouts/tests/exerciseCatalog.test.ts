import { describe, expect, it } from 'vitest'
import type { RawExerciseCatalog } from '../domain/exercise.types'
import {
  collectFacet,
  filterExercises,
  normalizeForSearch,
  toExerciseCatalog,
} from '../domain/exerciseCatalog'

const RAW_CATALOG: RawExerciseCatalog = {
  source: 'https://github.com/hasaneyldrm/exercises-dataset',
  sourceLanguage: 'en',
  mediaAttribution: '© Gym visual',
  generatedAt: '2026-08-03T00:00:00.000Z',
  exercises: [
    {
      id: '0025',
      name: 'barbell bench press',
      bodyPart: 'chest',
      equipment: 'barbell',
      target: 'pectorals',
      muscleGroup: 'chest',
      secondaryMuscles: ['triceps', 'shoulders'],
      steps: ['Lie flat on the bench.', 'Press the bar up.'],
      mediaId: 'abc',
      image: 'images/0025-abc.jpg',
      gif: 'videos/0025-abc.gif',
    },
    {
      id: '0334',
      name: 'dumbbell lateral raise',
      bodyPart: 'shoulders',
      equipment: 'dumbbell',
      target: 'delts',
      muscleGroup: 'shoulders',
      secondaryMuscles: ['traps'],
      steps: ['Raise the dumbbells to the side.'],
      mediaId: 'def',
      image: 'images/0334-def.jpg',
      gif: 'videos/0334-def.gif',
    },
    {
      id: '9999',
      name: 'pelvic tilt',
      bodyPart: 'waist',
      equipment: 'body weight',
      target: 'abs',
      muscleGroup: 'core',
      secondaryMuscles: [],
      steps: ['Tilt the pelvis.'],
      mediaId: 'ghi',
      image: 'images/9999-ghi.jpg',
      gif: 'videos/9999-ghi.gif',
    },
  ],
}

const catalog = toExerciseCatalog(RAW_CATALOG)

describe('toExerciseCatalog', () => {
  it('traduz nome e taxonomia para pt-BR', () => {
    const bench = catalog.exercises.find((exercise) => exercise.id === '0025')

    expect(bench?.name).toBe('Supino com barra')
    expect(bench?.bodyPart).toBe('Peito')
    expect(bench?.equipment).toBe('Barra')
    expect(bench?.target).toBe('Peitoral')
    expect(bench?.secondaryMuscles).toEqual(['Tríceps', 'Ombros'])
  })

  it('preserva o nome original e sinaliza quando não houve tradução', () => {
    const tilt = catalog.exercises.find((exercise) => exercise.id === '9999')

    expect(tilt?.name).toBe('pelvic tilt')
    expect(tilt?.originalName).toBe('pelvic tilt')
    expect(tilt?.isNameTranslated).toBe(false)
  })

  it('monta URLs absolutas de mídia no CDN', () => {
    const bench = catalog.exercises.find((exercise) => exercise.id === '0025')

    expect(bench?.imageUrl).toBe(
      'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/images/0025-abc.jpg',
    )
    expect(bench?.gifUrl).toMatch(/\/videos\/0025-abc\.gif$/)
  })

  it('mantém a atribuição obrigatória da mídia', () => {
    expect(catalog.mediaAttribution).toBe('© Gym visual')
  })

  it('ordena alfabeticamente pelo nome exibido, ignorando caixa e acento', () => {
    expect(catalog.exercises.map((exercise) => exercise.name)).toEqual([
      'Elevação lateral com halteres',
      'pelvic tilt',
      'Supino com barra',
    ])
  })

  it('registra o idioma dos passos de execução', () => {
    expect(catalog.stepsLanguage).toBe('en')
    expect(catalog.exercises.every((exercise) => exercise.stepsLanguage === 'en')).toBe(true)
  })
})

describe('normalizeForSearch', () => {
  it('remove acentos e caixa', () => {
    expect(normalizeForSearch('Abdômen')).toBe('abdomen')
    expect(normalizeForSearch('Tríceps')).toBe('triceps')
  })
})

describe('filterExercises', () => {
  const base = { search: '', bodyPart: null, equipment: null, target: null }

  it('exige todos os termos da busca', () => {
    expect(filterExercises(catalog.exercises, { ...base, search: 'supino barra' })).toHaveLength(1)
    expect(filterExercises(catalog.exercises, { ...base, search: 'supino halteres' })).toHaveLength(
      0,
    )
  })

  it('encontra pelo nome original em inglês', () => {
    const found = filterExercises(catalog.exercises, { ...base, search: 'bench press' })
    expect(found.map((exercise) => exercise.id)).toEqual(['0025'])
  })

  it('ignora acentos na busca', () => {
    expect(filterExercises(catalog.exercises, { ...base, search: 'triceps' })).toHaveLength(1)
  })

  it('combina busca e facetas', () => {
    expect(
      filterExercises(catalog.exercises, { ...base, equipment: 'Halteres' }).map((e) => e.id),
    ).toEqual(['0334'])
    expect(
      filterExercises(catalog.exercises, { ...base, bodyPart: 'Peito', search: 'elevação' }),
    ).toHaveLength(0)
  })

  it('devolve tudo sem filtros', () => {
    expect(filterExercises(catalog.exercises, base)).toHaveLength(3)
  })
})

describe('collectFacet', () => {
  it('lista valores distintos ordenados', () => {
    expect(collectFacet(catalog.exercises, 'equipment')).toEqual([
      'Barra',
      'Halteres',
      'Peso corporal',
    ])
  })
})
