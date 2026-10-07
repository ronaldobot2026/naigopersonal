import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isSessionInProgress, workoutLogStatus } from '../domain/workoutLog.types'

/**
 * O que estes testes protegem, nesta ordem de importância:
 *
 * 1. `startSession` NÃO duplica sessão. O banco não tem constraint contra duas sessões abertas
 *    (decisão da F10-1), então recarregar o executor criaria um treino novo a cada F5 — o mesmo
 *    bug de "abrir Nova avaliação cria rascunho".
 * 2. `upsertSet` mira o índice único `(workout_log_id, exercise_id, set_index)` e manda
 *    `student_id`, que é `not null` e é o que a RLS avalia.
 * 3. `lastWeightFor` consulta na ordem do índice `(student_id, exercise_id, completed_at desc)` e
 *    exclui `completed_at is null` — sem isso, `order by desc` (que é `nulls first` no Postgres)
 *    devolveria a série em andamento como "última carga".
 *
 * O stub abaixo registra a consulta montada (filtros, ordenação, limite, payload) em vez de só
 * contar chamadas: a correção destes métodos ESTÁ na forma da consulta.
 */

type Row = Record<string, unknown>

interface Resposta {
  data: unknown
  error: { message: string } | null
}

interface Chamada {
  table: string
  op: 'select' | 'insert' | 'upsert' | 'update'
  payload: Row | undefined
  options: Record<string, unknown> | undefined
  columns: string | undefined
  /** Filtros na ordem em que o repositório os aplicou, ex.: `'eq:student_id=aluno-1'`. */
  filters: string[]
  orders: string[]
  limit: number | undefined
  terminal: 'single' | 'maybeSingle' | 'list'
}

interface Query extends PromiseLike<Resposta> {
  select(cols?: string): Query
  eq(col: string, val: unknown): Query
  is(col: string, val: unknown): Query
  not(col: string, op: string, val: unknown): Query
  gte(col: string, val: unknown): Query
  lte(col: string, val: unknown): Query
  order(col: string, opts?: { ascending?: boolean }): Query
  limit(n: number): Query
  single(): Promise<Resposta>
  maybeSingle(): Promise<Resposta>
}

const chamadas: Chamada[] = []

/** Linhas que o "banco" devolve. Cada teste troca por uma função que olha a consulta recebida. */
let responder: (chamada: Chamada) => Row[] = () => []

function novaQuery(
  table: string,
  op: Chamada['op'],
  payload?: Row,
  options?: Record<string, unknown>,
): Query {
  const chamada: Chamada = {
    table,
    op,
    payload,
    options,
    columns: undefined,
    filters: [],
    orders: [],
    limit: undefined,
    terminal: 'list',
  }

  function encerrar(terminal: Chamada['terminal']): Resposta {
    chamada.terminal = terminal
    chamadas.push(chamada)
    const rows = responder(chamada)

    if (terminal === 'single') {
      return rows.length > 0
        ? { data: rows[0], error: null }
        : { data: null, error: { message: 'nenhuma linha devolvida' } }
    }
    if (terminal === 'maybeSingle') return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }

  const query: Query = {
    select(cols) {
      chamada.columns = cols
      return query
    },
    eq(col, val) {
      chamada.filters.push(`eq:${col}=${String(val)}`)
      return query
    },
    is(col, val) {
      chamada.filters.push(`is:${col}=${String(val)}`)
      return query
    },
    not(col, op2, val) {
      chamada.filters.push(`not:${col} ${op2} ${String(val)}`)
      return query
    },
    gte(col, val) {
      chamada.filters.push(`gte:${col}=${String(val)}`)
      return query
    },
    lte(col, val) {
      chamada.filters.push(`lte:${col}=${String(val)}`)
      return query
    },
    order(col, opts) {
      chamada.orders.push(`${col} ${opts?.ascending === false ? 'desc' : 'asc'}`)
      return query
    },
    limit(n) {
      chamada.limit = n
      return query
    },
    single: () => Promise.resolve(encerrar('single')),
    maybeSingle: () => Promise.resolve(encerrar('maybeSingle')),
    then: (onfulfilled, onrejected) =>
      Promise.resolve(encerrar('list')).then(onfulfilled, onrejected),
  }

  return query
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select: (cols?: string) => novaQuery(table, 'select').select(cols),
      insert: (payload: Row) => novaQuery(table, 'insert', payload),
      upsert: (payload: Row, options?: Record<string, unknown>) =>
        novaQuery(table, 'upsert', payload, options),
      update: (payload: Row) => novaQuery(table, 'update', payload),
    }),
  }),
}))

import { workoutLogRepository } from '../repositories/workoutLogRepository'

const LOG_ABERTO: Row = {
  id: 'log-1',
  student_id: 'aluno-1',
  workout_plan_id: 'ficha-1',
  division_key: 'A',
  started_at: '2026-10-07T10:00:00.000Z',
  completed_at: null,
  notes: '',
  created_at: '2026-10-07T10:00:00.000Z',
  updated_at: '2026-10-07T10:00:00.000Z',
}

