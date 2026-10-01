import { Link } from 'react-router-dom'
import { buildStudentAssessmentDetailPath, ROUTES } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useAsyncData } from '@/hooks/useAsyncData'
import { MOCK_CURRENT_STUDENT_ID } from '@/mocks/students'
import { indexedDbPhysicalAssessmentRepository } from '../repositories/indexedDbPhysicalAssessmentRepository'

/**
 * Área do aluno para acompanhar o próprio histórico de avaliações físicas. Só lista
 * avaliações concluídas — rascunhos são de uso interno do treinador durante o preenchimento.
 */
export function StudentMyAssessmentsPage() {
  const { status, data, errorMessage } = useAsyncData(
    () => indexedDbPhysicalAssessmentRepository.findByStudentId(MOCK_CURRENT_STUDENT_ID),
    [],
  )

  const assessments = (data ?? [])
    .filter((assessment) => assessment.status === 'completed')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Meu progresso"
        title="Minhas avaliações"
        description="Histórico das avaliações físicas registradas pelo seu personal."
      />

      <Card className="mb-4">
        <Link
          to={ROUTES.student.anamnesis}
          className="flex items-center justify-between gap-4 text-text-primary hover:text-action-primary"
        >
          <span className="font-medium">Anamnese — questionários do seu personal</span>
          <Icon name="chevron_right" />
        </Link>
      </Card>

      {status === 'loading' && <LoadingState label="Carregando avaliações…" />}
      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar suas avaliações"
          description={errorMessage ?? 'Tente novamente.'}
        />
      )}
      {status === 'ready' && assessments.length === 0 && (
        <EmptyState
          title="Nenhuma avaliação concluída ainda"
          description="Quando seu personal concluir uma avaliação, ela aparece aqui."
        />
      )}
      {status === 'ready' && assessments.length > 0 && (
        <Card>
          <ul className="divide-y divide-border">
            {assessments.map((assessment) => (
              <li key={assessment.id}>
                <Link
                  to={buildStudentAssessmentDetailPath(assessment.id)}
                  className="flex items-center justify-between gap-4 py-4 transition-colors hover:text-action-primary"
                >
                  <span className="text-text-primary">
                    {new Date(assessment.updatedAt).toLocaleDateString('pt-BR')}
                  </span>
                  <Badge tone="success">Concluída</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
