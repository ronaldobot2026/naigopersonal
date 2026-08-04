import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { indexedDbStudentRepository } from '@/features/students/repositories/indexedDbStudentRepository'
import { MOCK_TRAINER_ID } from '@/mocks/trainers'
import type { Student } from '@/types/domain'
import { PhysicalAssessmentWizard } from '../components/PhysicalAssessmentWizard'
import { usePhysicalAssessmentDraft } from '../hooks/usePhysicalAssessmentDraft'

type LoadState = 'loading' | 'error' | 'ready'

export function NewPhysicalAssessmentPage() {
  const { studentId, assessmentId } = useParams<{ studentId: string; assessmentId?: string }>()
  const [student, setStudent] = useState<Student | null>(null)
  const [studentLoadState, setStudentLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    setStudentLoadState('loading')

    indexedDbStudentRepository
      .findById(studentId)
      .then((result) => {
        if (cancelled) return
        setStudent(result)
        setStudentLoadState(result ? 'ready' : 'error')
      })
      .catch(() => {
        if (!cancelled) setStudentLoadState('error')
      })

    return () => {
      cancelled = true
    }
  }, [studentId])

  const { assessment, loadState, updateAssessment, complete } = usePhysicalAssessmentDraft(
    studentId ?? '',
    MOCK_TRAINER_ID,
    assessmentId,
  )

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Nova entrada"
        title="Avaliação Física"
        description="Registre biometria, antropometria, registro visual e avaliação postural em um único fluxo."
      />

      {!studentId && (
        <ErrorState
          title="Aluno não informado"
          description="Volte para o dashboard e selecione um aluno."
        />
      )}

      {studentId && (studentLoadState === 'loading' || loadState === 'loading') && (
        <LoadingState label="Carregando avaliação…" />
      )}

      {studentId && (studentLoadState === 'error' || loadState === 'error') && (
        <ErrorState
          title="Não foi possível carregar a avaliação"
          description="Verifique o aluno selecionado e tente novamente."
        />
      )}

      {studentId &&
        studentLoadState === 'ready' &&
        loadState === 'ready' &&
        student &&
        assessment && (
          <PhysicalAssessmentWizard
            student={student}
            assessment={assessment}
            onUpdate={updateAssessment}
            onComplete={complete}
          />
        )}
    </div>
  )
}
