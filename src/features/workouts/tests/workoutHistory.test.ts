import { describe, expect, it } from 'vitest'
import {
  calendarDaysAgo,
  describeHistorySets,
  describeLastWeight,
  formatRelativeDay,
  formatWeight,
  groupHistorySessions,
} from '../domain/workoutHistory'
import type { SetLog } from '../domain/workoutLog.types'

/**
 * O que estes testes protegem:
 *
 * 1. A linha "última: 32 kg × 10, 3 dias atrás" — o número que faz o aluno progredir.
 * 2. O agrupamento por SESSÃO (e não por dia): dois treinos no mesmo dia são dois treinos.
 * 3. O histórico montado SÓ com o que está denormalizado na série. É o teste real da F10-1: a
 *    ficha pode ter sido editada ou apagada, e nada aqui olha para `workout_plans`.
 */

function setLog(overrides: Partial<SetLog> = {}): SetLog {
  return {
    id: `set-${Math.random().toString(36).slice(2, 8)}`,
    workoutLogId: 'log-1',
    studentId: 'aluno-1',
    exerciseId: '0025',
    exerciseName: 'Supino reto com barra',
    setIndex: 1,
    reps: 10,
    weightKg: 32,
    rpe: null,
    done: true,
    completedAt: '2026-10-07T12:00:00.000Z',
    createdAt: '2026-10-07T12:00:00.000Z',
    updatedAt: '2026-10-07T12:00:00.000Z',
    ...overrides,
  }
}

/** Fuso local, para o teste de dias de calendário não depender de UTC. */
function local(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour)
}

describe('formatRelativeDay', () => {
  const agora = local(2026, 10, 7, 9)

  it('conta dias de CALENDÁRIO: treinar 23h e olhar 7h do dia seguinte é "ontem"', () => {
    expect(formatRelativeDay(local(2026, 10, 6, 23).toISOString(), agora)).toBe('ontem')
    expect(calendarDaysAgo(local(2026, 10, 6, 23).toISOString(), agora)).toBe(1)
  })

  it('usa hoje/ontem/N dias/semanas e cai para data acima de 4 semanas', () => {
    expect(formatRelativeDay(local(2026, 10, 7, 6).toISOString(), agora)).toBe('hoje')
    expect(formatRelativeDay(local(2026, 10, 4).toISOString(), agora)).toBe('3 dias atrás')
    expect(formatRelativeDay(local(2026, 9, 30).toISOString(), agora)).toBe('1 semana atrás')
    expect(formatRelativeDay(local(2026, 9, 20).toISOString(), agora)).toBe('2 semanas atrás')
    expect(formatRelativeDay(local(2026, 8, 12).toISOString(), agora)).toBe('12/08')
  })

  it('data inválida não quebra a tela: devolve string vazia', () => {
    expect(formatRelativeDay('nunca')).toBe('')
    expect(calendarDaysAgo('nunca')).toBeNull()
  })
})

describe('describeLastWeight', () => {
  const agora = local(2026, 10, 7, 9)

  it('monta a referência do executor com carga, reps e quando foi', () => {
    expect(
      describeLastWeight(
        { weightKg: 32, reps: 10, completedAt: local(2026, 10, 4).toISOString() },
        agora,
      ),
    ).toBe('última: 32 kg × 10, 3 dias atrás')
  })

  it('carga fracionada sai em pt-BR, sem ",0" pendurado', () => {
    expect(formatWeight(32.5)).toBe('32,5 kg')
    expect(formatWeight(32)).toBe('32 kg')
    expect(
      describeLastWeight(
        { weightKg: 32.5, reps: 8, completedAt: local(2026, 10, 7).toISOString() },
        agora,
      ),
    ).toBe('última: 32,5 kg × 8, hoje')
  })

  it('exercício de peso do corpo (sem carga) não mostra "null kg"', () => {
    expect(
      describeLastWeight(
        { weightKg: null, reps: 12, completedAt: local(2026, 10, 6).toISOString() },
        agora,
      ),
    ).toBe('última: sem carga × 12, ontem')
    expect(
      describeLastWeight(
        { weightKg: null, reps: null, completedAt: local(2026, 10, 6).toISOString() },
        agora,
      ),
    ).toBe('última: série feita, ontem')
  })

  it('primeira vez no exercício não vira linha nenhuma na tela', () => {
    expect(describeLastWeight(null, agora)).toBeNull()
  })
})

