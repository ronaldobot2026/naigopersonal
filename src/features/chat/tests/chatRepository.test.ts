import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O que estes testes protegem, nesta ordem de importância:
 *
 * 1. `ensureConversation` é idempotente SEM select-then-insert (duas telas abrindo a conversa ao
 *    mesmo tempo passariam as duas pelo select vazio e a segunda tomaria `23505`) e manda
 *    `ignoreDuplicates` — o `on conflict do update` do upsert padrão bateria na RLS do aluno, que
 *    só tem policy de `insert` em `conversations`.
 * 2. `sendMessage` tira o `sender_id` da SESSÃO, nunca de parâmetro, e reenvia o id gerado no
 *    cliente (é ele que faz a reconciliação com o evento do Realtime não duplicar a bolha).
 * 3. `markRead` só preenche `read_at` ainda nulo (reabrir a conversa não reescreve a hora da
 *    primeira leitura) e `unreadCount` conta o que o usuário RECEBEU (`sender_id <> eu`).
 *
 * Como no `workoutLogRepository.test.ts`, o stub registra a consulta montada (filtros, ordem,
 * limite, payload): a correção destes métodos ESTÁ na forma da consulta.
 */

type Row = Record<string, unknown>

interface Chamada {
  table: string
  op: 'select' | 'insert' | 'upsert' | 'update'
  payload: Row | undefined
  options: Record<string, unknown> | undefined
  columns: string | undefined
  selectOptions: Record<string, unknown> | undefined
  filters: string[]
  orders: string[]
  limit: number | undefined
  terminal: 'single' | 'maybeSingle' | 'list'
}

interface Resposta {
  data: unknown
  error: { message: string } | null
  count?: number | null
}

interface Query extends PromiseLike<Resposta> {
  select(cols?: string, opts?: Record<string, unknown>): Query
  eq(col: string, val: unknown): Query
  neq(col: string, val: unknown): Query
  is(col: string, val: unknown): Query
  lt(col: string, val: unknown): Query
  in(col: string, vals: unknown[]): Query
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): Query
  limit(n: number): Query
  single(): Promise<Resposta>
}

const chamadas: Chamada[] = []
let responder: (chamada: Chamada) => Row[] = () => []
let sessionUserId: string | null = 'eu'

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
    selectOptions: undefined,
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
    if (chamada.selectOptions?.head === true) {
      return { data: null, error: null, count: rows.length }
    }
    return { data: rows, error: null, count: rows.length }
  }

  const query: Query = {
    select(cols, opts) {
      chamada.columns = cols
      chamada.selectOptions = opts
      return query
    },
    eq(col, val) {
      chamada.filters.push(`eq:${col}=${String(val)}`)
      return query
    },
    neq(col, val) {
      chamada.filters.push(`neq:${col}=${String(val)}`)
      return query
    },
    is(col, val) {
      chamada.filters.push(`is:${col}=${String(val)}`)
      return query
    },
    lt(col, val) {
      chamada.filters.push(`lt:${col}=${String(val)}`)
      return query
    },
    in(col, vals) {
      chamada.filters.push(`in:${col}=[${vals.map(String).join(',')}]`)
      return query
    },
    order(col, opts) {
      const direcao = opts?.ascending === false ? 'desc' : 'asc'
      const nulos = opts?.nullsFirst === false ? ' nulls last' : ''
      chamada.orders.push(`${col} ${direcao}${nulos}`)
      return query
    },
    limit(n) {
      chamada.limit = n
      return query
    },
    single: () => Promise.resolve(encerrar('single')),
    then: (onfulfilled, onrejected) =>
      Promise.resolve(encerrar('list')).then(onfulfilled, onrejected),
  }

  return query
}

const canalAssinado: { nome: string | undefined; config: Record<string, unknown> | undefined } = {
  nome: undefined,
  config: undefined,
}
let emitirInsert: ((payload: { new: Row }) => void) | undefined
const removeChannel = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select: (cols?: string, opts?: Record<string, unknown>) =>
        novaQuery(table, 'select').select(cols, opts),
      insert: (payload: Row) => novaQuery(table, 'insert', payload),
      upsert: (payload: Row, options?: Record<string, unknown>) =>
        novaQuery(table, 'upsert', payload, options),
      update: (payload: Row) => novaQuery(table, 'update', payload),
    }),
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: sessionUserId ? { user: { id: sessionUserId } } : null },
          error: null,
        }),
    },
    channel: (nome: string) => {
      canalAssinado.nome = nome
      const canal = {
        on: (_event: string, config: Record<string, unknown>, cb: (payload: { new: Row }) => void) => {
          canalAssinado.config = config
          emitirInsert = cb
          return canal
        },
        subscribe: () => canal,
      }
      return canal
    },
    removeChannel,
  }),
}))

