import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../domain/chatMessage.types'

/**
 * O que estes testes protegem no badge de não lidas do aluno (único aviso de mensagem nova
 * enquanto não há push):
 *
 * 1. A conversa nunca é criada nem procurada — o hook roda no shell, em toda tela do aluno, e a
 *    contagem/assinatura é global com a RLS como escopo.
 * 2. Mensagem que chega pelo Realtime sobe o contador SEM nova consulta ao banco.
 * 3. Mensagem do próprio aluno (eco do Realtime para o remetente) NÃO conta.
 * 4. `refresh` volta à verdade do banco (é o caminho de "saí da conversa, as mensagens foram
 *    marcadas como lidas").
 * 5. Aluno que ainda NÃO tem conversa também fica assinado: a primeira resposta do personal sobe
 *    o badge sem recarregar (regressão achada no E2E da Fase 12 com aluno novo).
 */

const unreadCountForCurrentUser = vi.fn()
const unsubscribe = vi.fn()
let emitir: ((message: ChatMessage) => void) | undefined
const subscribeToAllMessages = vi.fn((onInsert: (message: ChatMessage) => void) => {
  emitir = onInsert
  return unsubscribe
})

vi.mock('@/lib/supabase/useAuthUser', () => ({
  useAuthUser: () => ({ userId: 'aluno', status: 'authenticated' }),
}))

vi.mock('../repositories/chatRepository', () => ({
  chatRepository: {
    unreadCountForCurrentUser: () => unreadCountForCurrentUser(),
    subscribeToAllMessages: (cb: (message: ChatMessage) => void) => subscribeToAllMessages(cb),
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
    unreadCountForCurrentUser.mockResolvedValue(2)
  })

  it('conta as não lidas do aluno sem criar nem procurar conversa', async () => {
    const { result } = renderHook(() => useStudentUnreadCount())

    await waitFor(() => expect(result.current.count).toBe(2))
    // Nenhuma consulta de conversa: `findConversationForCurrentStudent` nem está no mock, e a
    // contagem global é restrita pela RLS.
    expect(unreadCountForCurrentUser).toHaveBeenCalledTimes(1)
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
    expect(unreadCountForCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('refresh reconsulta o banco (depois de a conversa ser lida)', async () => {
    const { result } = renderHook(() => useStudentUnreadCount())
    await waitFor(() => expect(result.current.count).toBe(2))

    unreadCountForCurrentUser.mockResolvedValue(0)
    act(() => result.current.refresh())

    await waitFor(() => expect(result.current.count).toBe(0))
    expect(unreadCountForCurrentUser).toHaveBeenCalledTimes(2)
  })

  it('aluno sem conversa: zero, mas assinado — a primeira resposta sobe o badge', async () => {
    unreadCountForCurrentUser.mockResolvedValue(0)

    const { result } = renderHook(() => useStudentUnreadCount())

    await waitFor(() => expect(subscribeToAllMessages).toHaveBeenCalledTimes(1))
    expect(result.current.count).toBe(0)

    // A conversa nasceu depois do mount (primeira mensagem do aluno) e o personal respondeu: o
    // badge sobe sem recarregar, porque a assinatura não depende de um `conversation_id` resolvido
    // no mount.
    act(() => emitir?.(message('personal')))
    expect(result.current.count).toBe(1)
  })

  it('cancela a assinatura ao desmontar', async () => {
    const { result, unmount } = renderHook(() => useStudentUnreadCount())
    await waitFor(() => expect(result.current.count).toBe(2))

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
