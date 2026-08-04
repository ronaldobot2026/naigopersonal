import type { NormalizedLandmark } from './landmarks'

export type PosturalView = 'front' | 'left_side' | 'right_side' | 'back'

export type PosturalMetricStatus =
  'within_expected_range' | 'attention' | 'low_confidence' | 'not_available'

export type TrainerValidation = 'pending' | 'accepted' | 'edited' | 'rejected'

/**
 * Indicador visual calculado automaticamente. NUNCA é um diagnóstico — ver
 * docs/POSTURAL_ASSESSMENT.md para os limites explícitos do sistema. O campo
 * `automaticObservation` deve sempre usar linguagem não conclusiva.
 */
export interface PosturalMetric {
  id: string
  label: string
  view: PosturalView
  value: number | null
  unit: 'degree' | 'normalized_distance' | 'ratio'
  confidence: number
  status: PosturalMetricStatus
  automaticObservation: string
  trainerValidation: TrainerValidation
  trainerNote?: string
}

export interface CaptureQuality {
  passed: boolean
  /** Score agregado de confiança/qualidade, 0 a 1. */
  score: number
  /** Motivos de falha em pt-BR, vazio quando `passed` é true. */
  reasons: string[]
}

export interface PosturalCapture {
  id: string
  view: PosturalView
  /** Referência à imagem (chave no IndexedDB ou Object URL da sessão) — nunca Base64. */
  imageReference?: string
  createdAt: string
  quality: CaptureQuality
  /** Array bruto de 33 landmarks, na ordem retornada pelo modelo de pose. */
  landmarks: NormalizedLandmark[]
}

export interface PosturalAssessment {
  consentAccepted: boolean
  captures: PosturalCapture[]
  metrics: PosturalMetric[]
  trainerSummary?: string
  /** Versão do pipeline de processamento que gerou os dados, para rastreabilidade futura. */
  processingVersion: string
}

export const POSTURAL_PROCESSING_VERSION = '2026.2-4views'
