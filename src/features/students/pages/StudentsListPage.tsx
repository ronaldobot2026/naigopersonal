import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildStudentDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Card } from '@/components/ui/Card'
import { indexedDbStudentRepository } from '../repositories/indexedDbStudentRepository'
import type { Student } from '@/types/domain'

type LoadState = 'loading' | 'error' | 'ready'

export function StudentsListPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')

    indexedDbStudentRepository
      .findAll()
      .then((result) => {
        if (cancelled) return
        setStudents(result)
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader title="Meus Alunos" description="Todos os alunos vinculados a você." />

      {loadState === 'loading' && <LoadingState label="Carregando alunos…" />}
      {loadState === 'error' && (
        <ErrorState
          title="Não foi possível carregar os alunos"
          description="Verifique se o navegador permite IndexedDB e tente novamente."
        />
      )}
      {loadState === 'ready' && students.length === 0 && (
        <EmptyState
          title="Nenhum aluno cadastrado"
          description="Alunos aparecerão aqui assim que forem adicionados."
        />
      )}
      {loadState === 'ready' && students.length > 0 && (
        <Card>
          <ul className="divide-y divide-border">
            {students.map((student) => (
              <li key={student.id}>
                <Link
                  to={buildStudentDetailPath(student.id)}
                  className="flex items-center justify-between gap-4 py-4 transition-colors hover:text-action-primary"
                >
                  <div>
                    <p className="font-bold text-text-primary">{student.name}</p>
                    <p className="text-sm text-text-secondary">{student.email}</p>
                  </div>
                  <span className="material-symbols-outlined text-text-secondary">
                    chevron_right
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
