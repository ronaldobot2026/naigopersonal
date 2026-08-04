import { getAllByIndex, getById, INDEX_NAMES, put, remove, STORE_NAMES } from '@/lib/storage/db'
import type { PhysicalAssessment, PhysicalAssessmentStatus } from '@/types/domain'

async function persist(
  assessment: PhysicalAssessment,
  status: PhysicalAssessmentStatus,
): Promise<PhysicalAssessment> {
  const updated: PhysicalAssessment = { ...assessment, status, updatedAt: new Date().toISOString() }
  await put<PhysicalAssessment>(STORE_NAMES.physicalAssessments, updated)
  return updated
}

export const indexedDbPhysicalAssessmentRepository = {
  async findById(id: string): Promise<PhysicalAssessment | null> {
    const record = await getById<PhysicalAssessment>(STORE_NAMES.physicalAssessments, id)
    return record ?? null
  },

  async findByStudentId(studentId: string): Promise<PhysicalAssessment[]> {
    return getAllByIndex<PhysicalAssessment>(
      STORE_NAMES.physicalAssessments,
      INDEX_NAMES.studentId,
      studentId,
    )
  },

  async saveDraft(assessment: PhysicalAssessment): Promise<PhysicalAssessment> {
    return persist(assessment, 'draft')
  },

  async complete(assessment: PhysicalAssessment): Promise<PhysicalAssessment> {
    return persist(assessment, 'completed')
  },

  async delete(id: string): Promise<void> {
    await remove(STORE_NAMES.physicalAssessments, id)
  },
}
