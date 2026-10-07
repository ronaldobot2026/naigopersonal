import { describe, expect, it } from 'vitest'
import {
  isSameLocalDay,
  resolveTrainingDay,
  startOfTrainingWeek,
  suggestDivision,
  summarizeWeek,
} from '../domain/trainingDay'
import type { WorkoutLog } from '../domain/workoutLog.types'

/** Datas locais: o estado do dia é calculado no fuso do aluno, então os fixtures também. */
function localIso(year: number, month: number, day: number, hour = 12, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString()
}

function log(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  const started = overrides.startedAt ?? localIso(2026, 10, 7, 18)
  return {
    id: 'log-1',
    studentId: 'aluno-1',
    workoutPlanId: 'ficha-1',
    divisionKey: 'A',
    startedAt: started,
    completedAt: null,
    notes: '',
    createdAt: started,
    updatedAt: started,
    ...overrides,
  }
}

// Quarta-feira, 7 de outubro de 2026, 20h local.
const NOW = new Date(2026, 9, 7, 20, 0, 0, 0)

describe('startOfTrainingWeek', () => {
  it('ancora a semana na segunda-feira 00:00 local', () => {
    const start = startOfTrainingWeek(NOW)
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(5)
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0])
  })

  it('domingo pertence à semana que começou na segunda anterior', () => {
    const sunday = new Date(2026, 9, 11, 9, 0, 0, 0)
    expect(startOfTrainingWeek(sunday).getDate()).toBe(5)
  })
})

describe('isSameLocalDay', () => {
  it('compara o dia do calendário, não as últimas 24 horas', () => {
    expect(isSameLocalDay(localIso(2026, 10, 7, 0, 10), localIso(2026, 10, 7, 23, 50))).toBe(true)
    expect(isSameLocalDay(localIso(2026, 10, 6, 23, 50), localIso(2026, 10, 7, 0, 10))).toBe(false)
  })
})

describe('resolveTrainingDay', () => {
  it('sem sessão nenhuma o dia é "a fazer" — e não há sessão a referenciar', () => {
    expect(resolveTrainingDay([], NOW)).toEqual({ state: 'todo', session: null })
  })

  it('sessão aberta vence: o aluno está no meio do treino', () => {
    const open = log({ id: 'aberta' })
    const status = resolveTrainingDay([open], NOW)
    expect(status.state).toBe('in_progress')
    expect(status.session?.id).toBe('aberta')
  })

  it('sessão aberta de ontem continua em andamento, em vez de desaparecer', () => {
    const stale = log({ id: 'ontem', startedAt: localIso(2026, 10, 6, 19) })
    expect(resolveTrainingDay([stale], NOW).state).toBe('in_progress')
  })

  it('sessão concluída hoje marca o dia como concluído', () => {
    const done = log({ id: 'hoje', completedAt: localIso(2026, 10, 7, 19, 30) })
    const status = resolveTrainingDay([done], NOW)
    expect(status.state).toBe('completed_today')
    expect(status.session?.id).toBe('hoje')
  })

  it('treino concluído ontem não vira "concluído hoje"', () => {
    const yesterday = log({ completedAt: localIso(2026, 10, 6, 19) })
    expect(resolveTrainingDay([yesterday], NOW).state).toBe('todo')
  })

  it('com várias concluídas hoje, aponta a mais recente', () => {
    const first = log({ id: 'a', completedAt: localIso(2026, 10, 7, 8) })
    const second = log({ id: 'b', divisionKey: 'B', completedAt: localIso(2026, 10, 7, 19) })
    expect(resolveTrainingDay([first, second], NOW).session?.id).toBe('b')
  })
})

