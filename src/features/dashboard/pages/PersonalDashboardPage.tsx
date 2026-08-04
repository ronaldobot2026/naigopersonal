import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildNewAssessmentPath, buildStudentDetailPath, ROUTES } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Card } from '@/components/ui/Card'
import { MetricCard } from '@/components/ui/MetricCard'
import { Reveal } from '@/components/motion/Reveal'
import { indexedDbStudentRepository } from '@/features/students/repositories/indexedDbStudentRepository'
import type { Student } from '@/types/domain'

type LoadState = 'loading' | 'error' | 'ready'

export function PersonalDashboardPage() {
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
      <PageHeader
        eyebrow="Painel do treinador"
        title="Dashboard"
        description="Visão geral dos seus alunos e avaliações."
      />

      <div className="mb-gutter grid grid-cols-1 gap-4 md:grid-cols-3">
        <Reveal>
          <MetricCard label="Total de alunos" value={students.length} />
        </Reveal>
        <Reveal delay={70}>
          <MetricCard label="Avaliações pendentes" value="—" />
        </Reveal>
        <Reveal delay={140}>
          <MetricCard label="Treinos hoje" value="—" />
        </Reveal>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg text-text-primary">Alunos</h3>
          <Link
            to={ROUTES.trainer.students}
            className="font-mono text-xs uppercase tracking-wider text-action-primary hover:underline"
          >
            Ver todos
          </Link>
        </div>

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
          <ul className="divide-y divide-border">
            {students.map((student) => (
              <li key={student.id} className="flex items-center justify-between gap-4 py-4">
                <Link to={buildStudentDetailPath(student.id)} className="hover:text-action-primary">
                  <p className="font-bold text-text-primary">{student.name}</p>
                  <p className="text-sm text-text-secondary">{student.email}</p>
                </Link>
                <Link
                  to={buildNewAssessmentPath(student.id)}
                  className="whitespace-nowrap rounded-md border border-border px-4 py-2 font-mono text-xs uppercase tracking-wider text-action-primary transition-colors hover:bg-surface-elevated"
                >
                  Nova avaliação
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
