import { describe, expect, it } from 'vitest'
import type { ChatMessage, ConversationSummary } from '../domain/chatMessage.types'
import {
  applyIncomingMessage,
  buildInbox,
  formatInboxTime,
  markInboxRead,
  previewBody,
  sortInbox,
  totalUnread,
  UNKNOWN_STUDENT_NAME,
  type InboxEntry,
} from '../domain/inbox'

/**
 * O que estes testes protegem na caixa de entrada do personal:
 *
 * 1. Ordem pela mexida mais recente, conversa sem mensagem no fim (ele tem N conversas).
 * 2. Mensagem do Realtime atualiza prévia/ordem em memória e só conta como não lida quando é do
 *    ALUNO (o remetente recebe o eco da própria mensagem).
 * 3. Conversa desconhecida devolve `null` — quem chama precisa reler a lista, não inventar linha.
 * 4. Aluno sem perfil legível aparece com rótulo explícito, nunca com uuid.
 * 5. A prévia mostra o rótulo de contexto antes do texto (é o que diferencia este chat).
 */

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'aluno-1',
    body: 'oi',
    context: { kind: 'free', id: null, label: '' },
    attachmentPath: null,
    attachmentKind: null,
    readAt: null,
    createdAt: '2026-10-07T12:00:00.000Z',
    ...overrides,
  }
}

