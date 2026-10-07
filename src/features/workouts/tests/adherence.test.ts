import type { WorkoutDivision, WorkoutExerciseEntry } from '../domain/workout.types'
import type { SetLog, WorkoutLog } from '../domain/workoutLog.types'
import { describe, expect, it } from 'vitest'
import {
  buildAdherenceSessions,
  buildSessionDetail,
  compareLoad,
  formatDuration,
  prescribedSetsFor,
  sessionDurationMinutes,
  volumeFromSets,
} from '../domain/adherence'

function log(partial: Partial<WorkoutLog> & Pick<WorkoutLog, 'id' | 'divisionKey'>): WorkoutLog {
  return {
    studentId: 'aluno-1',
    workoutPlanId: 'ficha-1',
    startedAt: '2026-10-07T12:00:00.000Z',
    completedAt: '2026-10-07T13:00:00.000Z',
    notes: '',
    createdAt: '2026-10-07T12:00:00.000Z',
    updatedAt: '2026-10-07T13:00:00.000Z',
    ...partial,
  }
}

function set(partial: Partial<SetLog> & Pick<SetLog, 'workoutLogId' | 'exerciseId' | 'setIndex'>) {
  return {
    id: `${partial.workoutLogId}-${partial.exerciseId}-${partial.setIndex}`,
    studentId: 'aluno-1',
    exerciseName: 'Supino reto com barra',
    reps: 10,
    weightKg: 50,
    rpe: null,
    done: true,
    completedAt: '2026-10-07T12:30:00.000Z',
    createdAt: '2026-10-07T12:30:00.000Z',
    updatedAt: '2026-10-07T12:30:00.000Z',
    ...partial,
  } as SetLog
}

const entry = (partial: Partial<WorkoutExerciseEntry> = {}): WorkoutExerciseEntry => ({
  exerciseId: '0025',
  sets: 3,
  reps: '8-12',
  loadKg: 50,
  ...partial,
})

const divisions: WorkoutDivision[] = [
  { id: 'A', label: 'Superior', entries: [entry(), entry({ exerciseId: '0027', sets: 2 })] },
]

describe('volumeFromSets', () => {
  it('soma reps × carga só das séries marcadas como feitas', () => {
    const sets = [
      set({ workoutLogId: 'log-1', exerciseId: '0025', setIndex: 1, reps: 10, weightKg: 50 }),
      set({
        workoutLogId: 'log-1',
        exerciseId: '0025',
        setIndex: 2,
        reps: 10,
        weightKg: 50,
        done: false,
      }),
    ]
    expect(volumeFromSets(sets)).toBe(500)
  })

  it('série feita sem carga vale 0, não peso imaginário', () => {
    const sets = [
      set({ workoutLogId: 'log-1', exerciseId: '0001', setIndex: 1, reps: 15, weightKg: null }),
    ]
    expect(volumeFromSets(sets)).toBe(0)
  })

  it('arredonda a 1 casa em vez de vazar dízima de float', () => {
    const sets = [
      set({ workoutLogId: 'log-1', exerciseId: '0025', setIndex: 1, reps: 9, weightKg: 12.499 }),
    ]
    expect(volumeFromSets(sets)).toBe(112.5)
  })
})

describe('sessionDurationMinutes', () => {
  it('mede de startedAt a completedAt', () => {
    expect(
      sessionDurationMinutes({
        startedAt: '2026-10-07T12:00:00.000Z',
        completedAt: '2026-10-07T13:05:00.000Z',
      }),
    ).toBe(65)
  })

  it('sessão aberta não tem duração', () => {
    expect(
      sessionDurationMinutes({ startedAt: '2026-10-07T12:00:00.000Z', completedAt: null }),
    ).toBeNull()
  })

  it('arredonda para baixo: 40 segundos é 0 minuto, não 1', () => {
    expect(
      sessionDurationMinutes({
        startedAt: '2026-10-07T12:00:00.000Z',
        completedAt: '2026-10-07T12:00:40.000Z',
      }),
    ).toBe(0)
  })
})

describe('formatDuration', () => {
  it('traduz os casos de borda sem inventar número', () => {
    expect(formatDuration(null)).toBe('em andamento')
    expect(formatDuration(0)).toBe('menos de 1 min')
    expect(formatDuration(47)).toBe('47 min')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(95)).toBe('1h 35min')
  })
})