import { chatRepository } from '../repositories/chatRepository'

const CONVERSA: Row = {
  id: 'conversa-1',
  trainer_id: 'personal-1',
  student_id: 'aluno-1',
  last_message_at: '2026-10-07T14:30:00.000Z',
  created_at: '2026-10-01T09:00:00.000Z',
}

const MENSAGEM: Row = {
  id: 'msg-1',
  conversation_id: 'conversa-1',
  sender_id: 'aluno-1',
  body: 'Senti a técnica mais sólida.',
  context_kind: 'workout_log',
  context_id: '00000000-0000-4000-8000-000000000001',
  context_label: 'Treino A · Supino com barra',
  attachment_path: null,
  attachment_kind: null,
  read_at: null,
  created_at: '2026-10-07T14:25:00.000Z',
}

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
  sessionUserId = 'eu'
  emitirInsert = undefined
  canalAssinado.nome = undefined
  canalAssinado.config = undefined
  removeChannel.mockClear()
})

describe('chatRepository.ensureConversation', () => {
  it('não faz select-then-insert: insere com do-nothing e depois lê a linha', async () => {
    responder = (chamada) => (chamada.op === 'select' ? [CONVERSA] : [])

    const conversa = await chatRepository.ensureConversation('personal-1', 'aluno-1')

    expect(conversa).toEqual({
      id: 'conversa-1',
      trainerId: 'personal-1',
      studentId: 'aluno-1',
      lastMessageAt: '2026-10-07T14:30:00.000Z',
      createdAt: '2026-10-01T09:00:00.000Z',
    })
    // A escrita vem PRIMEIRO — a corrida de duas telas morre no `do nothing`, não num 23505.
    expect(chamadas[0].op).toBe('upsert')
    expect(chamadas[1].op).toBe('select')
  })

  it('upserta pelo unique (trainer_id, student_id) ignorando duplicado (RLS do aluno não tem update)', async () => {
    responder = (chamada) => (chamada.op === 'select' ? [CONVERSA] : [])

    await chatRepository.ensureConversation('personal-1', 'aluno-1')

    expect(payloadDe(chamadas[0])).toEqual({ trainer_id: 'personal-1', student_id: 'aluno-1' })
    expect(chamadas[0].options).toEqual({
      onConflict: 'trainer_id,student_id',
      ignoreDuplicates: true,
    })
    expect(chamadas[1].filters).toEqual(['eq:trainer_id=personal-1', 'eq:student_id=aluno-1'])
  })

  it('para o aluno logado, o trainer_id vem de students (é o vínculo que a RLS exige)', async () => {
    sessionUserId = 'aluno-1'
    responder = (chamada) => {
      if (chamada.table === 'students') return [{ trainer_id: 'personal-1' }]
      return chamada.op === 'select' ? [CONVERSA] : []
    }

    const conversa = await chatRepository.ensureConversationForCurrentStudent()

    expect(conversa.trainerId).toBe('personal-1')
    expect(chamadas[0].table).toBe('students')
    expect(chamadas[0].filters).toEqual(['eq:id=aluno-1'])
    expect(payloadDe(chamadas[1])).toEqual({ trainer_id: 'personal-1', student_id: 'aluno-1' })
  })
})

describe('chatRepository.listMessages', () => {
  it('traz a página mais recente primeiro, no índice (conversation_id, created_at desc)', async () => {
    responder = () => [MENSAGEM]

    const mensagens = await chatRepository.listMessages('conversa-1')

    expect(mensagens[0]).toEqual({
      id: 'msg-1',
      conversationId: 'conversa-1',
      senderId: 'aluno-1',
      body: 'Senti a técnica mais sólida.',
      context: {
        kind: 'workout_log',
        id: '00000000-0000-4000-8000-000000000001',
        label: 'Treino A · Supino com barra',
      },
      attachmentPath: null,
      attachmentKind: null,
      readAt: null,
      createdAt: '2026-10-07T14:25:00.000Z',
    })

    const chamada = ultimaChamada()
    expect(chamada.filters).toEqual(['eq:conversation_id=conversa-1'])
    expect(chamada.orders).toEqual(['created_at desc'])
    expect(chamada.limit).toBe(30)
  })

  it('pagina para trás com o cursor `before` (lt em created_at) e respeita o limite pedido', async () => {
    responder = () => []

    await chatRepository.listMessages('conversa-1', {
      before: '2026-10-07T14:25:00.000Z',
      limit: 10,
    })

    const chamada = ultimaChamada()
    expect(chamada.filters).toEqual([
      'eq:conversation_id=conversa-1',
      'lt:created_at=2026-10-07T14:25:00.000Z',
    ])
    expect(chamada.limit).toBe(10)
  })
})