function summary(
  conversationId: string,
  studentId: string,
  lastMessage: ChatMessage | null,
  unreadCount = 0,
): ConversationSummary {
  return {
    conversation: {
      id: conversationId,
      trainerId: 'personal',
      studentId,
      lastMessageAt: lastMessage?.createdAt ?? null,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    lastMessage,
    unreadCount,
  }
}

const NAMES = new Map([
  ['aluno-1', 'Ana Paula Souza'],
  ['aluno-2', 'Bruno Lima'],
])

describe('buildInbox', () => {
  it('ordena pela mexida mais recente e deixa conversa sem mensagem no fim', () => {
    const entries = buildInbox(
      [
        summary('c-sem', 'aluno-2', null),
        summary(
          'c-antiga',
          'aluno-1',
          message({ conversationId: 'c-antiga', createdAt: '2026-10-05T10:00:00.000Z' }),
        ),
        summary(
          'c-nova',
          'aluno-2',
          message({ conversationId: 'c-nova', createdAt: '2026-10-07T10:00:00.000Z' }),
        ),
      ],
      NAMES,
    )

    expect(entries.map((entry) => entry.conversationId)).toEqual(['c-nova', 'c-antiga', 'c-sem'])
    expect(entries[2].lastActivityAt).toBeNull()
  })

  it('resolve o nome do aluno e não mostra uuid quando não há perfil', () => {
    const entries = buildInbox(
      [summary('c1', 'aluno-1', null), summary('c2', 'fantasma', null)],
      NAMES,
    )

    expect(entries.find((entry) => entry.conversationId === 'c1')?.studentName).toBe(
      'Ana Paula Souza',
    )
    const semPerfil = entries.find((entry) => entry.conversationId === 'c2')
    expect(semPerfil?.studentName).toBe(UNKNOWN_STUDENT_NAME)
    expect(semPerfil?.studentName).not.toContain('fantasma')
  })

  it('usa a data da última mensagem como atividade (e não só o last_message_at da conversa)', () => {
    const [entry] = buildInbox(
      [
        {
          ...summary('c1', 'aluno-1', message({ createdAt: '2026-10-07T13:00:00.000Z' })),
          // Linha de `conversations` atrasada em relação à mensagem já carregada.
          conversation: {
            id: 'c1',
            trainerId: 'personal',
            studentId: 'aluno-1',
            lastMessageAt: '2026-10-01T00:00:00.000Z',
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        },
      ],
      NAMES,
    )

    expect(entry.lastActivityAt).toBe('2026-10-07T13:00:00.000Z')
  })
})

describe('applyIncomingMessage', () => {
  const base = (): InboxEntry[] =>
    buildInbox(
      [
        summary(
          'c1',
          'aluno-1',
          message({ conversationId: 'c1', createdAt: '2026-10-07T10:00:00.000Z' }),
          1,
        ),
        summary(
          'c2',
          'aluno-2',
          message({
            id: 'm2',
            conversationId: 'c2',
            senderId: 'aluno-2',
            createdAt: '2026-10-07T11:00:00.000Z',
          }),
        ),
      ],
      NAMES,
    )

  it('sobe a conversa para o topo, troca a prévia e conta a não lida', () => {
    const next = applyIncomingMessage(
      base(),
      message({
        id: 'm3',
        conversationId: 'c1',
        senderId: 'aluno-1',
        body: 'senti dor no ombro',
        createdAt: '2026-10-07T12:00:00.000Z',
      }),
      'personal',
    )

    expect(next).not.toBeNull()
    expect(next?.[0].conversationId).toBe('c1')
    expect(next?.[0].lastMessage?.body).toBe('senti dor no ombro')
    expect(next?.[0].unreadCount).toBe(2)
  })

  it('mensagem do próprio personal atualiza a prévia sem contar não lida', () => {
    const next = applyIncomingMessage(
      base(),
      message({
        id: 'm4',
        conversationId: 'c1',
        senderId: 'personal',
        body: 'troca para 40 kg',
        createdAt: '2026-10-07T12:30:00.000Z',
      }),
      'personal',
    )

    expect(next?.[0].lastMessage?.body).toBe('troca para 40 kg')
    expect(next?.[0].unreadCount).toBe(1)
  })

  it('reentrega da MESMA mensagem (reconexão do Realtime) não conta duas vezes', () => {
    const entries = base()
    const nova = message({
      id: 'm5',
      conversationId: 'c1',
      senderId: 'aluno-1',
      createdAt: '2026-10-07T12:00:00.000Z',
    })

    const primeira = applyIncomingMessage(entries, nova, 'personal')
    const segunda = applyIncomingMessage(primeira ?? [], nova, 'personal')

    expect(primeira?.[0].unreadCount).toBe(2)
    expect(segunda?.[0].unreadCount).toBe(2)
  })

  it('mensagem antiga não rebaixa a prévia já exibida', () => {
    const next = applyIncomingMessage(
      base(),
      message({
        id: 'm6',
        conversationId: 'c2',
        senderId: 'aluno-2',
        body: 'mensagem velha',
        createdAt: '2026-10-01T09:00:00.000Z',
      }),
      'personal',
    )

    const c2 = next?.find((entry) => entry.conversationId === 'c2')
    expect(c2?.lastMessage?.body).not.toBe('mensagem velha')
    expect(c2?.lastActivityAt).toBe('2026-10-07T11:00:00.000Z')
  })

  it('conversa desconhecida devolve null (quem chama relê a lista)', () => {
    expect(
      applyIncomingMessage(base(), message({ conversationId: 'c-nova' }), 'personal'),
    ).toBeNull()
  })
})

describe('não lidas e prévia', () => {
  it('markInboxRead zera só a conversa indicada e totalUnread soma o resto', () => {
    const entries = buildInbox(
      [
        summary('c1', 'aluno-1', message({ conversationId: 'c1' }), 3),
        summary('c2', 'aluno-2', message({ conversationId: 'c2', id: 'm2' }), 2),
      ],
      NAMES,
    )

    expect(totalUnread(entries)).toBe(5)
    const lido = markInboxRead(entries, 'c1')
    expect(lido.find((entry) => entry.conversationId === 'c1')?.unreadCount).toBe(0)
    expect(totalUnread(lido)).toBe(2)
  })

  it('prévia traz o rótulo do contexto antes do texto, e estado vazio honesto', () => {
    expect(previewBody(null)).toBe('Nenhuma mensagem ainda')
    expect(
      previewBody(
        message({
          body: 'doeu na terceira série',
          context: { kind: 'exercise', id: 'log-1', label: 'Treino A · Supino com barra' },
        }),
      ),
    ).toBe('Treino A · Supino com barra · doeu na terceira série')
  })

  it('formatInboxTime: hora para hoje, dia/mês para antes, vazio sem atividade', () => {
    const agora = new Date()
    expect(formatInboxTime(agora.toISOString())).toMatch(/^\d{2}:\d{2}$/)
    expect(formatInboxTime('2026-01-05T12:00:00.000Z')).toBe('05/01')
    expect(formatInboxTime(null)).toBe('')
    expect(formatInboxTime('não é data')).toBe('')
  })

  it('sortInbox é estável no empate (não troca de ordem entre renders)', () => {
    const entries: InboxEntry[] = [
      {
        conversationId: 'c2',
        studentId: 'aluno-2',
        studentName: 'Bruno Lima',
        lastMessage: null,
        unreadCount: 0,
        lastActivityAt: null,
      },
      {
        conversationId: 'c1',
        studentId: 'aluno-1',
        studentName: 'Ana Paula Souza',
        lastMessage: null,
        unreadCount: 0,
        lastActivityAt: null,
      },
    ]

    expect(sortInbox(entries).map((entry) => entry.studentName)).toEqual([
      'Ana Paula Souza',
      'Bruno Lima',
    ])
    expect(sortInbox(sortInbox(entries)).map((entry) => entry.conversationId)).toEqual(['c1', 'c2'])
  })
})
