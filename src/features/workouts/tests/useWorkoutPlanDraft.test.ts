import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Student } from '@/types/domain'
import type { WorkoutPlan } from '../domain/workout.types'

const findById = vi.fn()
const findForTrainer = vi.fn()
const saveDraft = vi.fn()
const publish = vi.fn()
const findLocal = vi.fn()

vi.mock('@/features/students/repositories/studentRepository', () => ({
  studentRepository: { findById: (id: string) => findById(id) },
}))

vi.mock('@/lib/supabase/useAuthUser', () => ({
  useAuthUser: () => ({ userId: 'personal-1', status: 'authenticated' }),
}))

vi.mock('../repositories/workoutPlanRepository', () => ({
  workoutPlanRepository: {
    findForTrainer: (...args: unknown[]) => findForTrainer(...args),
    saveDraft: (...args: unknown[]) => saveDraft(...args),
    publish: (...args: unknown[]) => publish(...args),
  },
}))

vi.mock('../repositories/indexedDbWorkoutPlanRepository', () => ({
  indexedDbWorkoutPlanRepository: { findByStudentId: (id: string) => findLocal(id) },
}))

import { useWorkoutPlanDraft } from '../hooks/useWorkoutPlanDraft'

const ALUNO = { id: 'aluno-1', name: 'Ana Souza' } as Student

function ficha(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    id: 'ficha-1',
    studentId: 'aluno-1',
    studentName: 'Ana Souza',
    objective: 'hipertrofia',
    weeklyFrequency: 3,
    notes: '',
    divisions: [
      { id: 'A', label: 'Superior', entries: [{ exerciseId: '0025', sets: 3, reps: '10' }] },
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('useWorkoutPlanDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findById.mockResolvedValue(ALUNO)
    findForTrainer.mockResolvedValue({ draft: null, published: null })
    findLocal.mockResolvedValue([])
  })

  it('salva o rascunho no banco como o personal logado', async () => {
    saveDraft.mockImplementation(async (plan: WorkoutPlan) => ({
      ...plan,
      updatedAt: '2026-09-02T10:00:00.000Z',
    }))
    const { result } = renderHook(() => useWorkoutPlanDraft('aluno-1'))

    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    await act(async () => {
      await result.current.save()
    })

    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(saveDraft.mock.calls[0][1]).toBe('personal-1')
    expect(publish).not.toHaveBeenCalled()
    expect(result.current.savedAt).toBe('2026-09-02T10:00:00.000Z')
    expect(result.current.saveError).toBeNull()
  })

  it('ficha nunca publicada tem alterações pendentes para o aluno', async () => {
    findForTrainer.mockResolvedValue({ draft: ficha(), published: null })
    const { result } = renderHook(() => useWorkoutPlanDraft('aluno-1'))

    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(result.current.publishedAt).toBeNull()
    expect(result.current.hasUnpublishedChanges).toBe(true)
  })

  it('publicar deixa a ficha igual à que o aluno vê', async () => {
    findForTrainer.mockResolvedValue({ draft: ficha(), published: null })
    publish.mockImplementation(async (plan: WorkoutPlan) => ({
      ...plan,
      updatedAt: '2026-10-07T12:00:00.000Z',
      publishedAt: '2026-10-07T12:00:00.000Z',
    }))
    const { result } = renderHook(() => useWorkoutPlanDraft('aluno-1'))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    await act(async () => {
      await result.current.publish()
    })

    expect(publish).toHaveBeenCalledTimes(1)
    expect(result.current.publishedAt).toBe('2026-10-07T12:00:00.000Z')
    expect(result.current.hasUnpublishedChanges).toBe(false)
  })

  it('editar depois de publicar volta a ter alterações pendentes', async () => {
    const publicada = ficha({ publishedAt: '2026-10-05T09:00:00.000Z' })
    findForTrainer.mockResolvedValue({ draft: publicada, published: publicada })
    const { result } = renderHook(() => useWorkoutPlanDraft('aluno-1'))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(result.current.hasUnpublishedChanges).toBe(false)

    act(() => result.current.updatePlan({ objective: 'emagrecimento' }))

    expect(result.current.hasUnpublishedChanges).toBe(true)
    expect(result.current.publishedAt).toBe('2026-10-05T09:00:00.000Z')
  })

  it('sem rascunho no banco, parte da ficha antiga do navegador', async () => {
    findLocal.mockResolvedValue([
      ficha({ objective: 'ficha antiga local', studentName: 'nome velho' }),
    ])
    const { result } = renderHook(() => useWorkoutPlanDraft('aluno-1'))

    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(result.current.plan?.objective).toBe('ficha antiga local')
    expect(result.current.plan?.studentName).toBe('Ana Souza')
    expect(result.current.savedAt).toBeNull()
  })

  /**
   * Regressao: sem `catch` no save, a rejeicao virava unhandled — o professor clicava
   * em salvar, a tela nao dizia nada, e a ficha se perdia ao sair da pagina.
   */
  it('expoe a falha em vez de engolir o erro', async () => {
    saveDraft.mockRejectedValue(new Error('new row violates row-level security policy'))
    const { result } = renderHook(() => useWorkoutPlanDraft('aluno-1'))

    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    await act(async () => {
      await result.current.save()
    })

    expect(result.current.saveError).toMatch(/row-level security/)
    expect(result.current.savedAt).toBeNull()
    expect(result.current.saving).toBe(false)
  })

  it('limpa o erro anterior quando um novo salvamento da certo', async () => {
    saveDraft.mockRejectedValueOnce(new Error('falha temporaria'))
    const { result } = renderHook(() => useWorkoutPlanDraft('aluno-1'))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    await act(async () => {
      await result.current.save()
    })
    expect(result.current.saveError).toBe('falha temporaria')

    saveDraft.mockImplementation(async (plan: WorkoutPlan) => ({
      ...plan,
      updatedAt: '2026-09-02T11:00:00.000Z',
    }))
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.saveError).toBeNull()
    expect(result.current.savedAt).toBe('2026-09-02T11:00:00.000Z')
  })
})
