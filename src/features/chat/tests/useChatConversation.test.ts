import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../domain/chatMessage.types'

/**
 * O que estes testes protegem:
 *
 * 1. A mensagem do próprio usuário NÃO duplica. Ela entra otimista na tela, o `insert` confirma e
 *    o Realtime entrega o mesmo `INSERT` de volta para quem enviou — três chegadas da mesma
 *    mensagem, uma bolha só, em qualquer ordem. É o bug clássico desta tela.
 * 2. Envio que falha não fica na tela fingindo que entrou.
 * 3. Só as mensagens RECEBIDAS e sem `read_at` vão para o `markRead` (a RLS recusa marcar a
 *    própria), e o mesmo id não é remarcado a cada re-render.
 * 4. A assinatura é cancelada ao desmontar/trocar de conversa — canal vazado é mensagem da
 *    conversa antiga caindo na nova.
 */

const listMessages = vi.fn()
const sendMessage = vi.fn()
const markRead = vi.fn()
const unsubscribe = vi.fn()
let emitir: ((message: ChatMessage) => void) | undefined
const subscribeToMessages = vi.fn((_id: string, onInsert: (message: ChatMessage) => void) => {
  emitir = onInsert
  return unsubscribe
})

vi.mock('@/lib/supabase/useAuthUser', () => ({
  useAuthUser: () => ({ userId: 'eu', status: 'authenticated' }),
}))

vi.mock('../repositories/chatRepository', () => ({
  DEFAULT_MESSAGE_PAGE_SIZE: 30,
  chatRepository: {
    listMessages: (...args: unknown[]) => listMessages(...args),
    sendMessage: (...args: unknown[]) => sendMessage(...args),
    markRead: (...args: unknown[]) => markRead(...args),
    subscribeToMessages: (id: string, cb: (message: ChatMessage) => void) =>
      subscribeToMessages(id, cb),
  },
}))

import { useChatConversation } from '../hooks/useChatConversation'

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    conversationId: 'conversa-1',
    senderId: 'outro',
    body: 'Como foi o treino?',
    context: { kind: 'free', id: null, label: '' },
    attachmentPath: null,
    attachmentKind: null,
    readAt: '2026-10-07T14:00:00.000Z',
    createdAt: '2026-10-07T14:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  listMessages.mockReset()
  sendMessage.mockReset()
  markRead.mockReset()
  unsubscribe.mockReset()
  subscribeToMessages.mockClear()
  emitir = undefined
  listMessages.mockResolvedValue([])
  markRead.mockResolvedValue(undefined)
})

