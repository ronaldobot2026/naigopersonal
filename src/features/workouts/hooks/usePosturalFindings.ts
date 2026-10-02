import { useMemo } from 'react'
import { physicalAssessmentRepository } from '@/features/assessments/physical/repositories/physicalAssessmentRepository'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
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
 * Lê a Avaliação Física mais recente que tenha uma Avaliação Postural. O aluno é o `auth.uid()`
 * da sessão real (Fase 8/9); sem sessão, retorna vazio em vez de assumir um aluno mockado.
 */
export function usePosturalFindings(): UsePosturalFindingsResult {
  const { userId } = useAuthUser()
  const { status, data, errorMessage } = useAsyncData(
    () =>
      userId ? physicalAssessmentRepository.findByStudentId(userId) : Promise.resolve([] as PhysicalAssessment[]),
    [userId],
  )

  const latest = useMemo(() => (data ? pickLatestWithPosture(data) : null), [data])

  const findings = useMemo(
    () =>
      latest?.posturalAssessment ? derivePosturalFindings(latest.posturalAssessment.metrics) : [],
    [latest],
  )

  return { status, findings, assessedAt: latest?.updatedAt, errorMessage }
}
