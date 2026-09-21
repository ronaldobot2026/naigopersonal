import { Link } from 'react-router-dom'
import { buildStudentDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useAsyncData } from '@/hooks/useAsyncData'
import { studentRepository } from '../repositories/studentRepository'

export function StudentsListPage() {
  const { status, data: students, errorMessage } = useAsyncData(
    () => studentRepository.findAll(),
    [],
  )

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader title="Meus Alunos" description="Todos os alunos vinculados a você." />

      {status === 'loading' && <LoadingState label="Carregando alunos…" />}
      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar os alunos"
          description={errorMessage ?? 'Verifique sua conexão e tente novamente.'}
        />
      )}
      {status === 'ready' && students?.length === 0 && (
        <EmptyState
          title="Nenhum aluno cadastrado"
          description="Seus alunos aparecerão aqui assim que forem vinculados a você."
        />
      )}
      {status === 'ready' && students && students.length > 0 && (
        <Card>
          <ul className="divide-y divide-border">
            {students.map((student) => (
              <li key={student.id}>
                <Link
                  to={buildStudentDetailPath(student.id)}
                  className="flex items-center justify-between gap-4 py-4 transition-colors hover:text-action-primary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-text-primary">{student.name}</p>
                    <p className="truncate text-sm text-text-secondary">{student.email}</p>
                  </div>
                  <Icon name="chevron_right" className="shrink-0 text-text-secondary" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
