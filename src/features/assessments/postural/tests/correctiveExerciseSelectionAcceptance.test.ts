/**
 * Teste de aceite do cliente (docs/CORRECTIVE_PRESCRIPTION.md, seção 3.2 e DoD): roda contra o
 * catálogo REAL (1324 exercícios), não um mock — é o único jeito de pegar o defeito que passou
 * batido num catálogo sintético pequeno (ver `correctiveExerciseSelection.test.ts` para os testes
 * unitários de filtro/prioridade/fallback com catálogo controlado).
 */
import { describe, expect, it } from 'vitest'
import rawCatalog from '../../../../../public/data/exercises.json?raw'
import type { RawExerciseCatalog } from '@/features/workouts/domain/exercise.types'
import { toExerciseCatalog } from '@/features/workouts/domain/exerciseCatalog'
import { selectCorrectiveExercises } from '../domain/correctiveExerciseSelection'
import { CORRECTIVE_TARGET_LINKS } from '../domain/correctivePrescription'
import type { PosturalFinding } from '../domain/correctivePrescription.types'

const { exercises: catalog } = toExerciseCatalog(JSON.parse(rawCatalog) as RawExerciseCatalog)

const HOME_EQUIPMENT = ['Peso corporal', 'Halteres', 'Elástico', 'Barra']

function shoulderElevationFinding(): PosturalFinding {
  const link = CORRECTIVE_TARGET_LINKS.shoulder_elevation
  return {
    id: 'finding:front.shoulderInclination',
    kind: 'shoulder_elevation',
    side: 'right',
    sourceMetricId: 'front.shoulderInclination',
    view: 'front',
    measuredValue: 4.2,
    thresholdValue: 3,
    evidence: 'ombro direito ~4.2° acima da linha dos ombros',
    targetMuscles: link.targetMuscles,
    rationale: link.rationale,
  }
}

describe('selectCorrectiveExercises — critério de aceite do cliente (catálogo real)', () => {
  it('ombro elevado + equipamento de casa inclui remada alta ou encolhimento (exemplo do áudio do Windson)', () => {
    const result = selectCorrectiveExercises(shoulderElevationFinding(), catalog, {
      availableEquipment: HOME_EQUIPMENT,
    })

    const includesNamedFamily = result.exercises.some((exercise) => {
      const original = exercise.originalName.toLowerCase()
      return original.includes('upright row') || original.includes('shrug')
    })

    expect(result.fallback).toBe('none')
    expect(includesNamedFamily).toBe(true)
  })

  it('nunca sugere alongamento ou salto para ombro elevado, mesmo sem equipamento (só peso corporal)', () => {
    const result = selectCorrectiveExercises(shoulderElevationFinding(), catalog, {
      availableEquipment: [],
    })

    for (const exercise of result.exercises) {
      const original = exercise.originalName.toLowerCase()
      expect(original).not.toContain('stretch')
      expect(original).not.toContain('jump')
    }
  })

  it('é determinística contra o catálogo real, mesmo com a ordem de entrada embaralhada', () => {
    const finding = shoulderElevationFinding()
    const options = { availableEquipment: HOME_EQUIPMENT }

    const ordered = selectCorrectiveExercises(finding, catalog, options).exercises.map((e) => e.id)
    const shuffled = [...catalog].reverse()
    const reversed = selectCorrectiveExercises(finding, shuffled, options).exercises.map((e) => e.id)

    expect(reversed).toEqual(ordered)
  })
})
