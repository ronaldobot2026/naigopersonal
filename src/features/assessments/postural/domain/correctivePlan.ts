/**
 * Montagem do plano corretivo sugerido — a "colagem" entre a derivação de achados
 * (`correctivePrescription`) e a seleção de exercícios (`correctiveExerciseSelection`).
 * Ver docs/CORRECTIVE_PRESCRIPTION.md, seção 5.
 *
 * Função pura e determinística: mesma entrada (métricas + catálogo + equipamento) sempre
 * devolve a mesma saída, sem `Math.random()` — o treinador precisa poder reconferir a sugestão.
 */
import type { Exercise } from '@/features/workouts/domain/exercise.types'
import { deriveFindingsFromMetrics } from './correctivePrescription'
import {
  selectCorrectiveExercises,
  type CorrectiveExerciseSelectionResult,
} from './correctiveExerciseSelection'
import type { FindingKind, PosturalFinding } from './correctivePrescription.types'
import type { PosturalMetric } from './posturalAssessment.types'

/** Um achado em "attention" + a seleção de exercícios corretivos sugeridos para ele. */
export interface FindingSuggestion {
  finding: PosturalFinding
  selection: CorrectiveExerciseSelectionResult
}

/** Rótulo curto e não-conclusivo de cada achado, para a UI. */
export const FINDING_KIND_LABEL: Record<FindingKind, string> = {
  shoulder_elevation: 'Ombro elevado',
  shoulder_depression: 'Ombro deprimido',
  hip_inclination: 'Inclinação do quadril',
  head_forward: 'Cabeça anteriorizada',
  trunk_lateral_deviation: 'Desvio lateral do tronco',
  knee_hyperextension: 'Hiperextensão do joelho',
  knee_valgus: 'Joelho valgo',
  knee_varus: 'Joelho varo',
  pelvic_tilt_anterior: 'Pelve anteriorizada',
  pelvic_tilt_posterior: 'Pelve retrovertida',
}

/**
 * Deriva os achados das métricas em "attention" e, para cada um, seleciona os exercícios
 * corretivos do catálogo disponíveis com o equipamento informado. Preserva a ordem de derivação.
 * Achados sem exercício aplicável voltam com `selection.fallback === 'empty'` e o motivo em
 * `selection.notice` — nunca inventa exercício fora do catálogo.
 */
export function buildFindingSuggestions(
  metrics: PosturalMetric[],
  catalog: Exercise[],
  availableEquipment: string[],
): FindingSuggestion[] {
  return deriveFindingsFromMetrics(metrics).map((finding) => ({
    finding,
    selection: selectCorrectiveExercises(finding, catalog, { availableEquipment }),
  }))
}
