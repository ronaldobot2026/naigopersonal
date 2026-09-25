import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PhysicalAssessment } from '@/types/domain'

/**
 * Criação preguiçosa do rascunho.
 *
 * Abrir "Nova avaliação" gravava a linha no banco na hora, então toda tela aberta e abandonada
 * deixava um rascunho vazio para trás (o banco acumulou 5). O rascunho novo passa a viver só em
 * memória até a primeira alteração real de campo. Os testes abaixo travam esse contrato e também
 * o que não pode regredir junto: retomar rascunho, reabrir avaliação do histórico e nunca
 * rebaixar uma avaliação concluída.
 */

const findById = vi.fn()
const findByStudentId = vi.fn()
const saveDraft = vi.fn()
const complete = vi.fn()

vi.mock('../repositories/physicalAssessmentRepository', () => ({
  physicalAssessmentRepository: {
    findById: (id: string) => findById(id),
    findByStudentId: (id: string) => findByStudentId(id),
    saveDraft: (assessment: PhysicalAssessment) => saveDraft(assessment),
    complete: (assessment: PhysicalAssessment) => complete(assessment),
  },
}))

import { usePhysicalAssessmentDraft } from '../hooks/usePhysicalAssessmentDraft'

const ALUNO = 'aluno-1'
const AVALIADOR = 'personal-1'

function avaliacao(overrides: Partial<PhysicalAssessment> = {}): PhysicalAssessment {
  return {
    id: 'avaliacao-1',
    studentId: ALUNO,
    evaluatorId: AVALIADOR,
    createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    status: 'draft',
    biometrics: {} as PhysicalAssessment['biometrics'],
    anthropometry: {} as PhysicalAssessment['anthropometry'],
    visualRecords: [],
    ...overrides,
  }
}

describe('usePhysicalAssessmentDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findByStudentId.mockResolvedValue([])
    // Ecoa de volta o que recebeu, como o repositório real faz depois do upsert.
    saveDraft.mockImplementation(async (a: PhysicalAssessment) => ({
      ...a,
      status: a.status === 'completed' ? 'completed' : 'draft',
      updatedAt: '2026-09-25T10:00:00.000Z',
    }))
    complete.mockImplementation(async (a: PhysicalAssessment) => ({
      ...a,
      status: 'completed',
      updatedAt: '2026-09-25T11:00:00.000Z',
    }))
  })

  it('não grava nada no banco ao abrir a tela sem alterar nenhum campo', async () => {
    const { result } = renderHook(() => usePhysicalAssessmentDraft(ALUNO, AVALIADOR))

    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    expect(saveDraft).not.toHaveBeenCalled()
    expect(result.current.assessment).not.toBeNull()
    expect(result.current.assessment?.status).toBe('draft')
    // O indicador do wizard não pode dizer "Salvo" para algo que ainda não existe no banco.
    expect(result.current.savedAt).toBeNull()
  })

  it('persiste o rascunho na primeira alteração real de campo', async () => {
    const { result } = renderHook(() => usePhysicalAssessmentDraft(ALUNO, AVALIADOR))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    act(() => {
      result.current.updateAssessment({ generalNotes: 'Aluno com dor lombar' })
    })

    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1))
    expect(saveDraft.mock.calls[0][0].generalNotes).toBe('Aluno com dor lombar')
    await waitFor(() => expect(result.current.savedAt).toBe('2026-09-25T10:00:00.000Z'))
  })

  it('não chama o repositório enquanto a sessão ainda está carregando (evaluatorId vazio)', async () => {
    const { result } = renderHook(() => usePhysicalAssessmentDraft(ALUNO, ''))

    expect(result.current.loadState).toBe('loading')
    expect(findByStudentId).not.toHaveBeenCalled()
    expect(saveDraft).not.toHaveBeenCalled()
  })

  it('retoma o rascunho mais recente do aluno sem criar outro', async () => {
    const existente = avaliacao({ id: 'rascunho-antigo', updatedAt: '2026-09-24T00:00:00.000Z' })
    findByStudentId.mockResolvedValue([existente])

    const { result } = renderHook(() => usePhysicalAssessmentDraft(ALUNO, AVALIADOR))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    expect(result.current.assessment?.id).toBe('rascunho-antigo')
    expect(saveDraft).not.toHaveBeenCalled()
    // Rascunho retomado já existe no banco, então o horário de gravação é legítimo.
    expect(result.current.savedAt).toBe('2026-09-24T00:00:00.000Z')
  })

  it('reabre uma avaliação existente por assessmentId', async () => {
    findById.mockResolvedValue(avaliacao({ id: 'avaliacao-9', generalNotes: 'anotação salva' }))

    const { result } = renderHook(() =>
      usePhysicalAssessmentDraft(ALUNO, AVALIADOR, 'avaliacao-9'),
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    expect(findById).toHaveBeenCalledWith('avaliacao-9')
    expect(findByStudentId).not.toHaveBeenCalled()
    expect(result.current.assessment?.generalNotes).toBe('anotação salva')
    expect(saveDraft).not.toHaveBeenCalled()
  })

  it('não rebaixa para rascunho uma avaliação concluída reaberta e editada', async () => {
    findById.mockResolvedValue(avaliacao({ id: 'avaliacao-9', status: 'completed' }))

    const { result } = renderHook(() =>
      usePhysicalAssessmentDraft(ALUNO, AVALIADOR, 'avaliacao-9'),
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    act(() => {
      result.current.updateAssessment({ generalNotes: 'correção pós-consulta' })
    })

    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1))
    expect(saveDraft.mock.calls[0][0].status).toBe('completed')
    await waitFor(() => expect(result.current.assessment?.status).toBe('completed'))
  })

  it('conclui uma avaliação que nunca foi gravada, sem save prévio', async () => {
    const { result } = renderHook(() => usePhysicalAssessmentDraft(ALUNO, AVALIADOR))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    await act(async () => {
      await result.current.complete()
    })

    expect(saveDraft).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledTimes(1)
    expect(result.current.assessment?.status).toBe('completed')
    expect(result.current.savedAt).toBe('2026-09-25T11:00:00.000Z')
  })

  it('ensurePersisted grava uma vez só e não regrava depois', async () => {
    const { result } = renderHook(() => usePhysicalAssessmentDraft(ALUNO, AVALIADOR))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    await act(async () => {
      await result.current.ensurePersisted()
    })
    expect(saveDraft).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.ensurePersisted()
    })
    expect(saveDraft).toHaveBeenCalledTimes(1)
  })
})