describe('buildAdherenceSessions', () => {
  it('traz as sessões da mais recente para a mais antiga, com feito sobre prescrito', () => {
    const logs = [
      log({ id: 'log-antiga', divisionKey: 'A', startedAt: '2026-10-05T12:00:00.000Z' }),
      log({ id: 'log-nova', divisionKey: 'A', startedAt: '2026-10-07T12:00:00.000Z' }),
    ]
    const sets = [
      set({ workoutLogId: 'log-nova', exerciseId: '0025', setIndex: 1 }),
      set({ workoutLogId: 'log-nova', exerciseId: '0025', setIndex: 2 }),
      set({ workoutLogId: 'log-antiga', exerciseId: '0025', setIndex: 1 }),
    ]

    const sessions = buildAdherenceSessions({ logs, sets, divisions })

    expect(sessions.map((session) => session.logId)).toEqual(['log-nova', 'log-antiga'])
    expect(sessions[0]).toMatchObject({
      divisionLabel: 'Superior',
      setsDone: 2,
      setsLogged: 2,
      // 3 séries do 0025 + 2 do 0027 na ficha publicada
      setsPrescribed: 5,
      volumeKg: 1000,
      durationMinutes: 60,
    })
  })

  it('divisão que saiu da ficha não ganha prescrito inventado', () => {
    const sessions = buildAdherenceSessions({
      logs: [log({ id: 'log-1', divisionKey: 'D' })],
      sets: [set({ workoutLogId: 'log-1', exerciseId: '0025', setIndex: 1 })],
      divisions,
    })

    expect(sessions[0]).toMatchObject({
      divisionKey: 'D',
      divisionLabel: null,
      setsPrescribed: null,
      setsDone: 1,
    })
  })

  it('sessão aberta aparece como em andamento, sem duração', () => {
    const sessions = buildAdherenceSessions({
      logs: [log({ id: 'log-1', divisionKey: 'A', completedAt: null })],
      sets: [],
      divisions,
    })

    expect(sessions[0]).toMatchObject({
      inProgress: true,
      durationMinutes: null,
      setsDone: 0,
      setsLogged: 0,
      volumeKg: 0,
    })
  })

  it('aluno sem sessão devolve lista vazia (a tela mostra estado vazio)', () => {
    expect(buildAdherenceSessions({ logs: [], sets: [], divisions })).toEqual([])
  })
})

describe('prescribedSetsFor', () => {
  it('soma as séries dos exercícios da divisão', () => {
    expect(prescribedSetsFor(divisions[0].entries)).toBe(5)
    expect(prescribedSetsFor([])).toBe(0)
  })
})

describe('compareLoad', () => {
  it('classifica abaixo, igual e acima do prescrito', () => {
    expect(compareLoad(45, 50)).toBe('below')
    expect(compareLoad(50, 50)).toBe('match')
    expect(compareLoad(55, 50)).toBe('above')
  })

  it('sem prescrição de carga ou sem carga registrada não é desvio, é desconhecido', () => {
    expect(compareLoad(45, null)).toBe('unknown')
    expect(compareLoad(45, undefined)).toBe('unknown')
    expect(compareLoad(null, 50)).toBe('unknown')
  })
})

describe('buildSessionDetail', () => {
  const exerciseName = (id: string) => (id === '0027' ? 'Crucifixo' : `Exercício ${id}`)

  it('compara série por série o que foi feito com o prescrito', () => {
    const sets = [
      set({ workoutLogId: 'log-1', exerciseId: '0025', setIndex: 2, weightKg: 55 }),
      set({ workoutLogId: 'log-1', exerciseId: '0025', setIndex: 1, weightKg: 45 }),
    ]

    const detail = buildSessionDetail({ sets, entries: divisions[0].entries, exerciseName })

    expect(detail).toHaveLength(2)
    // Nome do DIA do treino (denormalizado no log) ganha do rótulo atual do catálogo.
    expect(detail[0].exerciseName).toBe('Supino reto com barra')
    expect(detail[0].rows.map((row) => [row.setIndex, row.comparison])).toEqual([
      [1, 'below'],
      [2, 'above'],
    ])
  })

  it('exercício prescrito e não tocado entra sem série, com o nome do catálogo', () => {
    const detail = buildSessionDetail({
      sets: [set({ workoutLogId: 'log-1', exerciseId: '0025', setIndex: 1 })],
      entries: divisions[0].entries,
      exerciseName,
    })

    expect(detail[1]).toMatchObject({ exerciseId: '0027', exerciseName: 'Crucifixo', rows: [] })
  })

  it('série de exercício fora da ficha continua visível, no fim e sem prescrição', () => {
    const detail = buildSessionDetail({
      sets: [
        set({
          workoutLogId: 'log-1',
          exerciseId: '0099',
          setIndex: 1,
          exerciseName: 'Rosca martelo',
        }),
      ],
      entries: divisions[0].entries,
      exerciseName,
    })

    const extra = detail[detail.length - 1]
    expect(extra).toMatchObject({ exerciseId: '0099', exerciseName: 'Rosca martelo' })
    expect(extra.prescription).toBeNull()
    expect(extra.rows[0].comparison).toBe('unknown')
  })

  it('divisão fora da ficha e sem série registrada devolve lista vazia', () => {
    expect(buildSessionDetail({ sets: [], entries: [], exerciseName })).toEqual([])
  })
})
