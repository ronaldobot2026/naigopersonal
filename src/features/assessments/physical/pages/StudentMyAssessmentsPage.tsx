import { useEffect, useState } from 'react'
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

export function StudentMyAssessmentsPage() {
  const { userId } = useAuthUser()
  const [assessments, setAssessments] = useState<PhysicalAssessment[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoadState('loading')
    physicalAssessmentRepository
      .findByStudentId(userId)
      .then((result) => {
        if (cancelled) return
        setAssessments(
          result
            .filter((a) => a.status === 'completed')
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        )
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loadState === 'loading') return <LoadingState label="Carregando avaliações…" />
  if (loadState === 'error')
    return (
      <ErrorState
        title="Não foi possível carregar"
        description="Tente novamente."
      />
    )

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader eyebrow="Histórico" title="Minhas avaliações" />

      {assessments.length === 0 ? (
        <EmptyState
          title="Nenhuma avaliação disponível"
          description="O seu personal ainda não concluiu nenhuma avaliação."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {assessments.map((a) => {
            const date = new Date(a.updatedAt).toLocaleDateString('pt-BR')
            const peso = a.biometrics?.weightKg
            const altura = a.biometrics?.heightCm
            return (
              <Card key={a.id}>
                <div className="flex items-center justify-between gap-4 py-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-text-primary">{date}</span>
                    {(peso || altura) && (
                      <span className="text-xs text-text-secondary">
                        {peso ? `${peso} kg` : ''}
                        {peso && altura ? ' · ' : ''}
                        {altura ? `${altura} cm` : ''}
                      </span>
                    )}
                  </div>
                  <Badge tone="success">Concluída</Badge>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
