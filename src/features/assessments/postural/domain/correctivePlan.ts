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
import {
  CORRECTIVE_PRESCRIPTION_VERSION,
  type CorrectivePlan,
  type CorrectivePlanItem,
  type FindingKind,
  type PosturalFinding,
} from './correctivePrescription.types'
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

/**
 * Achados cuja correção é de padrão de movimento (joelho, pelve) — prescrição padrão 3x10-12
 * (seção 3.3 da spec). Os demais achados (ombro, quadril, cabeça, tronco) usam 3x12-15, a
 * prescrição padrão de um achado em `attention`. O treinador edita séries/reps livremente depois;
 * isto é só o ponto de partida da sugestão.
 */
const JOINT_PATTERN_FINDING_KINDS = new Set<FindingKind>([
  'knee_hyperextension',
  'knee_valgus',
  'knee_varus',
  'pelvic_tilt_anterior',
  'pelvic_tilt_posterior',
])

function defaultSetsAndReps(kind: FindingKind): Pick<CorrectivePlanItem, 'sets' | 'reps'> {
  return JOINT_PATTERN_FINDING_KINDS.has(kind) ? { sets: 3, reps: '10-12' } : { sets: 3, reps: '12-15' }
}

export interface BuildCorrectivePlanParams {
  id: string
  assessmentId: string
  studentId: string
  createdAt: string
}

/**
 * Monta um `CorrectivePlan` rascunho a partir das sugestões atuais — um `CorrectivePlanItem` por
 * exercício sugerido, com séries/reps padrão (ver `defaultSetsAndReps`), `origin: 'suggested'` e
 * `validation: 'pending'`. Função pura: `id`/`createdAt` vêm de fora (gerados pelo chamador) para
 * manter a montagem determinística e testável sem `crypto.randomUUID()`/relógio.
 *
 * `item.id` é `${findingId}:${exerciseId}` — determinístico e único por par achado/exercício, sem
 * depender de aleatoriedade.
 */
export function buildCorrectivePlanFromSuggestions(
  suggestions: FindingSuggestion[],
  params: BuildCorrectivePlanParams,
): CorrectivePlan {
  const items: CorrectivePlanItem[] = suggestions.flatMap(({ finding, selection }) =>
    selection.exercises.map((exercise) => ({
      id: `${finding.id}:${exercise.id}`,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      findingId: finding.id,
      targetMuscles: finding.targetMuscles,
      ...defaultSetsAndReps(finding.kind),
      origin: 'suggested' as const,
      validation: 'pending' as const,
    })),
  )

  return {
    id: params.id,
    studentId: params.studentId,
    assessmentId: params.assessmentId,
    findings: suggestions.map((suggestion) => suggestion.finding),
    items,
    status: 'draft',
    createdAt: params.createdAt,
    prescriptionVersion: CORRECTIVE_PRESCRIPTION_VERSION,
  }
}
