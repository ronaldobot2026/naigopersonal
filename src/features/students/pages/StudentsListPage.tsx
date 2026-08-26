import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildStudentDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { useAsyncData } from '@/hooks/useAsyncData'
import { MOCK_TRAINER_ID } from '@/mocks/trainers'
import { indexedDbStudentRepository } from '../repositories/indexedDbStudentRepository'

export function StudentsListPage() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [version, setVersion] = useState(0)
  const { status, data: students, errorMessage } = useAsyncData(
    () => indexedDbStudentRepository.findAll(),
    [version],
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    const form = new FormData(event.currentTarget)
    await indexedDbStudentRepository.create({
      id: crypto.randomUUID(),
      name: String(form.get('name')).trim(),
      email: String(form.get('email')).trim(),
      trainerId: MOCK_TRAINER_ID,
    })
    setVersion((current) => current + 1)
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Meus Alunos" description="Todos os alunos vinculados a você." />
        <Button onClick={() => dialogRef.current?.showModal()}>
          <Icon name="person_add" />
          Adicionar aluno
        </Button>
      </div>

      {status === 'loading' && <LoadingState label="Carregando alunos…" />}
      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar os alunos"
          description={errorMessage ?? 'Verifique se o navegador permite IndexedDB.'}
        />
      )}
      {status === 'ready' && students?.length === 0 && (
        <EmptyState
          title="Nenhum aluno cadastrado"
          description="Use o botão “Adicionar aluno” para cadastrar o primeiro."
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

      {/* <dialog> nativo: modal, foco preso, Esc e backdrop de graça. */}
      <dialog
        ref={dialogRef}
        className="glass-high m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border p-gutter text-text-primary backdrop:bg-black/60"
      >
        <form method="dialog" onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold">Adicionar aluno</h2>
          <Input label="Nome" name="name" required autoFocus placeholder="Nome completo" />
          <Input label="E-mail" name="email" type="email" required placeholder="aluno@email.com" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit">Adicionar</Button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
