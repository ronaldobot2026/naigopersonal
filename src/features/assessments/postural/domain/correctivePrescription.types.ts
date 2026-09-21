/**
 * Tipos da prescrição corretiva (Fase 14) — o vínculo entre um achado postural e os exercícios
 * sugeridos para corrigi-lo. Ver docs/CORRECTIVE_PRESCRIPTION.md, seção 2.
 *
 * Mesma regra do resto do módulo postural: nada aqui é diagnóstico. `PosturalFinding` é uma
 * leitura automática não-conclusiva; quem decide o treino é o profissional.
 */
import type { PosturalView } from './posturalAssessment.types'

export type FindingKind =
  | 'shoulder_elevation'
  | 'shoulder_depression'
  | 'hip_inclination'
  | 'head_forward'
  | 'trunk_lateral_deviation'
  | 'knee_hyperextension'
  | 'knee_valgus'
  | 'knee_varus'
  | 'pelvic_tilt_anterior'
  | 'pelvic_tilt_posterior'

export type FindingSide = 'left' | 'right' | 'bilateral'

/** Um achado derivado das métricas. NUNCA um diagnóstico. */
export interface PosturalFinding {
  id: string
  kind: FindingKind
  side: FindingSide
  /** Métrica de origem (id em PosturalMetric) — rastreabilidade. */
  sourceMetricId: string
  view: PosturalView
  /** Valor medido e limiar cruzado, para o treinador conferir. */
  measuredValue: number
  thresholdValue: number
  /** Frase não-conclusiva, ex.: "ombro direito ~4,2° acima da linha dos ombros". */
  evidence: string
  /** Grupo muscular-alvo sugerido (alvos do catálogo). */
  targetMuscles: string[]
  /** Justificativa em 1 linha, revisável pelo treinador. */
  rationale: string
}

/** Item do plano corretivo — exercício do catálogo + prescrição de treino. */
export interface CorrectivePlanItem {
  id: string
  exerciseId: string // id do catálogo (ex.: "0001")
  exerciseName: string
  findingId: string // vínculo com o achado que o originou
  targetMuscles: string[]
  sets: number
  reps: string // "12-15" — string por admitir faixa
  /** Como o app chegou aqui: 'suggested' (automático) | 'added'/'replaced' (treinador). */
  origin: 'suggested' | 'added' | 'replaced'
  /** Treinador pode aceitar/trocar/remover — espelha TrainerValidation do módulo postural. */
  validation: 'pending' | 'accepted' | 'edited' | 'rejected'
  trainerNote?: string
}

export interface CorrectivePlan {
  id: string
  studentId: string
  assessmentId: string
  findings: PosturalFinding[]
  items: CorrectivePlanItem[]
  status: 'draft' | 'published'
  createdAt: string
  publishedAt?: string
  /** Versão do motor de regras que gerou as sugestões. */
  prescriptionVersion: string
}

export const CORRECTIVE_PRESCRIPTION_VERSION = '2026.1'
