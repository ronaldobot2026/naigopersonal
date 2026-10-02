import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Student } from '@/types/domain'

const findById = vi.fn()
const save = vi.fn()
const findByStudentId = vi.fn()

vi.mock('@/features/students/repositories/studentRepository', () => ({
  studentRepository: { findById: (id: string) => findById(id) },
}))

vi.mock('../repositories/indexedDbWorkoutPlanRepository', () => ({
  indexedDbWorkoutPlanRepository: {
    findById: vi.fn(),
    findByStudentId: (id: string) => findByStudentId(id),
    save: (plan: unknown) => save(plan),
  },
}))

import { useWorkoutPlanDraft } from '../hooks/useWorkoutPlanDraft'

const ALUNO = { id: 'aluno-1', name: 'Ana Souza' } as Student

describe('useWorkoutPlanDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findById.mockResolvedValue(ALUNO)
    findByStudentId.mockResolvedValue([])
  })

  it('salva e registra o horario', async () => {
    save.mockImplementation(async (plan) => ({ ...plan, updatedAt: '2026-09-02T10:00:00.000Z' }))
    const { result } = renderHook(() => useWorkoutPlanDraft('aluno-1'))

    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    await act(async () => {
      await result.current.save()
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.savedAt).toBe('2026-09-02T10:00:00.000Z')
    expect(result.current.saveError).toBeNull()
  })

  /**
   * Regressao: sem `catch` no save, a rejeicao virava unhandled — o professor clicava
   * em salvar, a tela nao dizia nada, e a ficha se perdia ao sair da pagina.
   */
  it('expoe a falha em vez de engolir o erro', async () => {
    save.mockRejectedValue(new Error('Object store workoutPlans nao existe'))
    const { result } = renderHook(() => useWorkoutPlanDraft('aluno-1'))

    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    await act(async () => {
      await result.current.save()
    })

    expect(result.current.saveError).toMatch(/workoutPlans/)
    expect(result.current.savedAt).toBeNull()
    expect(result.current.saving).toBe(false)
  })

  it('limpa o erro anterior quando um novo salvamento da certo', async () => {
    save.mockRejectedValueOnce(new Error('falha temporaria'))
    const { result } = renderHook(() => useWorkoutPlanDraft('aluno-1'))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    await act(async () => {
      await result.current.save()
    })
    expect(result.current.saveError).toBe('falha temporaria')

    save.mockImplementation(async (plan) => ({ ...plan, updatedAt: '2026-09-02T11:00:00.000Z' }))
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.saveError).toBeNull()
    expect(result.current.savedAt).toBe('2026-09-02T11:00:00.000Z')
  })
})
