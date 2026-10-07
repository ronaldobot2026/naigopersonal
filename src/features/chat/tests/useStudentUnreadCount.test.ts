import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../domain/chatMessage.types'

/**
 * O que estes testes protegem no badge de não lidas do aluno (único aviso de mensagem nova
 * enquanto não há push):
 *
 * 1. A conversa é LIDA, nunca criada — o hook roda no shell, em toda tela do aluno.
 * 2. Mensagem que chega pelo Realtime sobe o contador SEM nova consulta ao banco.
 * 3. Mensagem do próprio aluno (eco do Realtime para o remetente) NÃO conta.
 * 4. `refresh` volta à verdade do banco (é o caminho de "saí da conversa, as mensagens foram
 *    marcadas como lidas").
 * 5. Aluno sem conversa ainda: contador zero, nada assinado.
 */

const findConversationForCurrentStudent = vi.fn()
const unreadCount = vi.fn()
const unsubscribe = vi.fn()
let emitir: ((message: ChatMessage) => void) | undefined
const subscribeToMessages = vi.fn((_id: string, onInsert: (message: ChatMessage) => void) => {
  emitir = onInsert
  return unsubscribe
})

vi.mock('@/lib/supabase/useAuthUser', () => ({
  useAuthUser: () => ({ userId: 'aluno', status: 'authenticated' }),
}))

vi.mock('../repositories/chatRepository', () => ({
  chatRepository: {
    findConversationForCurrentStudent: () => findConversationForCurrentStudent(),
    unreadCount: (...args: unknown[]) => unreadCount(...args),
    subscribeToMessages: (id: string, cb: (message: ChatMessage) => void) =>
      subscribeToMessages(id, cb),
  },
}))

const { useStudentUnreadCount } = await import('../hooks/useStudentUnreadCount')

function message(senderId: string): ChatMessage {
  return {
    id: `m-${Math.random()}`,
    conversationId: 'c1',
    senderId,
    body: 'oi',
    context: { kind: 'free', id: null, label: '' },
    attachmentPath: null,
    attachmentKind: null,
    readAt: null,
    createdAt: new Date().toISOString(),
  }
}

describe('useStudentUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emitir = undefined
    findConversationForCurrentStudent.mockResolvedValue({
      id: 'c1',
      trainerId: 'personal',
      studentId: 'aluno',
      lastMessageAt: null,
      createdAt: new Date().toISOString(),
    })
    unreadCount.mockResolvedValue(2)
  })

  it('conta as não lidas da conversa do aluno sem criá-la', async () => {
    const { result } = renderHook(() => useStudentUnreadCount())

    await waitFor(() => expect(result.current.count).toBe(2))
    expect(unreadCount).toHaveBeenCalledWith('c1')
    // `ensureConversation*` não aparece nem no mock: o shell não cria conversa.
    expect(findConversationForCurrentStudent).toHaveBeenCalledTimes(1)
  })

  it('sobe o contador na mensagem do personal e ignora a do próprio aluno', async () => {
    const { result } = renderHook(() => useStudentUnreadCount())
    await waitFor(() => expect(result.current.count).toBe(2))

    act(() => emitir?.(message('personal')))
    expect(result.current.count).toBe(3)

    // Eco do Realtime da própria mensagem: não é "não lida".
    act(() => emitir?.(message('aluno')))
    expect(result.current.count).toBe(3)

    // Nenhum round-trip extra: o evento já trouxe a mensagem.
    expect(unreadCount).toHaveBeenCalledTimes(1)
  })

  it('refresh reconsulta o banco (depois de a conversa ser lida)', async () => {
    const { result } = renderHook(() => useStudentUnreadCount())
    await waitFor(() => expect(result.current.count).toBe(2))

    unreadCount.mockResolvedValue(0)
    act(() => result.current.refresh())

    await waitFor(() => expect(result.current.count).toBe(0))
    expect(unreadCount).toHaveBeenCalledTimes(2)
  })

  it('aluno sem conversa: zero e nada assinado', async () => {
    findConversationForCurrentStudent.mockResolvedValue(null)

    const { result } = renderHook(() => useStudentUnreadCount())

    await waitFor(() => expect(findConversationForCurrentStudent).toHaveBeenCalled())
    expect(result.current.count).toBe(0)
    expect(subscribeToMessages).not.toHaveBeenCalled()
    expect(unreadCount).not.toHaveBeenCalled()
  })

  it('cancela a assinatura ao desmontar', async () => {
    const { result, unmount } = renderHook(() => useStudentUnreadCount())
    await waitFor(() => expect(result.current.count).toBe(2))

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