describe('chatRepository.sendMessage', () => {
  it('assina com o sender_id da SESSÃO, não com um id recebido por parâmetro', async () => {
    sessionUserId = 'personal-1'
    responder = () => [{ ...MENSAGEM, sender_id: 'personal-1' }]

    await chatRepository.sendMessage({ conversationId: 'conversa-1', body: 'Bora' })

    expect(payloadDe(ultimaChamada()).sender_id).toBe('personal-1')
  })

  it('reenvia o id gerado no cliente — é ele que impede a mensagem duplicar no Realtime', async () => {
    responder = () => [MENSAGEM]

    await chatRepository.sendMessage({
      conversationId: 'conversa-1',
      body: 'Bora',
      id: 'id-do-cliente',
    })

    expect(payloadDe(ultimaChamada()).id).toBe('id-do-cliente')
  })

  it('gera id quando a tela não passa um', async () => {
    responder = () => [MENSAGEM]

    await chatRepository.sendMessage({ conversationId: 'conversa-1', body: 'Bora' })

    expect(payloadDe(ultimaChamada()).id).toEqual(expect.any(String))
  })

  it('manda o corpo sem espaços nas pontas (o banco exige length(trim(body)) > 0)', async () => {
    responder = () => [MENSAGEM]

    await chatRepository.sendMessage({ conversationId: 'conversa-1', body: '  oi  ' })

    expect(payloadDe(ultimaChamada()).body).toBe('oi')
  })

  it('recusa mensagem só de espaço antes de ir ao banco', async () => {
    await expect(
      chatRepository.sendMessage({ conversationId: 'conversa-1', body: '   ' }),
    ).rejects.toThrow('Mensagem vazia.')
    expect(chamadas).toHaveLength(0)
  })

  it('contexto default é conversa solta (free), com id nulo e rótulo vazio', async () => {
    responder = () => [MENSAGEM]

    await chatRepository.sendMessage({ conversationId: 'conversa-1', body: 'oi' })

    const payload = payloadDe(ultimaChamada())
    expect(payload.context_kind).toBe('free')
    expect(payload.context_id).toBeNull()
    expect(payload.context_label).toBe('')
  })

  it('congela o rótulo do contexto recebido (fica legível mesmo se a ficha mudar depois)', async () => {
    responder = () => [MENSAGEM]

    await chatRepository.sendMessage({
      conversationId: 'conversa-1',
      body: 'Como foi esse treino?',
      context: {
        kind: 'workout_log',
        id: '00000000-0000-4000-8000-000000000001',
        label: 'Treino A · Supino com barra',
      },
    })

    const payload = payloadDe(ultimaChamada())
    expect(payload.context_kind).toBe('workout_log')
    expect(payload.context_label).toBe('Treino A · Supino com barra')
  })

  it('sem sessão, nem tenta escrever (a RLS recusaria de todo jeito)', async () => {
    sessionUserId = null

    await expect(
      chatRepository.sendMessage({ conversationId: 'conversa-1', body: 'oi' }),
    ).rejects.toThrow(/Sessão expirada/)
    expect(chamadas).toHaveLength(0)
  })
})

describe('chatRepository.markRead', () => {
  it('preenche read_at só onde ainda é nulo (não reescreve a primeira leitura)', async () => {
    responder = () => []

    await chatRepository.markRead(['msg-1', 'msg-2'])

    const chamada = ultimaChamada()
    expect(chamada.op).toBe('update')
    expect(payloadDe(chamada).read_at).toEqual(expect.any(String))
    expect(chamada.filters).toEqual(['in:id=[msg-1,msg-2]', 'is:read_at=null'])
  })

  it('lista vazia não vira ida ao servidor', async () => {
    await chatRepository.markRead([])
    expect(chamadas).toHaveLength(0)
  })
})

