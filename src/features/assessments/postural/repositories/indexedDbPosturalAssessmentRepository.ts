import { getById, put, STORE_NAMES } from '@/lib/storage/db'
import type { PhysicalAssessment } from '@/types/domain'
import type { PosturalAssessment } from '../domain/posturalAssessment.types'

/**
 * A avaliação postural é um sub-registro da Avaliação Física (`PhysicalAssessment.posturalAssessment`),
 * não uma entidade independente — por isso as funções abaixo são indexadas pelo id da avaliação física.
 */
export const indexedDbPosturalAssessmentRepository = {
  async getForAssessment(assessmentId: string): Promise<PosturalAssessment | null> {
    const record = await getById<PhysicalAssessment>(STORE_NAMES.physicalAssessments, assessmentId)
    return record?.posturalAssessment ?? null
  },

  async save(assessmentId: string, posturalAssessment: PosturalAssessment): Promise<void> {
    const record = await getById<PhysicalAssessment>(STORE_NAMES.physicalAssessments, assessmentId)
    if (!record) {
      throw new Error(`Avaliação física ${assessmentId} não encontrada.`)
    }
    const updated: PhysicalAssessment = {
      ...record,
      posturalAssessment,
      updatedAt: new Date().toISOString(),
    }
    await put<PhysicalAssessment>(STORE_NAMES.physicalAssessments, updated)
  },
}
