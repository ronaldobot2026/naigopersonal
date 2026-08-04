import { useCallback, useEffect, useRef, useState } from 'react'
import { indexedDbPhysicalAssessmentRepository } from '../repositories/indexedDbPhysicalAssessmentRepository'
import { createDraftPhysicalAssessment } from '../domain/createDraftPhysicalAssessment'
import type { PhysicalAssessment } from '@/types/domain'

type LoadState = 'loading' | 'error' | 'ready'

interface UsePhysicalAssessmentDraftResult {
  assessment: PhysicalAssessment | null
  loadState: LoadState
  updateAssessment: (patch: Partial<PhysicalAssessment>) => void
  complete: () => Promise<void>
}

/**
 * Carrega (ou cria) o rascunho de Avaliação Física de um aluno e persiste cada alteração
 * imediatamente no IndexedDB via PhysicalAssessmentRepository — é isso que permite recuperar
 * o rascunho ao recarregar a página no meio do preenchimento.
 */
/**
 * Quando `assessmentId` é informado, carrega exatamente essa avaliação (rascunho ou concluída) —
 * usado pela rota de visualização/edição de uma avaliação específica do histórico. Sem
 * `assessmentId`, resume o rascunho mais recente do aluno ou cria um novo (rota "nova").
 */
export function usePhysicalAssessmentDraft(
  studentId: string,
  evaluatorId: string,
  assessmentId?: string,
): UsePhysicalAssessmentDraftResult {
  const [assessment, setAssessment] = useState<PhysicalAssessment | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const assessmentRef = useRef<PhysicalAssessment | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')

    async function loadSpecific(id: string): Promise<void> {
      const existing = await indexedDbPhysicalAssessmentRepository.findById(id)
      if (!existing) throw new Error(`Avaliação ${id} não encontrada.`)
      if (cancelled) return
      assessmentRef.current = existing
      setAssessment(existing)
      setLoadState('ready')
    }

    async function loadOrCreateDraft(): Promise<void> {
      const existing = await indexedDbPhysicalAssessmentRepository.findByStudentId(studentId)
      const drafts = existing.filter((item) => item.status === 'draft')
      const mostRecentDraft = drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

      const draft = mostRecentDraft ?? createDraftPhysicalAssessment(studentId, evaluatorId)
      if (!mostRecentDraft) {
        await indexedDbPhysicalAssessmentRepository.saveDraft(draft)
      }

      if (cancelled) return
      assessmentRef.current = draft
      setAssessment(draft)
      setLoadState('ready')
    }

    const load = assessmentId ? loadSpecific(assessmentId) : loadOrCreateDraft()
    load.catch(() => {
      if (!cancelled) setLoadState('error')
    })

    return () => {
      cancelled = true
    }
  }, [studentId, evaluatorId, assessmentId])

  const updateAssessment = useCallback((patch: Partial<PhysicalAssessment>) => {
    const current = assessmentRef.current
    if (!current) return

    const updated: PhysicalAssessment = { ...current, ...patch }
    assessmentRef.current = updated
    setAssessment(updated)
    void indexedDbPhysicalAssessmentRepository.saveDraft(updated)
  }, [])

  const complete = useCallback(async () => {
    const current = assessmentRef.current
    if (!current) return
    const completed = await indexedDbPhysicalAssessmentRepository.complete(current)
    assessmentRef.current = completed
    setAssessment(completed)
  }, [])

  return { assessment, loadState, updateAssessment, complete }
}