describe('useChatConversation — carregamento', () => {
  it('sem conversa escolhida fica idle e não consulta nada', () => {
    const { result } = renderHook(() => useChatConversation(undefined))

    expect(result.current.status).toBe('idle')
    expect(result.current.messages).toBeUndefined()
    expect(listMessages).not.toHaveBeenCalled()
    expect(subscribeToMessages).not.toHaveBeenCalled()
  })

  it('ordena a página (que vem do mais recente) em ordem cronológica crescente', async () => {
    listMessages.mockResolvedValue([
      message({ id: 'msg-2', createdAt: '2026-10-07T14:10:00.000Z' }),
      message({ id: 'msg-1', createdAt: '2026-10-07T14:00:00.000Z' }),
    ])

    const { result } = renderHook(() => useChatConversation('conversa-1'))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.messages?.map((item) => item.id)).toEqual(['msg-1', 'msg-2'])
  })

  it('assina o Realtime antes da primeira página (mensagem no meio do load não se perde)', async () => {
    let liberar: (value: ChatMessage[]) => void = () => {}
    listMessages.mockReturnValue(
      new Promise<ChatMessage[]>((resolve) => {
        liberar = resolve
      }),
    )

    const { result } = renderHook(() => useChatConversation('conversa-1'))

    expect(subscribeToMessages).toHaveBeenCalledWith('conversa-1', expect.any(Function))

    act(() => emitir?.(message({ id: 'msg-chegou-no-load' })))
    await act(async () => {
      liberar([message({ id: 'msg-1' })])
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.messages?.map((item) => item.id)).toEqual([
      'msg-1',
      'msg-chegou-no-load',
    ])
  })

  it('falha no carregamento vira status de erro com a mensagem do repositório', async () => {
    listMessages.mockRejectedValue(new Error('deu ruim no banco'))

    const { result } = renderHook(() => useChatConversation('conversa-1'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.errorMessage).toBe('deu ruim no banco')
  })

  it('cancela a assinatura ao desmontar', async () => {
    const { result, unmount } = renderHook(() => useChatConversation('conversa-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('trocar de conversa derruba o canal antigo e limpa a thread', async () => {
    const { result, rerender } = renderHook(({ id }) => useChatConversation(id), {
      initialProps: { id: 'conversa-1' },
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ id: 'conversa-2' })

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(subscribeToMessages).toHaveBeenLastCalledWith('conversa-2', expect.any(Function))
  })

  it('hasMore só quando a página veio cheia', async () => {
    listMessages.mockResolvedValue(
      Array.from({ length: 30 }, (_unused, index) =>
        message({ id: `msg-${index}`, createdAt: `2026-10-07T14:${String(index).padStart(2, '0')}:00.000Z` }),
      ),
    )

    const { result } = renderHook(() => useChatConversation('conversa-1'))

    await waitFor(() => expect(result.current.hasMore).toBe(true))
  })
})

describe('useChatConversation — Realtime', () => {
  it('mensagem do outro lado entra na thread', async () => {
    const { result } = renderHook(() => useChatConversation('conversa-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => emitir?.(message({ id: 'msg-nova', readAt: null })))

    expect(result.current.messages?.map((item) => item.id)).toEqual(['msg-nova'])
  })
})

describe('useChatConversation — envio otimista', () => {
  it('mostra a mensagem na hora como pendente e depois a confirma sem duplicar', async () => {
    let enviada: { id: string } | undefined
    sendMessage.mockImplementation((input: { id: string }) => {
      enviada = input
      return Promise.resolve(
        message({ id: input.id, senderId: 'eu', body: 'Bora', readAt: null }),
      )
    })

    const { result } = renderHook(() => useChatConversation('conversa-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      await result.current.send('Bora')
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages?.[0]).toMatchObject({
      id: enviada?.id,
      senderId: 'eu',
      body: 'Bora',
    })
    expect(result.current.messages?.[0].pending).toBeUndefined()
  })

  it('o evento do Realtime da PRÓPRIA mensagem não cria uma segunda bolha', async () => {
    sendMessage.mockImplementation((input: { id: string }) =>
      Promise.resolve(message({ id: input.id, senderId: 'eu', body: 'Bora', readAt: null })),
    )

    const { result } = renderHook(() => useChatConversation('conversa-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      await result.current.send('Bora')
    })

    const id = result.current.messages?.[0].id as string
    // Mesma mensagem voltando pelo canal, como o Supabase faz com o próprio remetente.
    act(() => emitir?.(message({ id, senderId: 'eu', body: 'Bora', readAt: null })))

    expect(result.current.messages).toHaveLength(1)
  })

  it('Realtime chegando ANTES da resposta do insert também converge para uma bolha', async () => {
    let confirmar: ((value: ChatMessage) => void) | undefined
    let idEnviado = ''
    sendMessage.mockImplementation((input: { id: string }) => {
      idEnviado = input.id
      return new Promise<ChatMessage>((resolve) => {
        confirmar = resolve
      })
    })

    const { result } = renderHook(() => useChatConversation('conversa-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    let envio: Promise<void> | undefined
    act(() => {
      envio = result.current.send('Bora')
    })
    expect(result.current.messages?.[0].pending).toBe(true)

    act(() => emitir?.(message({ id: idEnviado, senderId: 'eu', body: 'Bora', readAt: null })))
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages?.[0].pending).toBeUndefined()

    await act(async () => {
      confirmar?.(message({ id: idEnviado, senderId: 'eu', body: 'Bora', readAt: null }))
      await envio
    })

    expect(result.current.messages).toHaveLength(1)
  })

  it('envio que falha sai da tela e expõe o erro', async () => {
    sendMessage.mockRejectedValue(new Error('sem rede'))

    const { result } = renderHook(() => useChatConversation('conversa-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      await result.current.send('Bora')
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.sendErrorMessage).toBe('sem rede')
  })

  it('mensagem só de espaço não vira envio', async () => {
    const { result } = renderHook(() => useChatConversation('conversa-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      await result.current.send('   ')
    })

    expect(sendMessage).not.toHaveBeenCalled()
    expect(result.current.messages).toEqual([])
  })
})

describe('useChatConversation — leitura', () => {
  it('marca as recebidas sem read_at, nunca as próprias, e não remarca a cada render', async () => {
    listMessages.mockResolvedValue([
      message({ id: 'recebida-nova', senderId: 'outro', readAt: null }),
      message({ id: 'recebida-lida', senderId: 'outro', readAt: '2026-10-07T14:01:00.000Z' }),
      message({ id: 'minha', senderId: 'eu', readAt: null }),
    ])

    const { result, rerender } = renderHook(() => useChatConversation('conversa-1'))
    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1))

    expect(markRead).toHaveBeenCalledWith(['recebida-nova'])
    await waitFor(() =>
      expect(result.current.messages?.find((item) => item.id === 'recebida-nova')?.readAt).toEqual(
        expect.any(String),
      ),
    )

    rerender()
    expect(markRead).toHaveBeenCalledTimes(1)
  })

  it('não chama markRead quando nada chegou sem leitura', async () => {
    listMessages.mockResolvedValue([message({ id: 'minha', senderId: 'eu', readAt: null })])

    const { result } = renderHook(() => useChatConversation('conversa-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(markRead).not.toHaveBeenCalled()
  })
})

describe('useChatConversation — histórico', () => {
  it('loadOlder usa o createdAt da mensagem mais antiga como cursor e mescla sem duplicar', async () => {
    listMessages.mockResolvedValueOnce([message({ id: 'msg-2', createdAt: '2026-10-07T14:10:00.000Z' })])

    const { result } = renderHook(() => useChatConversation('conversa-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    listMessages.mockResolvedValueOnce([
      message({ id: 'msg-1', createdAt: '2026-10-07T13:50:00.000Z' }),
      message({ id: 'msg-2', createdAt: '2026-10-07T14:10:00.000Z' }),
    ])

    await act(async () => {
      await result.current.loadOlder()
    })

    expect(listMessages).toHaveBeenLastCalledWith('conversa-1', {
      before: '2026-10-07T14:10:00.000Z',
      limit: 30,
    })
    expect(result.current.messages?.map((item) => item.id)).toEqual(['msg-1', 'msg-2'])
  })
})
