import { useMemo } from 'react'
import { indexedDbPhysicalAssessmentRepository } from '@/features/assessments/physical/repositories/indexedDbPhysicalAssessmentRepository'
import { useAsyncData } from '@/hooks/useAsyncData'
import { MOCK_CURRENT_STUDENT_ID } from '@/mocks/students'
import type { PhysicalAssessment } from '@/types/domain'
import { derivePosturalFindings, type PosturalFinding } from '../domain/posturalPrescription'

interface UsePosturalFindingsResult {
  status: 'loading' | 'ready' | 'error'
  /** Achados ordenados do mais acentuado ao menos. Vazio quando não há avaliação ou destaque. */
  findings: PosturalFinding[]
  /** Quando a última avaliação foi atualizada — a tela usa para datar as sugestões. */
  assessedAt: string | undefined
  errorMessage: string | undefined
}

/** A avaliação postural mais recente do aluno, ou `null` se ele ainda não fez nenhuma. */
function pickLatestWithPosture(assessments: PhysicalAssessment[]): PhysicalAssessment | null {
  const withPosture = assessments.filter((item) => item.posturalAssessment !== undefined)
  if (withPosture.length === 0) return null

  return withPosture.reduce((latest, candidate) =>
    candidate.updatedAt > latest.updatedAt ? candidate : latest,
  )
}

/**
 * Achados posturais do aluno logado, prontos para direcionar as sugestões de exercício.
 *
 * Lê a Avaliação Física mais recente que tenha uma Avaliação Postural. Enquanto não existir
 * autenticação, o aluno é o mock fixo — mesma premissa da Home (`MOCK_CURRENT_STUDENT_ID`).
 */
export function usePosturalFindings(): UsePosturalFindingsResult {
  const { status, data, errorMessage } = useAsyncData(
    () => indexedDbPhysicalAssessmentRepository.findByStudentId(MOCK_CURRENT_STUDENT_ID),
    [],
  )

  const latest = useMemo(() => (data ? pickLatestWithPosture(data) : null), [data])

  const findings = useMemo(
    () =>
      latest?.posturalAssessment ? derivePosturalFindings(latest.posturalAssessment.metrics) : [],
    [latest],
  )

  return { status, findings, assessedAt: latest?.updatedAt, errorMessage }
}
