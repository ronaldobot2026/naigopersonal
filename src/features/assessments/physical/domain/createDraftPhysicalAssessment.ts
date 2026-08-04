import {
  createEmptyAnthropometry,
  createEmptyBiometrics,
  type PhysicalAssessment,
} from '@/types/domain'

export function createDraftPhysicalAssessment(
  studentId: string,
  evaluatorId: string,
): PhysicalAssessment {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    studentId,
    evaluatorId,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    biometrics: createEmptyBiometrics(),
    anthropometry: createEmptyAnthropometry(),
    visualRecords: [],
  }
}
