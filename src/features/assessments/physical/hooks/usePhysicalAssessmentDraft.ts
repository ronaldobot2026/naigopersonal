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
  /**
   * Força a gravação da linha em `physical_assessments` antes de qualquer operação que dependa
   * dela por chave estrangeira (upload de foto em `assessment_photos`, plano corretivo postural).
   * Com a criação preguiçosa o rascunho pode ainda só existir em memória; sem isso o insert
   * filho quebraria com violação de FK. Não faz nada quando a avaliação já está no banco.
   */
  ensurePersisted: () => Promise<void>
}

/**
 * Carrega (ou cria) o rascunho de Avaliação Física de um aluno e persiste cada alteração
 * imediatamente no Supabase via `physicalAssessmentRepository` — é isso que permite recuperar
 * o rascunho ao recarregar a página (ou trocar de máquina) no meio do preenchimento.
 *
 * CRIAÇÃO PREGUIÇOSA: abrir a tela "Nova avaliação" NÃO grava nada no banco. Antes, o hook criava
 * a linha já na montagem, então todo personal que só espiava a tela deixava um rascunho vazio
 * para trás — o banco acumulou 5 assim. Agora o rascunho novo vive só em memória
 * (`persistedRef = false`) e a primeira gravação acontece na primeira alteração real de campo
 * (`updateAssessment`), no "Salvar ficha" (`save`), no `complete()` ou no `ensurePersisted()`
 * exigido por quem depende da FK (fotos/postural).
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
  /**
   * `true` quando a avaliação atual já tem linha no banco (veio do banco ou já foi gravada).
   * `false` significa rascunho novo que ainda só existe em memória — é o que evita poluir o
   * banco com rascunhos vazios de telas abertas e abandonadas.
   */
  const persistedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    setSavedAt(null)
    setSaveError(null)
    persistedRef.current = false

    if (!studentId || !evaluatorId) {
      return
    }

    async function loadSpecific(id: string): Promise<void> {
      const existing = await physicalAssessmentRepository.findById(id)
      if (!existing) throw new Error(`Avaliação ${id} não encontrada.`)
      if (cancelled) return
      assessmentRef.current = existing
      persistedRef.current = true
      setAssessment(existing)
      setSavedAt(existing.updatedAt)
      setLoadState('ready')
    }

    async function loadOrCreateDraft(): Promise<void> {
      const existing = await physicalAssessmentRepository.findByStudentId(studentId)
      const drafts = existing.filter((item) => item.status === 'draft')
      const mostRecentDraft = drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

      const draft = mostRecentDraft ?? createDraftPhysicalAssessment(studentId, evaluatorId)

      if (cancelled) return
      assessmentRef.current = draft
      // Rascunho retomado já existe no banco; o recém-criado não — e só será gravado na 1ª edição.
      persistedRef.current = Boolean(mostRecentDraft)
      setAssessment(draft)
      // O indicador do wizard não pode dizer "Salvo" para algo que ainda não foi gravado.
      setSavedAt(mostRecentDraft ? draft.updatedAt : null)
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
      // A partir daqui a linha existe no banco — fotos e postural já podem referenciá-la por FK.
      persistedRef.current = true
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

  const ensurePersisted = useCallback(async () => {
    const current = assessmentRef.current
    if (!current || persistedRef.current) return
    await persistDraft(current)
  }, [persistDraft])

  const complete = useCallback(async () => {
    const current = assessmentRef.current
    if (!current) return
    setSaving(true)
    setSaveError(null)
    try {
      // `complete` faz upsert com status 'completed', então ele já cria a linha se ela ainda não
      // existir — concluir uma avaliação nunca gravada funciona em uma única chamada.
      const completed = await physicalAssessmentRepository.complete(current)
      persistedRef.current = true
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

  return {
    assessment,
    loadState,
    updateAssessment,
    save,
    saving,
    savedAt,
    saveError,
    complete,
    ensurePersisted,
  }
}
