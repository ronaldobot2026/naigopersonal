import type { PosturalAssessment } from '@/features/assessments/postural/domain/posturalAssessment.types'

export type Role = 'student' | 'trainer'

export interface Student {
  id: string
  name: string
  email: string
  avatarUrl?: string
  trainerId: string
}

export interface Trainer {
  id: string
  name: string
  email: string
  avatarUrl?: string
  title?: string
}

export interface Biometrics {
  weightKg: number | null
  heightCm: number | null
  bodyFatPercent: number | null
  muscleMassKg: number | null
}

export interface Anthropometry {
  chestCm: number | null
  waistCm: number | null
  hipCm: number | null
  rightArmCm: number | null
  leftArmCm: number | null
  rightThighCm: number | null
  leftThighCm: number | null
  calvesCm: number | null
}

/** Mesmas quatro vistas do protocolo postural — ver `postural/domain/posturalViews.ts`. */
export type VisualRecordView = 'front' | 'left_side' | 'right_side' | 'back'

export interface VisualRecordEntry {
  view: VisualRecordView
  /** Chave da imagem no IndexedDB (store `assessmentPhotos`) — nunca Base64. */
  imageStorageKey?: string
}

export type PhysicalAssessmentStatus = 'draft' | 'completed'

export interface PhysicalAssessment {
  id: string
  studentId: string
  evaluatorId: string
  createdAt: string
  updatedAt: string
  status: PhysicalAssessmentStatus
  generalNotes?: string
  biometrics: Biometrics
  anthropometry: Anthropometry
  visualRecords: VisualRecordEntry[]
  posturalAssessment?: PosturalAssessment
}

export function createEmptyBiometrics(): Biometrics {
  return { weightKg: null, heightCm: null, bodyFatPercent: null, muscleMassKg: null }
}

export function createEmptyAnthropometry(): Anthropometry {
  return {
    chestCm: null,
    waistCm: null,
    hipCm: null,
    rightArmCm: null,
    leftArmCm: null,
    rightThighCm: null,
    leftThighCm: null,
    calvesCm: null,
  }
}