const SERIE: Row = {
  id: 'serie-1',
  workout_log_id: 'log-1',
  student_id: 'aluno-1',
  exercise_id: '0025',
  exercise_name: 'Supino reto',
  set_index: 2,
  reps: 10,
  weight_kg: 60,
  rpe: 8,
  done: true,
  completed_at: '2026-10-07T10:20:00.000Z',
  created_at: '2026-10-07T10:20:00.000Z',
  updated_at: '2026-10-07T10:20:00.000Z',
}

/** Última chamada registrada — é nela que o teste confere a forma da consulta. */
function ultimaChamada(): Chamada {
  const chamada = chamadas.at(-1)
  if (!chamada) throw new Error('Nenhuma consulta foi feita ao Supabase.')
  return chamada
}

function payloadDe(chamada: Chamada): Row {
  if (!chamada.payload) throw new Error(`A chamada ${chamada.op} não levou payload.`)
  return chamada.payload
}

beforeEach(() => {
  chamadas.length = 0
  responder = () => []
})

describe('workoutLogRepository.startSession', () => {
  it('devolve a sessão já aberta em vez de criar outra (aluno recarregou a página)', async () => {
    responder = (chamada) =>
      chamada.table === 'workout_logs' && chamada.op === 'select' ? [LOG_ABERTO] : []

    const log = await workoutLogRepository.startSession('aluno-1', 'ficha-1', 'A')

    expect(log.id).toBe('log-1')
    expect(chamadas.some((chamada) => chamada.op === 'insert')).toBe(false)
  })

  it('procura a sessão aberta da divisão: student_id + completed_at is null + division_key', async () => {
    responder = (chamada) => (chamada.op === 'insert' ? [LOG_ABERTO] : [])

    await workoutLogRepository.startSession('aluno-1', 'ficha-1', 'A')

    expect(chamadas[0].filters).toEqual([
      'eq:student_id=aluno-1',
      'is:completed_at=null',
      'eq:division_key=A',
    ])
    expect(chamadas[0].orders).toEqual(['started_at desc'])
    expect(chamadas[0].limit).toBe(1)
  })

  it('cria a sessão quando não há nenhuma aberta, com a ficha e a divisão do momento', async () => {
    responder = (chamada) =>
      chamada.op === 'insert' ? [{ ...LOG_ABERTO, id: 'log-novo', division_key: 'B' }] : []

    const log = await workoutLogRepository.startSession('aluno-1', null, 'B')

    expect(log.id).toBe('log-novo')
    const insert = chamadas.find((chamada) => chamada.op === 'insert')
    expect(insert).toBeDefined()
    expect(payloadDe(insert as Chamada)).toEqual({
      student_id: 'aluno-1',
      workout_plan_id: null,
      division_key: 'B',
    })
  })
  it('continua idempotente quando a tela desestrutura o repositório (sem this)', async () => {
    responder = (chamada) =>
      chamada.table === 'workout_logs' && chamada.op === 'select' ? [LOG_ABERTO] : []

    const { startSession } = workoutLogRepository
    const log = await startSession('aluno-1', 'ficha-1', 'A')

    expect(log.id).toBe('log-1')
    expect(chamadas.some((chamada) => chamada.op === 'insert')).toBe(false)
  })
})

describe('workoutLogRepository.findOpenSession', () => {
  it('sem divisão, devolve a sessão aberta mais recente de qualquer divisão', async () => {
    responder = () => [LOG_ABERTO]

    const log = await workoutLogRepository.findOpenSession('aluno-1')

    expect(log?.id).toBe('log-1')
    expect(ultimaChamada().filters).toEqual(['eq:student_id=aluno-1', 'is:completed_at=null'])
  })

  it('devolve null quando o aluno não tem sessão em andamento', async () => {
    responder = () => []

    expect(await workoutLogRepository.findOpenSession('aluno-1')).toBeNull()
  })
})

describe('workoutLogRepository.upsertSet', () => {
  it('upserta pelo índice único (workout_log_id, exercise_id, set_index)', async () => {
    responder = () => [SERIE]

    await workoutLogRepository.upsertSet({
      workoutLogId: 'log-1',
      studentId: 'aluno-1',
      exerciseId: '0025',
      exerciseName: 'Supino reto',
      setIndex: 2,
      reps: 10,
      weightKg: 60,
      rpe: 8,
      done: true,
    })

    const chamada = ultimaChamada()
    expect(chamada.op).toBe('upsert')
    expect(chamada.options).toEqual({ onConflict: 'workout_log_id,exercise_id,set_index' })
  })

  it('manda student_id no payload (not null, avaliado pela RLS e 1ª coluna do índice)', async () => {
    responder = () => [SERIE]

    await workoutLogRepository.upsertSet({
      workoutLogId: 'log-1',
      studentId: 'aluno-1',
      exerciseId: '0025',
      exerciseName: 'Supino reto',
      setIndex: 1,
      done: true,
    })

    const payload = payloadDe(ultimaChamada())
    expect(payload.student_id).toBe('aluno-1')
    expect(payload.exercise_name).toBe('Supino reto')
  })

  it('série marcada como feita ganha completed_at (é o que o histórico de carga lê)', async () => {
    responder = () => [SERIE]

    await workoutLogRepository.upsertSet({
      workoutLogId: 'log-1',
      studentId: 'aluno-1',
      exerciseId: '0025',
      exerciseName: 'Supino reto',
      setIndex: 1,
      weightKg: 60,
      done: true,
    })

    expect(payloadDe(ultimaChamada()).completed_at).toEqual(expect.any(String))
  })

  it('série não concluída fica com completed_at null e campos omitidos viram null', async () => {
    responder = () => [{ ...SERIE, done: false, completed_at: null, reps: null, rpe: null }]

    const serie = await workoutLogRepository.upsertSet({
      workoutLogId: 'log-1',
      studentId: 'aluno-1',
      exerciseId: '0025',
      exerciseName: 'Supino reto',
      setIndex: 3,
      weightKg: 60,
    })

    const payload = payloadDe(ultimaChamada())
    expect(payload.done).toBe(false)
    expect(payload.completed_at).toBeNull()
    expect(payload.reps).toBeNull()
    expect(payload.rpe).toBeNull()
    expect(serie.completedAt).toBeNull()
  })
})

