import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetLog, WorkoutLog } from '../domain/workoutLog.types'
import type { WorkoutExerciseEntry } from '../domain/workout.types'

const findOpenSession = vi.fn()
const startSession = vi.fn()
const listSets = vi.fn()
const upsertSet = vi.fn()
const lastWeightFor = vi.fn()

vi.mock('@/lib/supabase/useAuthUser', () => ({
  useAuthUser: () => ({ userId: 'aluno-1', status: 'authenticated' }),
}))

vi.mock('../repositories/workoutLogRepository', () => ({
  workoutLogRepository: {
    findOpenSession: (...args: unknown[]) => findOpenSession(...args),
    startSession: (...args: unknown[]) => startSession(...args),
    listSets: (...args: unknown[]) => listSets(...args),
    upsertSet: (...args: unknown[]) => upsertSet(...args),
    lastWeightFor: (...args: unknown[]) => lastWeightFor(...args),
  },
}))

import { useWorkoutExecution } from '../hooks/useWorkoutExecution'

const ENTRIES: WorkoutExerciseEntry[] = [{ exerciseId: '0025', sets: 2, reps: '10', loadKg: 40 }]

function log(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'log-1',
    studentId: 'aluno-1',
    workoutPlanId: 'ficha-1',
    divisionKey: 'A',
    startedAt: '2026-10-07T12:00:00.000Z',
    completedAt: null,
    notes: '',
    createdAt: '2026-10-07T12:00:00.000Z',
    updatedAt: '2026-10-07T12:00:00.000Z',
    ...overrides,
  }
}

function setLog(overrides: Partial<SetLog> = {}): SetLog {
  return {
    id: 'set-1',
    workoutLogId: 'log-1',
    studentId: 'aluno-1',
    exerciseId: '0025',
    exerciseName: 'Supino reto',
    setIndex: 1,
    reps: 9,
    weightKg: 42.5,
    rpe: null,
    done: true,
    completedAt: '2026-10-07T12:05:00.000Z',
    createdAt: '2026-10-07T12:00:00.000Z',
    updatedAt: '2026-10-07T12:05:00.000Z',
    ...overrides,
  }
}

function render() {
  return renderHook(() =>
    useWorkoutExecution({
      divisionKey: 'A',
      planId: 'ficha-1',
      entries: ENTRIES,
      exerciseName: () => 'Supino reto',
      ready: true,
    }),
  )
}

describe('useWorkoutExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    findOpenSession.mockResolvedValue(null)
    startSession.mockResolvedValue(log())
    listSets.mockResolvedValue([])
    upsertSet.mockImplementation((draft: unknown) => Promise.resolve(draft))
    lastWeightFor.mockResolvedValue(null)
  })

  it('sem sessão aberta fica idle (a tela mostra "Iniciar treino") e não grava nada', async () => {
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('idle'))

    expect(startSession).not.toHaveBeenCalled()
    expect(listSets).not.toHaveBeenCalled()
    // Pré-preenchimento já consultado para a tela mostrar a referência de carga.
    expect(lastWeightFor).toHaveBeenCalledWith('aluno-1', '0025')
  })

  it('retoma a sessão aberta na montagem, com as séries já marcadas', async () => {
    findOpenSession.mockResolvedValue(log())
    listSets.mockResolvedValue([setLog()])

    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(findOpenSession).toHaveBeenCalledWith('aluno-1', 'A')
    expect(listSets).toHaveBeenCalledWith('log-1')
    expect(result.current.groups[0].rows[0]).toMatchObject({
      reps: '9',
      weightKg: '42.5',
      done: true,
    })
    expect(result.current.progress).toEqual({ done: 1, total: 2 })
  })

  it('"Iniciar treino" delega a idempotência ao startSession e entra em execução', async () => {
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('idle'))

    await act(async () => {
      await result.current.start()
    })

    expect(startSession).toHaveBeenCalledWith('aluno-1', 'ficha-1', 'A')
    expect(result.current.status).toBe('ready')
  })

  it('digitar não gera uma request por tecla: só a última chega ao banco', async () => {
    findOpenSession.mockResolvedValue(log())
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    vi.useFakeTimers()
    act(() => {
      result.current.updateRow('0025', 1, { weightKg: '4' })
      result.current.updateRow('0025', 1, { weightKg: '42' })
      result.current.updateRow('0025', 1, { weightKg: '42.5' })
    })

    expect(upsertSet).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    vi.useRealTimers()

    await waitFor(() => expect(upsertSet).toHaveBeenCalledTimes(1))
    expect(upsertSet).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutLogId: 'log-1',
        studentId: 'aluno-1',
        exerciseId: '0025',
        exerciseName: 'Supino reto',
        setIndex: 1,
        weightKg: 42.5,
      }),
    )
  })

  it('marcar "feita" grava na hora, com o valor que acabou de ser digitado', async () => {
    findOpenSession.mockResolvedValue(log())
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      result.current.updateRow('0025', 1, { weightKg: '50' })
      result.current.updateRow('0025', 1, { done: true })
    })

    await waitFor(() => expect(upsertSet).toHaveBeenCalledTimes(1))
    expect(upsertSet).toHaveBeenCalledWith(
      expect.objectContaining({ weightKg: 50, done: true, setIndex: 1 }),
    )
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'))
    expect(result.current.progress.done).toBe(1)
  })

  it('cada campo tem seu próprio timer — o exercício 2 não espera o 1', async () => {
    findOpenSession.mockResolvedValue(log())
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    vi.useFakeTimers()
    act(() => {
      result.current.updateRow('0025', 1, { reps: '9' })
      result.current.updateRow('0025', 2, { reps: '8' })
    })
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    vi.useRealTimers()

    await waitFor(() => expect(upsertSet).toHaveBeenCalledTimes(2))
    expect(upsertSet.mock.calls.map(([draft]) => (draft as { setIndex: number }).setIndex)).toEqual(
      [1, 2],
    )
  })

  it('falha de gravação vira aviso na tela, sem perder o que o aluno digitou', async () => {
    findOpenSession.mockResolvedValue(log())
    upsertSet.mockRejectedValue(new Error('rede indisponível'))
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      result.current.updateRow('0025', 1, { done: true })
    })

    await waitFor(() => expect(result.current.saveStatus).toBe('error'))
    expect(result.current.errorMessage).toBe('rede indisponível')
    expect(result.current.groups[0].rows[0].done).toBe(true)
    expect(result.current.status).toBe('ready')
  })
})
