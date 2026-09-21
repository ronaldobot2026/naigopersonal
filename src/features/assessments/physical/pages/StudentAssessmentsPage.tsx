import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buildNewAssessmentPath, buildViewAssessmentPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import { physicalAssessmentRepository } from '../repositories/physicalAssessmentRepository'
import type { PhysicalAssessment } from '@/types/domain'

type LoadState = 'loading' | 'error' | 'ready'

export function StudentAssessmentsPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [assessments, setAssessments] = useState<PhysicalAssessment[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const { status: authStatus } = useAuthUser()

  useEffect(() => {
    if (!studentId || authStatus !== 'authenticated') return
    let cancelled = false
    setLoadState('loading')

    physicalAssessmentRepository
      .findByStudentId(studentId)
      .then((result) => {
        if (cancelled) return
        setAssessments(result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })

    return () => {
      cancelled = true
    }
  }, [studentId, authStatus])

  if (!studentId) {
    return <ErrorState title="Aluno não informado" description="Volte para a lista de alunos." />
  }

  if (authStatus === 'unauthenticated') {
    return (
      <ErrorState
        title="Sessão expirada"
        description="Faça login novamente para ver as avaliações deste aluno."
      />
    )
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Histórico"
        title="Avaliações do aluno"
        actions={
          <Link
            to={buildNewAssessmentPath(studentId)}
            className="rounded-md bg-action-primary px-6 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-action-primary-foreground hover:opacity-90"
          >
            Nova avaliação
          </Link>
        }
      />

      {(authStatus === 'loading' || loadState === 'loading') && (
        <LoadingState label="Carregando avaliações…" />
      )}
      {authStatus === 'authenticated' && loadState === 'error' && (
        <ErrorState
          title="Não foi possível carregar as avaliações"
          description="Tente novamente."
        />
      )}
      {authStatus === 'authenticated' && loadState === 'ready' && assessments.length === 0 && (
        <EmptyState
          title="Nenhuma avaliação registrada"
          description="Inicie a primeira avaliação física deste aluno."
        />
      )}
      {authStatus === 'authenticated' && loadState === 'ready' && assessments.length > 0 && (
        <Card>
          <ul className="divide-y divide-border">
            {assessments.map((assessment) => {
              const date = new Date(assessment.updatedAt).toLocaleDateString('pt-BR')
              const isDraft = assessment.status === 'draft'
              const to = isDraft
                ? buildNewAssessmentPath(studentId)
                : buildViewAssessmentPath(studentId, assessment.id)

              return (
                <li key={assessment.id}>
                  <Link
                    to={to}
                    className="flex items-center justify-between gap-4 py-4 transition-colors hover:text-action-primary"
                  >
                    <span className="text-text-primary">{date}</span>
                    <Badge tone={isDraft ? 'warning' : 'success'}>
                      {isDraft ? 'Rascunho — continuar' : 'Concluída'}
                    </Badge>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
