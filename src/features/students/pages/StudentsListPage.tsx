import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildStudentDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import { InviteStudentForm } from '../components/InviteStudentForm'
import { studentRepository } from '../repositories/studentRepository'

/**
 * Sem sessão, a RLS de `students` devolve lista vazia — sem essa guarda, a tela mostrava
 * "Nenhum aluno cadastrado" pra quem simplesmente não estava logado, indistinguível de um
 * personal com zero alunos de verdade. Só busca quando `authStatus` é `authenticated`.
 */
export function StudentsListPage() {
  const { status: authStatus } = useAuthUser()
  const [isInviteOpen, setInviteOpen] = useState(false)
  // Incrementado após um convite bem-sucedido para o `useAsyncData` abaixo refazer o `findAll()`
  // sem precisar de uma dependência real de cache (ver comentário do hook).
  const [refreshKey, setRefreshKey] = useState(0)
  const { status, data: students, errorMessage } = useAsyncData(
    () => (authStatus === 'authenticated' ? studentRepository.findAll() : Promise.resolve([])),
    [authStatus, refreshKey],
  )

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        title="Meus Alunos"
        description="Todos os alunos vinculados a você."
        actions={
          authStatus === 'authenticated' && (
            <Button variant="secondary" onClick={() => setInviteOpen((open) => !open)}>
              <Icon name={isInviteOpen ? 'close' : 'person_add'} />
              {isInviteOpen ? 'Cancelar' : 'Adicionar aluno'}
            </Button>
          )
        }
      />

      {authStatus === 'authenticated' && isInviteOpen && (
        <div className="mb-8">
          <InviteStudentForm
            onInvited={() => {
              setInviteOpen(false)
              setRefreshKey((key) => key + 1)
            }}
          />
        </div>
      )}

      {authStatus === 'unauthenticated' && (
        <ErrorState
          title="Sessão expirada"
          description="Faça login novamente para ver seus alunos."
        />
      )}

      {authStatus !== 'unauthenticated' && (authStatus === 'loading' || status === 'loading') && (
        <LoadingState label="Carregando alunos…" />
      )}

      {authStatus === 'authenticated' && status === 'error' && (
        <ErrorState
          title="Não foi possível carregar os alunos"
          description={errorMessage ?? 'Verifique sua conexão e tente novamente.'}
        />
      )}

      {authStatus === 'authenticated' && status === 'ready' && students?.length === 0 && (
        <EmptyState
          title="Nenhum aluno cadastrado"
          description="Seus alunos aparecerão aqui assim que forem vinculados a você."
        />
      )}

      {authStatus === 'authenticated' && status === 'ready' && students && students.length > 0 && (
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
