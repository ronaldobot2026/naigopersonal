import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  buildNewAssessmentPath,
  buildStudentAssessmentsPath,
  buildWorkoutBuilderPath,
} from '@/app/router/routes'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { studentRepository } from '../repositories/studentRepository'
import type { Student } from '@/types/domain'

type LoadState = 'loading' | 'error' | 'ready'

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [student, setStudent] = useState<Student | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    setLoadState('loading')

    studentRepository
      .findById(studentId)
      .then((result) => {
        if (cancelled) return
        setStudent(result)
        setLoadState(result ? 'ready' : 'error')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })

    return () => {
      cancelled = true
    }
  }, [studentId])

  if (!studentId) {
    return <ErrorState title="Aluno não informado" description="Volte para a lista de alunos." />
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      {loadState === 'loading' && <LoadingState label="Carregando aluno…" />}
      {loadState === 'error' && (
        <ErrorState title="Aluno não encontrado" description="Verifique se o link está correto." />
      )}
      {loadState === 'ready' && student && (
        <>
          <PageHeader eyebrow="Perfil do aluno" title={student.name} description={student.email} />

          <Card className="mb-4">
            <Link
              to={buildWorkoutBuilderPath(student.id)}
              className="flex items-center justify-center gap-2 rounded-md bg-action-primary px-6 py-4 text-center font-mono text-sm font-semibold uppercase tracking-wider text-action-primary-foreground hover:opacity-90"
            >
              <Icon name="fitness_center" />
              Montar treino
            </Link>
          </Card>

          <Card className="flex flex-col gap-3 sm:flex-row">
            <Link
              to={buildNewAssessmentPath(student.id)}
              className="flex-1 rounded-md border border-border px-6 py-3 text-center font-mono text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-elevated"
            >
              Nova avaliação física
            </Link>
            <Link
              to={buildStudentAssessmentsPath(student.id)}
              className="flex-1 rounded-md border border-border px-6 py-3 text-center font-mono text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-elevated"
            >
              Histórico de avaliações
            </Link>
          </Card>
        </>
      )}
    </div>
  )
}
