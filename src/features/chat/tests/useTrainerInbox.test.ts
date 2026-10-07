import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage, ConversationSummary } from '../domain/chatMessage.types'

/**
 * O que estes testes protegem na caixa de entrada do personal:
 *
 * 1. Uma consulta de conversas + uma de alunos — não um `profiles` por conversa.
 * 2. A assinatura é de TODAS as mensagens acessíveis (ele tem N conversas) e é armada ANTES da
 *    primeira carga, para não perder a mensagem que chega durante o carregamento.
 * 3. Mensagem do Realtime atualiza a lista SEM round-trip; a de conversa desconhecida (aluno que
 *    acabou de abrir conversa) força a releitura, porque o nome dele não está em memória.
 * 4. `markRead` zera a conversa aberta em memória.
 */

const listConversationsForCurrentTrainer = vi.fn<() => Promise<ConversationSummary[]>>()
const findAll = vi.fn()
const unsubscribe = vi.fn()
let emitir: ((message: ChatMessage) => void) | undefined
const subscribeToAllMessages = vi.fn((onInsert: (message: ChatMessage) => void) => {
  emitir = onInsert
  return unsubscribe
})

vi.mock('@/lib/supabase/useAuthUser', () => ({
  useAuthUser: () => ({ userId: 'personal', status: 'authenticated' }),
}))

vi.mock('../repositories/chatRepository', () => ({
  chatRepository: {
    listConversationsForCurrentTrainer: () => listConversationsForCurrentTrainer(),
    subscribeToAllMessages: (cb: (message: ChatMessage) => void) => subscribeToAllMessages(cb),
  },
}))

vi.mock('@/features/students/repositories/studentRepository', () => ({
  studentRepository: { findAll: () => findAll() },
}))

const { useTrainerInbox } = await import('../hooks/useTrainerInbox')

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `m-${Math.random()}`,
    conversationId: 'c1',
    senderId: 'aluno-1',
    body: 'oi',
    context: { kind: 'free', id: null, label: '' },
    attachmentPath: null,
    attachmentKind: null,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function summary(conversationId: string, studentId: string, unreadCount = 0): ConversationSummary {
  return {
    conversation: {
      id: conversationId,
      trainerId: 'personal',
      studentId,
      lastMessageAt: '2026-10-07T10:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    lastMessage: message({ conversationId, createdAt: '2026-10-07T10:00:00.000Z' }),
    unreadCount,
  }
}

describe('useTrainerInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emitir = undefined
    listConversationsForCurrentTrainer.mockResolvedValue([
      summary('c1', 'aluno-1', 1),
      summary('c2', 'aluno-2'),
    ])
    findAll.mockResolvedValue([
      { id: 'aluno-1', name: 'Ana Paula Souza', email: 'ana@x.com', trainerId: 'personal' },
      { id: 'aluno-2', name: 'Bruno Lima', email: 'bruno@x.com', trainerId: 'personal' },
    ])
  })

  it('carrega as conversas com o nome dos alunos em duas consultas', async () => {
    const { result } = renderHook(() => useTrainerInbox())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.entries.map((entry) => entry.studentName)).toEqual([
      'Ana Paula Souza',
      'Bruno Lima',
    ])
    expect(result.current.totalUnread).toBe(1)
    expect(listConversationsForCurrentTrainer).toHaveBeenCalledTimes(1)
    expect(findAll).toHaveBeenCalledTimes(1)
  })

  it('assina todas as mensagens antes da primeira carga', () => {
    renderHook(() => useTrainerInbox())
    // Síncrono no primeiro render: a carga ainda não resolveu.
    expect(subscribeToAllMessages).toHaveBeenCalledTimes(1)
  })

  it('mensagem nova de um aluno aparece sem recarregar', async () => {
    const { result } = renderHook(() => useTrainerInbox())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() =>
      emitir?.(
        message({ conversationId: 'c2', senderId: 'aluno-2', body: 'posso trocar o agachamento?' }),
      ),
    )

    expect(result.current.entries[0].conversationId).toBe('c2')
    expect(result.current.entries[0].lastMessage?.body).toBe('posso trocar o agachamento?')
    expect(result.current.totalUnread).toBe(2)
    // Sem round-trip extra: a mensagem já veio no evento.
    expect(listConversationsForCurrentTrainer).toHaveBeenCalledTimes(1)
  })

  it('mensagem de conversa desconhecida relê a lista (aluno abriu conversa agora)', async () => {
    const { result } = renderHook(() => useTrainerInbox())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    listConversationsForCurrentTrainer.mockResolvedValue([
      summary('c1', 'aluno-1', 1),
      summary('c2', 'aluno-2'),
      summary('c3', 'aluno-3', 1),
    ])
    findAll.mockResolvedValue([
      { id: 'aluno-1', name: 'Ana Paula Souza', email: 'ana@x.com', trainerId: 'personal' },
      { id: 'aluno-2', name: 'Bruno Lima', email: 'bruno@x.com', trainerId: 'personal' },
      { id: 'aluno-3', name: 'Carla Dias', email: 'carla@x.com', trainerId: 'personal' },
    ])

    act(() => emitir?.(message({ conversationId: 'c3', senderId: 'aluno-3' })))

    await waitFor(() => expect(listConversationsForCurrentTrainer).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(result.current.entries.map((entry) => entry.studentName)).toContain('Carla Dias'),
    )
  })

  it('markRead zera as não lidas da conversa aberta', async () => {
    const { result } = renderHook(() => useTrainerInbox())
    await waitFor(() => expect(result.current.totalUnread).toBe(1))

    act(() => result.current.markRead('c1'))
    expect(result.current.totalUnread).toBe(0)
  })

  it('erro de carga vira estado de erro com mensagem, não lista vazia silenciosa', async () => {
    listConversationsForCurrentTrainer.mockRejectedValue(new Error('RLS recusou'))

    const { result } = renderHook(() => useTrainerInbox())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.errorMessage).toBe('RLS recusou')
  })

  it('cancela a assinatura ao desmontar', async () => {
    const { result, unmount } = renderHook(() => useTrainerInbox())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
