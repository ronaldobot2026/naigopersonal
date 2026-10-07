import { describe, expect, it } from 'vitest'
import { estimateDurationMinutes, toStudentSessions } from '../domain/studentSessions'
import type { WorkoutPlan } from '../domain/workout.types'

function ficha(divisions: WorkoutPlan['divisions']): WorkoutPlan {
  return {
    id: 'ficha-1',
    studentId: 'aluno-1',
    studentName: 'Ana',
    objective: '',
    weeklyFrequency: null,
    notes: '',
    divisions,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }
}

describe('toStudentSessions', () => {
  it('cada divisão com exercício vira uma sessão, na ordem da ficha', () => {
    const sessions = toStudentSessions(
      ficha([
        { id: 'A', label: 'Superior', entries: [{ exerciseId: '0025', sets: 3, reps: '10' }] },
        { id: 'B', label: '', entries: [] },
        { id: 'C', label: ' Pernas ', entries: [{ exerciseId: '0043', sets: 4, reps: '8' }] },
      ]),
    )

    expect(sessions.map((session) => session.id)).toEqual(['A', 'C'])
    expect(sessions[0]).toMatchObject({ name: 'Treino A', focusTag: 'Superior' })
    expect(sessions[1].focusTag).toBe('Pernas')
  })

  it('o aluno recebe a prescrição exatamente como o personal montou', () => {
    const entries = [
      {
        exerciseId: '0025',
        sets: 4,
        reps: '6-8',
        loadKg: 40,
        rir: 2,
        restSeconds: 120,
        notes: 'pegada fechada',
      },
    ]
    const [session] = toStudentSessions(ficha([{ id: 'A', label: 'Peito', entries }]))
    expect(session.exercises).toEqual(entries)
  })
})

describe('estimateDurationMinutes', () => {
  it('soma execução e descanso de cada série, em blocos de 5 min', () => {
    // 3 séries × (45s + 60s padrão) = 315s ≈ 5,25 min → 10 min
    expect(estimateDurationMinutes([{ exerciseId: '1', sets: 3, reps: '10' }])).toBe(10)
  })

  it('treino vazio dura zero', () => {
    expect(estimateDurationMinutes([])).toBe(0)
  })

  it('usa o descanso prescrito quando há', () => {
    const curto = estimateDurationMinutes([
      { exerciseId: '1', sets: 10, reps: '10', restSeconds: 15 },
    ])
    const longo = estimateDurationMinutes([
      { exerciseId: '1', sets: 10, reps: '10', restSeconds: 180 },
    ])
    expect(longo).toBeGreaterThan(curto)
  })
})