describe('chatRepository.unreadCount', () => {
  it('conta só o que o usuário logado RECEBEU e não leu, sem trazer linha (head)', async () => {
    sessionUserId = 'personal-1'
    responder = () => [MENSAGEM, MENSAGEM]

    const total = await chatRepository.unreadCount('conversa-1')

    expect(total).toBe(2)
    const chamada = ultimaChamada()
    expect(chamada.selectOptions).toEqual({ count: 'exact', head: true })
    expect(chamada.filters).toEqual([
      'eq:conversation_id=conversa-1',
      'is:read_at=null',
      'neq:sender_id=personal-1',
    ])
  })
})

describe('chatRepository.listConversations', () => {
  it('ordena pela mexida mais recente (nulls last) e devolve última mensagem + não lidas por aluno', async () => {
    responder = (chamada) => {
      if (chamada.table === 'conversations') {
        return [CONVERSA, { ...CONVERSA, id: 'conversa-2', student_id: 'aluno-2' }]
      }
      // Não lidas: duas da conversa-1, nenhuma da conversa-2.
      if (chamada.filters.includes('is:read_at=null')) {
        return [
          { conversation_id: 'conversa-1' },
          { conversation_id: 'conversa-1' },
        ]
      }
      // Última mensagem (uma consulta de 1 linha por conversa).
      return chamada.filters.includes('eq:conversation_id=conversa-1') ? [MENSAGEM] : []
    }

    const resumos = await chatRepository.listConversations('personal-1')

    expect(resumos).toHaveLength(2)
    expect(chamadas[0].orders).toEqual(['last_message_at desc nulls last'])
    expect(resumos[0].conversation.studentId).toBe('aluno-1')
    expect(resumos[0].lastMessage?.id).toBe('msg-1')
    expect(resumos[0].unreadCount).toBe(2)
    expect(resumos[1].lastMessage).toBeNull()
    expect(resumos[1].unreadCount).toBe(0)
  })

  it('personal sem conversa nenhuma não dispara consulta de mensagem', async () => {
    responder = () => []

    expect(await chatRepository.listConversations('personal-1')).toEqual([])
    expect(chamadas).toHaveLength(1)
  })

  it('conta como não lida só a mensagem do OUTRO lado (sender_id <> personal)', async () => {
    responder = (chamada) => (chamada.table === 'conversations' ? [CONVERSA] : [])

    await chatRepository.listConversations('personal-1')

    const consultaNaoLidas = chamadas[1]
    expect(consultaNaoLidas.filters).toEqual([
      'in:conversation_id=[conversa-1]',
      'is:read_at=null',
      'neq:sender_id=personal-1',
    ])
  })
})

describe('chatRepository.subscribeToMessages', () => {
  it('filtra o INSERT pela conversa aberta no servidor e entrega a mensagem já em camelCase', () => {
    const recebidas: unknown[] = []
    const unsubscribe = chatRepository.subscribeToMessages('conversa-1', (message) =>
      recebidas.push(message),
    )

    // O topic leva sufixo único por assinatura: tela do chat e badge de não lidas assinam a
    // mesma conversa ao mesmo tempo, e topic repetido deixa um dos dois mudo no supabase-js.
    expect(canalAssinado.nome).toMatch(/^messages:conversa-1:.+/)
    expect(canalAssinado.config).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: 'conversation_id=eq.conversa-1',
    })

    emitirInsert?.({ new: MENSAGEM })
    expect(recebidas).toHaveLength(1)
    expect((recebidas[0] as { conversationId: string }).conversationId).toBe('conversa-1')

    unsubscribe()
    expect(removeChannel).toHaveBeenCalledTimes(1)
  })

  it('dá um topic diferente a cada assinatura da MESMA conversa', () => {
    // A tela do chat e o contador de não lidas da navegação assinam a mesma conversa ao mesmo
    // tempo. O supabase-js multiplexa por topic: topic repetido = um dos dois nunca recebe nada
    // (bug real — a mensagem nova não chegava na tela aberta).
    const primeiro = chatRepository.subscribeToMessages('conversa-1', () => {})
    const topicDaTela = canalAssinado.nome
    const segundo = chatRepository.subscribeToMessages('conversa-1', () => {})

    expect(canalAssinado.nome).not.toBe(topicDaTela)

    primeiro()
    segundo()
  })
})
