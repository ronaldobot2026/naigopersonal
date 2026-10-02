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
import type { FindingKind, PosturalFinding } from '../domain/correctivePrescription.types'

const { exercises: catalog } = toExerciseCatalog(JSON.parse(rawCatalog) as RawExerciseCatalog)

const HOME_EQUIPMENT = ['Peso corporal', 'Halteres', 'Elástico', 'Barra']

/** Achado genérico a partir da tabela de vínculos — reaproveitado pelos testes por `FindingKind`. */
function findingOfKind(kind: FindingKind): PosturalFinding {
  const link = CORRECTIVE_TARGET_LINKS[kind]
  return {
    id: `finding:test.${kind}`,
    kind,
    side: 'bilateral',
    sourceMetricId: `test.${kind}`,
    view: 'front',
    measuredValue: 10,
    thresholdValue: 3,
    evidence: `achado de teste para ${kind}`,
    targetMuscles: link.targetMuscles,
    rationale: link.rationale,
  }
}

function shoulderElevationFinding(): PosturalFinding {
  return { ...findingOfKind('shoulder_elevation'), id: 'finding:front.shoulderInclination', side: 'right' }
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

/**
 * Regressão do defeito medido em 21/09 (ver docs/CORRECTIVE_PRESCRIPTION.md, seção 3.2, nota do
 * critério (a) e item 2 do DoD): um critério GLOBAL de puxada (`row`/`shrug`/`pull`) contaminava
 * achados opostos e achados de perna/pelve, porque `pull` casa com `rack pull`/`snatch pull`/
 * `leg pull` no vocabulário em inglês do catálogo. `movementPatterns` agora é por achado
 * (tabela 2.4) — estes testes travam que isso não regrida.
 */
describe('selectCorrectiveExercises — padrão de movimento é por achado, não global (catálogo real)', () => {
  it('ombro elevado e ombro deprimido — correções OPOSTAS — devolvem listas distintas', () => {
    const elevationResult = selectCorrectiveExercises(findingOfKind('shoulder_elevation'), catalog, {
      availableEquipment: HOME_EQUIPMENT,
    })
    const depressionResult = selectCorrectiveExercises(findingOfKind('shoulder_depression'), catalog, {
      availableEquipment: HOME_EQUIPMENT,
    })

    const elevationIds = elevationResult.exercises.map((exercise) => exercise.id)
    const depressionIds = depressionResult.exercises.map((exercise) => exercise.id)

    expect(elevationIds.length).toBeGreaterThan(0)
    expect(depressionIds.length).toBeGreaterThan(0)
    expect(depressionIds).not.toEqual(elevationIds)
  })

  const LEG_AND_PELVIS_FINDINGS: FindingKind[] = [
    'knee_hyperextension',
    'knee_valgus',
    'knee_varus',
    'pelvic_tilt_anterior',
    'pelvic_tilt_posterior',
    'hip_inclination',
  ]

  it.each(LEG_AND_PELVIS_FINDINGS)(
    '%s não é dominado por vocabulário de puxada escapular (row/shrug/pull)',
    (kind) => {
      const result = selectCorrectiveExercises(findingOfKind(kind), catalog, {
        availableEquipment: HOME_EQUIPMENT,
      })

      expect(result.exercises.length).toBeGreaterThan(0)

      for (const exercise of result.exercises) {
        const original = exercise.originalName.toLowerCase()
        const translated = exercise.name.toLowerCase()
        expect(original).not.toContain('pull')
        expect(original).not.toContain('row')
        expect(original).not.toContain('shrug')
        expect(translated).not.toContain('puxada')
        expect(translated).not.toContain('snatch')
      }
    },
  )

  it('joelho varo (precisa de adutores) não sugere "Puxada snatch" (defeito medido em 21/09)', () => {
    const result = selectCorrectiveExercises(findingOfKind('knee_varus'), catalog, {
      availableEquipment: HOME_EQUIPMENT,
    })

    const hasSnatchPull = result.exercises.some((exercise) =>
      exercise.originalName.toLowerCase().includes('snatch pull'),
    )
    expect(hasSnatchPull).toBe(false)
  })
})
