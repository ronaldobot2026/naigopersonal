import { describe, expect, it } from 'vitest'
import rawCatalog from '../../../../public/data/exercises.json?raw'
import type { RawExerciseCatalog } from '../domain/exercise.types'
import { BODY_PART_PT_BR, EQUIPMENT_PT_BR, MUSCLE_PT_BR } from '../domain/exerciseTaxonomy'

/**
 * Roda contra o catálogo real (`public/data/exercises.json`), importado como texto para não
 * depender de APIs de Node no tsconfig do app. Se o dataset for regerado com
 * `npm run build:exercises` e trouxer um termo novo, este teste falha e aponta exatamente qual
 * tradução falta — em vez de o termo vazar em inglês para a interface.
 */
const catalog = JSON.parse(rawCatalog) as RawExerciseCatalog

function missingFrom(dictionary: Record<string, string>, values: Iterable<string>): string[] {
  return [...new Set(values)].filter((value) => dictionary[value] === undefined).sort()
}

describe('cobertura da taxonomia contra o dataset real', () => {
  it('traduz todas as regiões do corpo', () => {
    expect(
      missingFrom(
        BODY_PART_PT_BR,
        catalog.exercises.map((e) => e.bodyPart),
      ),
    ).toEqual([])
  })

  it('traduz todos os equipamentos', () => {
    expect(
      missingFrom(
        EQUIPMENT_PT_BR,
        catalog.exercises.map((e) => e.equipment),
      ),
    ).toEqual([])
  })

  it('traduz todos os músculos principais, grupos e secundários', () => {
    const muscles = catalog.exercises.flatMap((exercise) => [
      exercise.target,
      exercise.muscleGroup,
      ...exercise.secondaryMuscles,
    ])
    expect(missingFrom(MUSCLE_PT_BR, muscles)).toEqual([])
  })
})

describe('integridade do catálogo gerado', () => {
  it('tem exercícios com id único', () => {
    const ids = catalog.exercises.map((exercise) => exercise.id)
    expect(catalog.exercises.length).toBeGreaterThan(1000)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('tem mídia e passos de execução em todos os registros', () => {
    for (const exercise of catalog.exercises) {
      expect(exercise.image).toMatch(/^images\//)
      expect(exercise.gif).toMatch(/^videos\/.+\.gif$/)
      expect(exercise.steps.length).toBeGreaterThan(0)
    }
  })

  it('carrega a atribuição obrigatória da mídia', () => {
    expect(catalog.mediaAttribution.length).toBeGreaterThan(0)
  })
})
