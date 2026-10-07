import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '@/lib/generateId'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import {
  isUnreadFor,
  type ChatMessage,
  type ChatMessageContext,
} from '../domain/chatMessage.types'
import { dropMessage, mergeMessage, mergeMessages } from '../domain/chatThread'
import { chatRepository, DEFAULT_MESSAGE_PAGE_SIZE } from '../repositories/chatRepository'

export type ChatStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface UseChatConversationResult {
  status: ChatStatus
  /** Thread em ordem cronológica crescente. `undefined` até a primeira página chegar. */
  messages: ChatMessage[] | undefined
  errorMessage: string | undefined
  /** Erro do último envio — a bolha otimista já foi removida quando isto está preenchido. */
  sendErrorMessage: string | undefined
  /** Id do usuário logado: é com ele que a tela decide o lado da bolha. */
  selfId: string | null
  sending: boolean
  /** `true` quando ainda pode existir histórico acima do que está em memória. */
  hasMore: boolean
  send: (body: string, context?: ChatMessageContext) => Promise<void>
  loadOlder: () => Promise<void>
}

function toMessageError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/**
 * A conversa aberta: primeira página do histórico, assinatura do Realtime, envio otimista e
 * marcação de leitura.
 *
 * A reconciliação é o ponto delicado. O id da mensagem é gerado AQUI e reenviado no insert, então
 * a bolha otimista, a resposta do insert e o evento `INSERT` do Realtime (que chega para o próprio
 * remetente também) carregam o mesmo id e `mergeMessage` colapsa os três numa linha só — em
 * qualquer ordem de chegada. Sem isso, a mensagem do próprio usuário aparece duas vezes assim que
 * o Realtime responde, que é o bug clássico desta tela.
 */
export function useChatConversation(conversationId: string | undefined): UseChatConversationResult {
  const { userId } = useAuthUser()
  const [messages, setMessages] = useState<ChatMessage[]>()
  const [status, setStatus] = useState<ChatStatus>(conversationId ? 'loading' : 'idle')
  const [errorMessage, setErrorMessage] = useState<string>()
  const [sendErrorMessage, setSendErrorMessage] = useState<string>()
  const [sending, setSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  /** Ids já enviados ao `markRead` — evita reenviar o mesmo update a cada re-render. */
  const marked = useRef(new Set<string>())

  useEffect(() => {
    marked.current = new Set()
    setMessages(undefined)
    setErrorMessage(undefined)
    setSendErrorMessage(undefined)
    setHasMore(false)

    if (!conversationId) {
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('loading')

    // A assinatura é armada ANTES da primeira página: assinar depois abriria uma janela em que a
    // mensagem que chegasse no meio do carregamento se perderia até o próximo reload.
    const unsubscribe = chatRepository.subscribeToMessages(conversationId, (message) => {
      if (cancelled) return
      setMessages((current) => mergeMessage(current ?? [], message))
    })

    chatRepository
      .listMessages(conversationId, { limit: DEFAULT_MESSAGE_PAGE_SIZE })
      .then((page) => {
        if (cancelled) return
        // A página vem do mais recente para o mais antigo; `mergeMessages` reordena e, se o
        // Realtime já tiver entregado algo, não duplica.
        setMessages((current) => mergeMessages(current ?? [], page))
        setHasMore(page.length === DEFAULT_MESSAGE_PAGE_SIZE)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(toMessageError(error, 'Não foi possível carregar a conversa.'))
        setStatus('error')
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [conversationId])

  // Abrir a conversa é ler: o que chegou do outro lado e ainda está sem `read_at` é marcado.
  // A RLS recusa marcar mensagem própria, então o filtro aqui não é cosmético.
  useEffect(() => {
    if (!userId || !messages) return

    const pending = messages
      .filter((message) => !message.pending && isUnreadFor(message, userId))
      .map((message) => message.id)
      .filter((id) => !marked.current.has(id))
    if (pending.length === 0) return

    for (const id of pending) marked.current.add(id)

    chatRepository
      .markRead(pending)
      .then(() => {
        const readAt = new Date().toISOString()
        setMessages((current) =>
          (current ?? []).map((message) =>
            pending.includes(message.id) ? { ...message, readAt } : message,
          ),
        )
      })
      .catch((error: unknown) => {
        // Falhar aqui não atrapalha a conversa: as mensagens seguem como não lidas e a próxima
        // abertura tenta de novo.
        console.error(error)
        for (const id of pending) marked.current.delete(id)
      })
  }, [messages, userId])

  const send = useCallback(
    async (body: string, context?: ChatMessageContext) => {
      const trimmed = body.trim()
      if (!trimmed || !conversationId || !userId) return

      const id = generateId()
      const optimistic: ChatMessage = {
        id,
        conversationId,
        senderId: userId,
        body: trimmed,
        context: context ?? { kind: 'free', id: null, label: '' },
        attachmentPath: null,
        attachmentKind: null,
        readAt: null,
        createdAt: new Date().toISOString(),
        pending: true,
      }

      setSendErrorMessage(undefined)
      setSending(true)
      setMessages((current) => mergeMessage(current ?? [], optimistic))

      try {
        const saved = await chatRepository.sendMessage({ id, conversationId, body: trimmed, context })
        setMessages((current) => mergeMessage(current ?? [], saved))
      } catch (error: unknown) {
        // Mensagem que não entrou no banco não fica na tela fingindo que entrou.
        setMessages((current) => dropMessage(current ?? [], id))
        setSendErrorMessage(toMessageError(error, 'Não foi possível enviar a mensagem.'))
      } finally {
        setSending(false)
      }
    },
    [conversationId, userId],
  )

  const loadOlder = useCallback(async () => {
    if (!conversationId || !messages || messages.length === 0) return

    const oldest = messages[0]
    const page = await chatRepository.listMessages(conversationId, {
      before: oldest.createdAt,
      limit: DEFAULT_MESSAGE_PAGE_SIZE,
    })
    setMessages((current) => mergeMessages(current ?? [], page))
    setHasMore(page.length === DEFAULT_MESSAGE_PAGE_SIZE)
  }, [conversationId, messages])

  return {
    status,
    messages,
    errorMessage,
    sendErrorMessage,
    selfId: userId,
    sending,
    hasMore,
    send,
    loadOlder,
  }
}