describe('summarizeWeek', () => {
  it('aluno zerado não recebe número: hasHistory é falso', () => {
    const week = summarizeWeek({ logs: [], weeklyFrequency: 3, now: NOW })
    expect(week).toMatchObject({ completed: 0, target: 3, hasHistory: false })
  })

  it('conta só as sessões CONCLUÍDAS desta semana', () => {
    const logs = [
      log({ id: '1', completedAt: localIso(2026, 10, 5, 19) }), // segunda, conta
      log({ id: '2', completedAt: localIso(2026, 10, 6, 19) }), // terça, conta
      log({ id: '3' }), // em andamento, não conta
      log({ id: '4', completedAt: localIso(2026, 10, 2, 19) }), // semana passada
    ]
    const week = summarizeWeek({ logs, weeklyFrequency: 4, now: NOW })
    expect(week.completed).toBe(2)
    expect(week.hasHistory).toBe(true)
    expect(week.target).toBe(4)
  })

  it('ficha sem frequência preenchida devolve target null (nunca chuta 3)', () => {
    const week = summarizeWeek({
      logs: [log({ completedAt: localIso(2026, 10, 6, 19) })],
      weeklyFrequency: null,
      now: NOW,
    })
    expect(week.target).toBeNull()
    expect(week.completed).toBe(1)
  })

  it('treino começado no domingo e concluído na segunda conta na semana em que acabou', () => {
    const logs = [
      log({ startedAt: localIso(2026, 10, 4, 23), completedAt: localIso(2026, 10, 5, 0, 30) }),
    ]
    expect(summarizeWeek({ logs, weeklyFrequency: null, now: NOW }).completed).toBe(1)
  })
})

describe('suggestDivision', () => {
  const keys = ['A', 'B', 'C']

  it('ficha sem divisão não sugere nada', () => {
    expect(suggestDivision({ divisionKeys: [], logs: [], now: NOW })).toMatchObject({
      divisionKey: null,
      pending: [],
    })
  })

  it('aluno zerado na semana começa pela primeira divisão do ciclo', () => {
    const suggestion = suggestDivision({ divisionKeys: keys, logs: [], now: NOW })
    expect(suggestion.divisionKey).toBe('A')
    expect(suggestion.pending).toEqual(['A', 'B', 'C'])
    expect(suggestion.cycleComplete).toBe(false)
  })

  it('sugere a próxima do ciclo depois da última concluída', () => {
    const logs = [log({ divisionKey: 'A', completedAt: localIso(2026, 10, 5, 19) })]
    const suggestion = suggestDivision({ divisionKeys: keys, logs, now: NOW })
    expect(suggestion.divisionKey).toBe('B')
    expect(suggestion.doneThisWeek).toEqual(['A'])
    expect(suggestion.pending).toEqual(['B', 'C'])
  })

  it('não repete divisão já feita na semana, mesmo fora de ordem', () => {
    const logs = [
      log({ id: '1', divisionKey: 'B', completedAt: localIso(2026, 10, 5, 19) }),
      log({ id: '2', divisionKey: 'C', completedAt: localIso(2026, 10, 6, 19) }),
    ]
    const suggestion = suggestDivision({ divisionKeys: keys, logs, now: NOW })
    expect(suggestion.divisionKey).toBe('A')
    expect(suggestion.pending).toEqual(['A'])
  })

  it('ciclo fechado reinicia na seguinte à última concluída e avisa', () => {
    const logs = keys.map((key, index) =>
      log({ id: key, divisionKey: key, completedAt: localIso(2026, 10, 5 + index, 19) }),
    )
    const suggestion = suggestDivision({ divisionKeys: keys, logs, now: NOW })
    expect(suggestion.cycleComplete).toBe(true)
    expect(suggestion.divisionKey).toBe('A') // última foi C
    expect(suggestion.pending).toEqual([])
  })

  it('o empate fica à vista: todas as pendentes são devolvidas, não só a sugerida', () => {
    const logs = [log({ divisionKey: 'A', completedAt: localIso(2026, 10, 5, 19) })]
    const suggestion = suggestDivision({ divisionKeys: keys, logs, now: NOW })
    expect(suggestion.pending).toContain('B')
    expect(suggestion.pending).toContain('C')
  })

  it('divisão que saiu da ficha republicada não quebra o ciclo', () => {
    const logs = [log({ divisionKey: 'Z', completedAt: localIso(2026, 10, 6, 19) })]
    const suggestion = suggestDivision({ divisionKeys: keys, logs, now: NOW })
    expect(suggestion.divisionKey).toBe('A')
    expect(suggestion.doneThisWeek).toEqual([])
  })

  it('sessão em andamento não conta como feita no ciclo', () => {
    const logs = [log({ divisionKey: 'A' })]
    expect(suggestDivision({ divisionKeys: keys, logs, now: NOW }).divisionKey).toBe('A')
  })
})
