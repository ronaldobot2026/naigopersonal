import { useCallback, useState } from 'react'
import { buildCorrectivePlanFromSuggestions, type FindingSuggestion } from '../domain/correctivePlan'
import { correctivePlanRepository } from '../repositories/correctivePlanRepository'

export type PublishCorrectivePlanStatus = 'idle' | 'saving' | 'success' | 'error'

interface PublishParams {
  suggestions: FindingSuggestion[]
  assessmentId: string
  studentId: string
  /** Treinador autenticado — grava `corrective_plans.evaluator_id`, exigido pela RLS (ver migration). */
  evaluatorId: string
}

interface UsePublishCorrectivePlanResult {
  status: PublishCorrectivePlanStatus
  errorMessage: string | undefined
  publish: (params: PublishParams) => Promise<void>
  /** Volta a `idle` — chamado quando as sugestões podem ter mudado desde a última publicação. */
  reset: () => void
}

/**
 * Publica o plano corretivo montado a partir das sugestões atuais (docs/CORRECTIVE_PRESCRIPTION.md,
 * seção 6). Idempotente por avaliação: o `id` gerado aqui só é usado se ainda não existir um plano
 * para a avaliação — `correctivePlanRepository.publish` reabre/substitui o existente em vez de
 * duplicar. Estado de "saving/success/error" é honesto: só vira `success` depois do repositório
 * confirmar a gravação.
 */
export function usePublishCorrectivePlan(): UsePublishCorrectivePlanResult {
  const [status, setStatus] = useState<PublishCorrectivePlanStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string>()

  const publish = useCallback(async (params: PublishParams) => {
    setStatus('saving')
    setErrorMessage(undefined)
    try {
      const plan = buildCorrectivePlanFromSuggestions(params.suggestions, {
        id: crypto.randomUUID(),
        assessmentId: params.assessmentId,
        studentId: params.studentId,
        createdAt: new Date().toISOString(),
      })
      await correctivePlanRepository.publish(plan, params.evaluatorId)
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível publicar o plano corretivo.')
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setErrorMessage(undefined)
  }, [])

  return { status, errorMessage, publish, reset }
}
