import { describe, expect, it } from 'vitest'
import {
  buildExecutionGroups,
  countDone,
  prescribedReps,
  setKey,
  toNumber,
  toSetDraft,
} from '../domain/workoutExecution'
import type { SetLog } from '../domain/workoutLog.types'
import type { WorkoutExerciseEntry } from '../domain/workout.types'

function entry(overrides: Partial<WorkoutExerciseEntry> = {}): WorkoutExerciseEntry {
  return { exerciseId: '0025', sets: 3, reps: '10', ...overrides }
}

function saved(overrides: Partial<SetLog> = {}): SetLog {
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
    completedAt: '2026-10-07T12:00:00.000Z',
    createdAt: '2026-10-07T12:00:00.000Z',
    updatedAt: '2026-10-07T12:00:00.000Z',
    ...overrides,
  }
}

const NOMES: Record<string, string> = { '0025': 'Supino reto', '0031': 'Remada curvada' }
const nome = (id: string) => NOMES[id] ?? ''

describe('prescribedReps', () => {
  it('usa a borda de baixo de uma faixa e ignora texto livre', () => {
    expect(prescribedReps('10')).toBe('10')
    expect(prescribedReps('8-12')).toBe('8')
    expect(prescribedReps('12 a 15')).toBe('12')
    expect(prescribedReps('até a falha')).toBe('')
    expect(prescribedReps('')).toBe('')
  })
})

describe('toNumber', () => {
  it('campo vazio é null, não zero — zero é uma carga que o aluno nunca levantou', () => {
    expect(toNumber('')).toBeNull()
    expect(toNumber('   ')).toBeNull()
    expect(toNumber('abc')).toBeNull()
  })

  it('aceita vírgula decimal (teclado numérico brasileiro)', () => {
    expect(toNumber('42,5')).toBe(42.5)
    expect(toNumber('42.5')).toBe(42.5)
    expect(toNumber('0')).toBe(0)
  })
})

describe('buildExecutionGroups', () => {
  it('abre uma linha por série prescrita, pré-preenchida com o prescrito', () => {
    const [grupo] = buildExecutionGroups({
      entries: [entry({ sets: 3, reps: '8-12', loadKg: 40 })],
      exerciseName: nome,
      savedSets: [],
      lastWeights: {},
    })

    expect(grupo.exerciseName).toBe('Supino reto')
    expect(grupo.rows).toHaveLength(3)
    expect(grupo.rows.map((row) => [row.reps, row.weightKg, row.done])).toEqual([
      ['8', '40', false],
      ['8', '40', false],
      ['8', '40', false],
    ])
    expect(grupo.rows[0].source).toBe('prescribed')
  })

  it('a última carga usada ganha do prescrito (é o peso que ele levantou de verdade)', () => {
    const [grupo] = buildExecutionGroups({
      entries: [entry({ loadKg: 40 })],
      exerciseName: nome,
      savedSets: [],
      lastWeights: {
        '0025': { weightKg: 47.5, reps: 8, completedAt: '2026-10-04T12:00:00.000Z' },
      },
    })

    expect(grupo.rows[0].weightKg).toBe('47.5')
    // Repetições continuam as de hoje: a carga é histórico, a reps é ordem do treino.
    expect(grupo.rows[0].reps).toBe('10')
    expect(grupo.rows[0].source).toBe('lastWeight')
    expect(grupo.lastWeight?.weightKg).toBe(47.5)
  })

  it('a série JÁ REGISTRADA ganha de tudo — é o que faz recarregar a página não apagar o treino', () => {
    const [grupo] = buildExecutionGroups({
      entries: [entry({ sets: 3, loadKg: 40 })],
      exerciseName: nome,
      savedSets: [saved({ setIndex: 2, reps: 9, weightKg: 42.5, done: true })],
      lastWeights: {
        '0025': { weightKg: 47.5, reps: 8, completedAt: '2026-10-04T12:00:00.000Z' },
      },
    })

    expect(grupo.rows[1]).toMatchObject({
      reps: '9',
      weightKg: '42.5',
      done: true,
      source: 'logged',
    })
    // As outras séries seguem como sugestão, e sem `done`.
    expect(grupo.rows[0]).toMatchObject({ weightKg: '47.5', done: false })
    expect(grupo.rows[2].done).toBe(false)
  })

  it('série registrada com campo em branco volta em branco, não como 0 nem como sugestão', () => {
    const [grupo] = buildExecutionGroups({
      entries: [entry({ sets: 1, loadKg: 40 })],
      exerciseName: nome,
      savedSets: [saved({ setIndex: 1, reps: null, weightKg: null, done: false })],
      lastWeights: {
        '0025': { weightKg: 47.5, reps: 8, completedAt: '2026-10-04T12:00:00.000Z' },
      },
    })

    expect(grupo.rows[0]).toMatchObject({ reps: '', weightKg: '' })
  })

  it('mantém visível a série extra que o aluno registrou além do prescrito', () => {
    const [grupo] = buildExecutionGroups({
      entries: [entry({ sets: 2 })],
      exerciseName: nome,
      savedSets: [saved({ setIndex: 4, id: 'set-4' })],
      lastWeights: {},
    })

    expect(grupo.rows).toHaveLength(4)
    expect(grupo.rows[3].source).toBe('logged')
  })

  it('cai no id quando o catálogo não conhece o exercício (log precisa de rótulo)', () => {
    const [grupo] = buildExecutionGroups({
      entries: [entry({ exerciseId: '9999' })],
      exerciseName: nome,
      savedSets: [],
      lastWeights: {},
    })

    expect(grupo.exerciseName).toBe('9999')
  })
})

describe('toSetDraft', () => {
  it('leva studentId e a chave da série — é o que a RLS e o upsert exigem', () => {
    const draft = toSetDraft({
      workoutLogId: 'log-1',
      studentId: 'aluno-1',
      exerciseId: '0025',
      exerciseName: 'Supino reto',
      row: { setIndex: 2, reps: '9', weightKg: '42,5', done: true, source: 'logged' },
    })

    expect(draft).toEqual({
      workoutLogId: 'log-1',
      studentId: 'aluno-1',
      exerciseId: '0025',
      exerciseName: 'Supino reto',
      setIndex: 2,
      reps: 9,
      weightKg: 42.5,
      done: true,
    })
  })
})

describe('setKey e countDone', () => {
  it('a chave da tela é a mesma identidade do índice único de set_logs', () => {
    expect(setKey('0025', 2)).toBe('0025#2')
  })

  it('conta o progresso somando as séries feitas de todos os exercícios', () => {
    const grupos = buildExecutionGroups({
      entries: [entry({ sets: 2 }), entry({ exerciseId: '0031', sets: 2 })],
      exerciseName: nome,
      savedSets: [saved({ setIndex: 1, done: true })],
      lastWeights: {},
    })

    expect(countDone(grupos)).toEqual({ done: 1, total: 4 })
  })
})