describe('groupHistorySessions', () => {
  it('agrupa por sessão, ordena da mais recente e resume carga máxima e volume', () => {
    const sessions = groupHistorySessions([
      setLog({
        workoutLogId: 'log-hoje',
        setIndex: 2,
        weightKg: 35,
        reps: 8,
        completedAt: '2026-10-07T12:10:00.000Z',
      }),
      setLog({
        workoutLogId: 'log-hoje',
        setIndex: 1,
        weightKg: 32.5,
        reps: 10,
        completedAt: '2026-10-07T12:00:00.000Z',
      }),
      setLog({
        workoutLogId: 'log-antigo',
        setIndex: 1,
        weightKg: 30,
        reps: 10,
        completedAt: '2026-10-01T12:00:00.000Z',
      }),
    ])

    expect(sessions.map((session) => session.logId)).toEqual(['log-hoje', 'log-antigo'])
    expect(sessions[0]).toMatchObject({
      topWeightKg: 35,
      totalReps: 18,
      completedAt: '2026-10-07T12:10:00.000Z',
    })
    // Séries na ordem de execução, mesmo chegando do banco em ordem decrescente de data.
    expect(sessions[0].sets.map((set) => set.setIndex)).toEqual([1, 2])
    expect(describeHistorySets(sessions[0])).toBe('32,5 kg × 10 · 35 kg × 8')
  })

  it('dois treinos no MESMO dia são duas sessões (não soma manhã com noite)', () => {
    const sessions = groupHistorySessions([
      setLog({ workoutLogId: 'manha', completedAt: '2026-10-07T09:00:00.000Z', weightKg: 30 }),
      setLog({ workoutLogId: 'noite', completedAt: '2026-10-07T21:00:00.000Z', weightKg: 32 }),
    ])

    expect(sessions).toHaveLength(2)
    expect(sessions.map((session) => session.logId)).toEqual(['noite', 'manha'])
  })

  it('série ainda em andamento (completed_at null) não entra no histórico', () => {
    const sessions = groupHistorySessions([
      setLog({ workoutLogId: 'agora', setIndex: 1, completedAt: null, done: false }),
      setLog({ workoutLogId: 'passado', setIndex: 1, completedAt: '2026-10-01T12:00:00.000Z' }),
    ])

    expect(sessions.map((session) => session.logId)).toEqual(['passado'])
  })

  it('corta no teto de sessões pedido', () => {
    const sets = Array.from({ length: 10 }, (_, index) =>
      setLog({
        workoutLogId: `log-${index}`,
        completedAt: new Date(Date.UTC(2026, 8, index + 1, 12)).toISOString(),
      }),
    )

    expect(groupHistorySessions(sets, 3)).toHaveLength(3)
    expect(groupHistorySessions(sets, 3)[0].logId).toBe('log-9')
  })

  it('histórico sobrevive à ficha apagada: nada é lido de workout_plans', () => {
    // Exatamente o cenário da F10-1: a ficha morreu (`workout_plan_id` virou null na sessão) e o
    // catálogo renomeou o exercício depois. O histórico continua legível porque `exercise_name` e
    // `weight_kg` moram na própria série.
    const sessions = groupHistorySessions([
      setLog({
        workoutLogId: 'log-de-ficha-morta',
        exerciseName: 'Supino reto com barra',
        weightKg: 32,
        reps: 10,
        completedAt: '2026-09-30T12:00:00.000Z',
      }),
    ])

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      exerciseName: 'Supino reto com barra',
      topWeightKg: 32,
      totalReps: 10,
    })
    expect(describeHistorySets(sessions[0])).toBe('32 kg × 10')
  })
})
