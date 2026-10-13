import { useParams } from 'react-router-dom'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { AskTrainerPanel } from '@/features/chat/components/AskTrainerPanel'
import { studentRepository } from '@/features/students/repositories/studentRepository'
import { useAsyncData } from '@/hooks/useAsyncData'
import type { PhysicalAssessment, Student } from '@/types/domain'
import { physicalAssessmentRepository } from '../repositories/physicalAssessmentRepository'
import { ReviewStep } from '../components/steps/ReviewStep'

interface AssessmentDetail {
  assessment: PhysicalAssessment
  student: Student
}

async function loadDetail(assessmentId: string): Promise<AssessmentDetail> {
  const assessment = await physicalAssessmentRepository.findById(assessmentId)
  if (!assessment) throw new Error(`Avaliação ${assessmentId} não encontrada.`)

  const student = await studentRepository.findById(assessment.studentId)
  if (!student) throw new Error(`Aluno ${assessment.studentId} não encontrado.`)

  return { assessment, student }
}

/** Visão somente-leitura de uma avaliação concluída, para o próprio aluno acompanhar. */
export function StudentAssessmentDetailPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const { status, data, errorMessage } = useAsyncData(
    () => loadDetail(assessmentId ?? ''),
    [assessmentId],
  )

  if (!assessmentId) {
    return <ErrorState title="Avaliação não informada" description="Volte para o histórico." />
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader eyebrow="Detalhe" title="Avaliação física" />

      {status === 'loading' && <LoadingState label="Carregando avaliação…" />}
      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar a avaliação"
          description={errorMessage ?? 'Tente novamente.'}
        />
      )}
      {status === 'ready' && data && (
        <>
          {/*
            A dúvida sobre um achado postural nasce aqui, olhando o resultado — e não no chat
            vazio, onde o aluno teria de descrever de novo de qual avaliação está falando. O
            rótulo congelado leva a data da avaliação, que é o que a identifica para o personal.
          */}
          <AskTrainerPanel
            contextKind="assessment"
            contextId={data.assessment.id}
            contextLabel={`Avaliação física · ${new Date(data.assessment.createdAt).toLocaleDateString('pt-BR')}`}
            className="mb-4"
          />
          <ReviewStep
            assessment={data.assessment}
            student={data.student}
            onSave={async () => {}}
            saving={false}
            onComplete={async () => {}}
          />
        </>
      )}
    </div>
  )
}
