import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findByStudentId = vi.fn()
const saveDraft = vi.fn()
const complete = vi.fn()

vi.mock('../repositories/indexedDbPhysicalAssessmentRepository', () => ({
  indexedDbPhysicalAssessmentRepository: {
    findById: vi.fn(),
    findByStudentId: (id: string) => findByStudentId(id),
    saveDraft: (assessment: unknown) => saveDraft(assessment),
    complete: (assessment: unknown) => complete(assessment),
  },
}))

import { usePhysicalAssessmentDraft } from '../hooks/usePhysicalAssessmentDraft'

describe('usePhysicalAssessmentDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findByStudentId.mockResolvedValue([])
    saveDraft.mockImplementation(async (assessment) => assessment)
  })

  it('salva o rascunho ao atualizar', async () => {
    const { result } = renderHook(() => usePhysicalAssessmentDraft('aluno-1', 'avaliador-1'))

    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    saveDraft.mockClear()

    await act(async () => {
      result.current.updateAssessment({ generalNotes: 'nota' })
    })
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1))
    expect(result.current.saveError).toBeNull()
  })

  /**
   * Regressao: sem `catch` no fire-and-forget do saveDraft, a rejeicao virava
   * unhandled — o campo mudava na tela, mas o rascunho nao era persistido.
   */
  it('expoe a falha do rascunho em vez de engolir o erro', async () => {
    const { result } = renderHook(() => usePhysicalAssessmentDraft('aluno-1', 'avaliador-1'))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    saveDraft.mockRejectedValueOnce(new Error('Object store physicalAssessments nao existe'))
    await act(async () => {
      result.current.updateAssessment({ generalNotes: 'nota' })
    })

    await waitFor(() => expect(result.current.saveError).toMatch(/physicalAssessments/))
  })

  it('limpa o erro anterior quando um novo salvamento da certo', async () => {
    const { result } = renderHook(() => usePhysicalAssessmentDraft('aluno-1', 'avaliador-1'))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    saveDraft.mockRejectedValueOnce(new Error('falha temporaria'))
    await act(async () => {
      result.current.updateAssessment({ generalNotes: 'nota 1' })
    })
    await waitFor(() => expect(result.current.saveError).toBe('falha temporaria'))

    saveDraft.mockResolvedValueOnce({ ...result.current.assessment, generalNotes: 'nota 2' })
    await act(async () => {
      result.current.updateAssessment({ generalNotes: 'nota 2' })
    })
    await waitFor(() => expect(result.current.saveError).toBeNull())
  })

  it('expoe a falha ao concluir em vez de travar sem feedback', async () => {
    const { result } = renderHook(() => usePhysicalAssessmentDraft('aluno-1', 'avaliador-1'))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    complete.mockRejectedValueOnce(new Error('falha ao concluir'))
    await act(async () => {
      await result.current.complete()
    })

    expect(result.current.completeError).toBe('falha ao concluir')
    expect(result.current.completing).toBe(false)
    expect(result.current.assessment?.status).toBe('draft')
  })

  it('conclui a avaliacao com sucesso', async () => {
    const { result } = renderHook(() => usePhysicalAssessmentDraft('aluno-1', 'avaliador-1'))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    complete.mockImplementation(async (assessment) => ({ ...assessment, status: 'completed' }))
    await act(async () => {
      await result.current.complete()
    })

    expect(result.current.assessment?.status).toBe('completed')
    expect(result.current.completeError).toBeNull()
  })
})
