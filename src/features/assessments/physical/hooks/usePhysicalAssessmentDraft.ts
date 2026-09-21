import { useCallback, useEffect, useRef, useState } from 'react'
import { physicalAssessmentRepository } from '../repositories/physicalAssessmentRepository'
import { createDraftPhysicalAssessment } from '../domain/createDraftPhysicalAssessment'
import type { PhysicalAssessment } from '@/types/domain'

type LoadState = 'loading' | 'error' | 'ready'

interface UsePhysicalAssessmentDraftResult {
  assessment: PhysicalAssessment | null
  loadState: LoadState
  updateAssessment: (patch: Partial<PhysicalAssessment>) => void
  /** Salvamento explícito (botão "Salvar ficha") — usa o mesmo estado saving/savedAt/saveError do auto-save. */
  save: () => Promise<void>
  saving: boolean
  savedAt: string | null
  /** Mensagem da última falha ao salvar ou concluir; `null` quando o último salvamento deu certo. */
  saveError: string | null
  complete: () => Promise<void>
}

/**
 * Carrega (ou cria) o rascunho de Avaliação Física de um aluno e persiste cada alteração
 * imediatamente no Supabase via `physicalAssessmentRepository` — é isso que permite recuperar
 * o rascunho ao recarregar a página (ou trocar de máquina) no meio do preenchimento.
 *
 * Quando `assessmentId` é informado, carrega exatamente essa avaliação (rascunho ou concluída) —
 * usado pela rota de visualização/edição de uma avaliação específica do histórico. Sem
 * `assessmentId`, resume o rascunho mais recente do aluno ou cria um novo (rota "nova").
 *
 * `evaluatorId` precisa ser o `auth.uid()` real (ver `useAuthUser`) — a RLS rejeita gravação com
 * qualquer outro valor. Enquanto a sessão ainda carrega, `evaluatorId`/`studentId` chegam vazios
 * e o hook fica parado em `loading` (nunca chama o repositório com id inválido).
 */
export function usePhysicalAssessmentDraft(
  studentId: string,
  evaluatorId: string,
  assessmentId?: string,
): UsePhysicalAssessmentDraftResult {
  const [assessment, setAssessment] = useState<PhysicalAssessment | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const assessmentRef = useRef<PhysicalAssessment | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    setSavedAt(null)
    setSaveError(null)

    if (!studentId || !evaluatorId) {
      return
    }

    async function loadSpecific(id: string): Promise<void> {
      const existing = await physicalAssessmentRepository.findById(id)
      if (!existing) throw new Error(`Avaliação ${id} não encontrada.`)
      if (cancelled) return
      assessmentRef.current = existing
      setAssessment(existing)
      setSavedAt(existing.updatedAt)
      setLoadState('ready')
    }

    async function loadOrCreateDraft(): Promise<void> {
      const existing = await physicalAssessmentRepository.findByStudentId(studentId)
      const drafts = existing.filter((item) => item.status === 'draft')
      const mostRecentDraft = drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

      const draft = mostRecentDraft ?? createDraftPhysicalAssessment(studentId, evaluatorId)
      if (!mostRecentDraft) {
        await physicalAssessmentRepository.saveDraft(draft)
      }

      if (cancelled) return
      assessmentRef.current = draft
      setAssessment(draft)
      setSavedAt(draft.updatedAt)
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

  /**
   * Usada tanto pelo auto-save (a cada alteração de `updateAssessment`) quanto pelo botão
   * "Salvar ficha" — mesmo saving/savedAt/saveError para as duas origens, é o que alimenta o
   * indicador no topo do wizard. Só adota o retorno do servidor se nada mudou localmente
   * enquanto a gravação estava em voo (`assessmentRef.current` ainda é a mesma referência que foi
   * enviada) — senão a resposta de uma tecla antiga sobrescreveria uma edição mais nova que já
   * disparou seu próprio save depois.
   */
  const persistDraft = useCallback(async (toSave: PhysicalAssessment) => {
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await physicalAssessmentRepository.saveDraft(toSave)
      if (assessmentRef.current === toSave) {
        assessmentRef.current = saved
        setAssessment(saved)
      }
      setSavedAt(saved.updatedAt)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao salvar.'
      console.error('Falha ao salvar a avaliação física:', error)
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }, [])

  const updateAssessment = useCallback(
    (patch: Partial<PhysicalAssessment>) => {
      const current = assessmentRef.current
      if (!current) return

      const updated: PhysicalAssessment = { ...current, ...patch }
      assessmentRef.current = updated
      setAssessment(updated)
      void persistDraft(updated)
    },
    [persistDraft],
  )

  const save = useCallback(async () => {
    const current = assessmentRef.current
    if (!current) return
    await persistDraft(current)
  }, [persistDraft])

  const complete = useCallback(async () => {
    const current = assessmentRef.current
    if (!current) return
    setSaving(true)
    setSaveError(null)
    try {
      const completed = await physicalAssessmentRepository.complete(current)
      assessmentRef.current = completed
      setAssessment(completed)
      setSavedAt(completed.updatedAt)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido ao concluir a avaliação.'
      console.error('Falha ao concluir a avaliação física:', error)
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }, [])

  return { assessment, loadState, updateAssessment, save, saving, savedAt, saveError, complete }
}