describe('workoutLogRepository.completeSession', () => {
  it('fecha a sessão preenchendo completed_at da linha certa', async () => {
    responder = () => [{ ...LOG_ABERTO, completed_at: '2026-10-07T11:00:00.000Z' }]

    const log = await workoutLogRepository.completeSession('log-1')

    const chamada = ultimaChamada()
    expect(chamada.op).toBe('update')
    expect(chamada.filters).toEqual(['eq:id=log-1'])
    expect(payloadDe(chamada).completed_at).toEqual(expect.any(String))
    expect(workoutLogStatus(log)).toBe('completed')
  })
})

describe('workoutLogRepository.lastWeightFor', () => {
  it('consulta na ordem do índice e exclui série em andamento (desc é nulls first)', async () => {
    responder = () => [{ weight_kg: 60, reps: 10, completed_at: '2026-10-07T10:20:00.000Z' }]

    const ultima = await workoutLogRepository.lastWeightFor('aluno-1', '0025')

    expect(ultima).toEqual({
      weightKg: 60,
      reps: 10,
      completedAt: '2026-10-07T10:20:00.000Z',
    })

    const chamada = ultimaChamada()
    expect(chamada.filters).toEqual([
      'eq:student_id=aluno-1',
      'eq:exercise_id=0025',
      'not:completed_at is null',
    ])
    expect(chamada.orders).toEqual(['completed_at desc'])
    expect(chamada.limit).toBe(1)
  })

  it('devolve null quando o aluno nunca concluiu uma série do exercício', async () => {
    responder = () => []

    expect(await workoutLogRepository.lastWeightFor('aluno-1', '0099')).toBeNull()
  })
})

describe('workoutLogRepository.listSessions', () => {
  it('filtra a janela por started_at e ordena do mais recente para o mais antigo', async () => {
    responder = () => [LOG_ABERTO]

    const sessoes = await workoutLogRepository.listSessions('aluno-1', {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T23:59:59.000Z',
      limit: 5,
    })

    expect(sessoes).toHaveLength(1)
    const chamada = ultimaChamada()
    expect(chamada.filters).toEqual([
      'eq:student_id=aluno-1',
      'gte:started_at=2026-10-01T00:00:00.000Z',
      'lte:started_at=2026-10-31T23:59:59.000Z',
    ])
    expect(chamada.orders).toEqual(['started_at desc'])
    expect(chamada.limit).toBe(5)
  })

  it('sem janela, não filtra data e aplica o teto padrão', async () => {
    responder = () => []

    await workoutLogRepository.listSessions('aluno-1')

    const chamada = ultimaChamada()
    expect(chamada.filters).toEqual(['eq:student_id=aluno-1'])
    expect(chamada.limit).toBe(50)
  })
})

describe('workoutLogRepository.listSets', () => {
  it('traz as séries da sessão na ordem de execução', async () => {
    responder = () => [SERIE]

    const series = await workoutLogRepository.listSets('log-1')

    expect(series[0]).toMatchObject({
      workoutLogId: 'log-1',
      exerciseId: '0025',
      exerciseName: 'Supino reto',
      setIndex: 2,
      weightKg: 60,
      done: true,
    })
    const chamada = ultimaChamada()
    expect(chamada.filters).toEqual(['eq:workout_log_id=log-1'])
    expect(chamada.orders).toEqual(['exercise_id asc', 'set_index asc'])
  })
})

describe('estado da sessão', () => {
  it('sessão sem completed_at está em andamento', () => {
    expect(workoutLogStatus({ completedAt: null })).toBe('in_progress')
    expect(isSessionInProgress({ completedAt: null })).toBe(true)
  })

  it('sessão com completed_at está concluída', () => {
    expect(workoutLogStatus({ completedAt: '2026-10-07T11:00:00.000Z' })).toBe('completed')
    expect(isSessionInProgress({ completedAt: '2026-10-07T11:00:00.000Z' })).toBe(false)
  })
})
