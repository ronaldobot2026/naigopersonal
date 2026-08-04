import { describe, expect, it } from 'vitest'
import rawCatalog from '../../../../public/data/exercises.json?raw'
import rawTranslations from '../../../../public/data/instructions.pt-BR.json?raw'
import type { InstructionTranslations, RawExerciseCatalog } from '../domain/exercise.types'
import { TRANSLATED_STEPS_LANGUAGE, toExerciseCatalog } from '../domain/exerciseCatalog'
import { MOCK_WORKOUTS } from '@/mocks/workouts'

const raw = JSON.parse(rawCatalog) as RawExerciseCatalog
const translations = JSON.parse(rawTranslations) as InstructionTranslations
const catalog = toExerciseCatalog(raw, translations)

describe('tradução dos passos de execução', () => {
  it('traduz tudo ou nada dentro do mesmo exercício', () => {
    // Um exercício meio em português e meio em inglês é pior de ler que um todo em inglês.
    const translatedSteps = new Set(Object.keys(translations))

    for (const exercise of catalog.exercises) {
      if (exercise.stepsLanguage !== TRANSLATED_STEPS_LANGUAGE) continue
      const original = raw.exercises.find((item) => item.id === exercise.id)
      expect(original?.steps.every((step) => translatedSteps.has(step))).toBe(true)
    }
  })

  it('mantém o inglês quando algum passo não tem tradução', () => {
    const untranslated = catalog.exercises.filter(
      (exercise) => exercise.stepsLanguage !== TRANSLATED_STEPS_LANGUAGE,
    )
    expect(untranslated.length).toBeGreaterThan(0)
    expect(untranslated[0].stepsLanguage).toBe(raw.sourceLanguage)
  })

  it('preserva a quantidade de passos ao traduzir', () => {
    for (const exercise of catalog.exercises) {
      const original = raw.exercises.find((item) => item.id === exercise.id)
      expect(exercise.steps).toHaveLength(original?.steps.length ?? -1)
    }
  })

  it('conta quantos exercícios ficaram em português', () => {
    expect(catalog.translatedStepsCount).toBeGreaterThan(50)
    expect(catalog.translatedStepsCount).toBe(
      catalog.exercises.filter((e) => e.stepsLanguage === TRANSLATED_STEPS_LANGUAGE).length,
    )
  })

  it('funciona sem dicionário nenhum', () => {
    const semTraducao = toExerciseCatalog(raw)
    expect(semTraducao.translatedStepsCount).toBe(0)
    expect(semTraducao.exercises[0].stepsLanguage).toBe(raw.sourceLanguage)
  })
})

describe('cobertura dos exercícios prescritos', () => {
  it('todo exercício usado nos treinos tem as instruções em português', () => {
    const prescritos = MOCK_WORKOUTS.flatMap((workout) =>
      workout.exercises.map((entry) => entry.exerciseId),
    )

    const semTraducao = prescritos.filter((id) => {
      const exercise = catalog.exercises.find((item) => item.id === id)
      return exercise?.stepsLanguage !== TRANSLATED_STEPS_LANGUAGE
    })

    expect(semTraducao).toEqual([])
  })
})

describe('integridade do dicionário', () => {
  it('não tem tradução órfã — toda chave existe no catálogo', () => {
    const catalogSteps = new Set(raw.exercises.flatMap((exercise) => exercise.steps))
    const orfas = Object.keys(translations).filter((step) => !catalogSteps.has(step))
    expect(orfas).toEqual([])
  })

  it('não deixa nenhum valor vazio nem igual ao original', () => {
    for (const [en, pt] of Object.entries(translations)) {
      expect(pt.trim().length).toBeGreaterThan(0)
      expect(pt).not.toBe(en)
    }
  })
})
