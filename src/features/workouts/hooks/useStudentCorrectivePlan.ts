import { correctivePlanRepository } from '@/features/assessments/postural/repositories/correctivePlanRepository'
import type { CorrectivePlan } from '@/features/assessments/postural/domain/correctivePrescription.types'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useAuthUser } from '@/lib/supabase/useAuthUser'

interface UseStudentCorrectivePlanResult {
  status: 'loading' | 'ready' | 'error'
  /** Plano publicado mais recente, sem os itens que o personal rejeitou; `null` se não há nenhum. */
  plan: CorrectivePlan | null
}

/**
 * O plano publicado mais recente, como o aluno deve vê-lo: sem os exercícios que o personal
 * rejeitou e sem repetição — o motor sugere o mesmo exercício para achados diferentes (ex.: cabeça
 * anteriorizada no lado esquerdo E no direito), o que no plano é rastreabilidade, mas para o aluno é
 * só o mesmo exercício duas vezes.
 */
export function pickLatestPublished(plans: CorrectivePlan[]): CorrectivePlan | null {
  const published = plans.filter((plan) => plan.status === 'published')
  if (published.length === 0) return null
  const latest = published.reduce((best, plan) =>
    (plan.publishedAt ?? plan.createdAt) > (best.publishedAt ?? best.createdAt) ? plan : best,
  )
  const seen = new Set<string>()
  const items = latest.items.filter((item) => {
    if (item.validation === 'rejected' || seen.has(item.exerciseId)) return false
    seen.add(item.exerciseId)
    return true
  })
  return { ...latest, items }
}

/**
 * Plano corretivo que o personal PUBLICOU para o aluno logado. A RLS já só entrega planos
 * `published` ao aluno (`corrective_plans_select_own_published`); o filtro de status aqui é só
 * para a função ser correta por si mesma.
 */
export function useStudentCorrectivePlan(): UseStudentCorrectivePlanResult {
  const { userId } = useAuthUser()
  const { status, data } = useAsyncData(
    () => (userId ? correctivePlanRepository.findByStudentId(userId) : Promise.resolve([])),
    [userId],
  )
  return { status, plan: data ? pickLatestPublished(data) : null }
}
