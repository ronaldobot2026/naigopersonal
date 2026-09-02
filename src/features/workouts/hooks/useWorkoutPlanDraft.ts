import { useCallback, useEffect, useRef, useState } from 'react'
import { indexedDbStudentRepository } from '@/features/students/repositories/indexedDbStudentRepository'
import { createWorkoutPlan } from '../domain/createWorkoutPlan'
import { indexedDbWorkoutPlanRepository } from '../repositories/indexedDbWorkoutPlanRepository'
import type { WorkoutPlan } from '../domain/workout.types'

type LoadState = 'loading' | 'error' | 'ready'

interface UseWorkoutPlanDraftResult {
  plan: WorkoutPlan | null
  loadState: LoadState
  /** Atualiza em memória; use `save` para persistir. */
  updatePlan: (patch: Partial<WorkoutPlan>) => void
  save: () => Promise<void>
  saving: boolean
  savedAt: string | null
}

/**
 * Carrega a ficha mais recente do aluno (ou cria uma nova em memória) e a persiste
 * no IndexedDB sob demanda.
 *
 * Diferente do rascunho de avaliação, aqui o salvamento é explícito: montar treino é
 * uma edição longa, e gravar a cada tecla geraria escrita constante sem ganho.
 */
export function useWorkoutPlanDraft(studentId: string, planId?: string): UseWorkoutPlanDraftResult {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const planRef = useRef<WorkoutPlan | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')

    async function carregar(): Promise<void> {
      const aluno = await indexedDbStudentRepository.findById(studentId)
      if (!aluno) throw new Error(`Aluno ${studentId} não encontrado.`)

      const existente = planId
        ? await indexedDbWorkoutPlanRepository.findById(planId)
        : (await indexedDbWorkoutPlanRepository.findByStudentId(studentId))[0]

      const atual = existente ?? createWorkoutPlan(studentId, aluno.name)
      if (cancelled) return
      planRef.current = atual
      setPlan(atual)
      setSavedAt(existente ? existente.updatedAt : null)
      setLoadState('ready')
    }

    carregar().catch(() => {
      if (!cancelled) setLoadState('error')
    })

    return () => {
      cancelled = true
    }
  }, [studentId, planId])

  const updatePlan = useCallback((patch: Partial<WorkoutPlan>) => {
    const atual = planRef.current
    if (!atual) return
    const atualizado: WorkoutPlan = { ...atual, ...patch }
    planRef.current = atualizado
    setPlan(atualizado)
  }, [])

  const save = useCallback(async () => {
    const atual = planRef.current
    if (!atual) return
    setSaving(true)
    try {
      const salvo = await indexedDbWorkoutPlanRepository.save(atual)
      planRef.current = salvo
      setPlan(salvo)
      setSavedAt(salvo.updatedAt)
    } finally {
      setSaving(false)
    }
  }, [])

  return { plan, loadState, updatePlan, save, saving, savedAt }
}
