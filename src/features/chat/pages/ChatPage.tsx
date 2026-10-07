import { useState } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Icon } from '@/components/ui/Icon'
import { useAsyncData } from '@/hooks/useAsyncData'
import { formatMessageTime } from '../domain/chatMessage.types'
import { useChatConversation } from '../hooks/useChatConversation'
import { chatRepository } from '../repositories/chatRepository'

type ChatPageProps = {
  /** Papel de quem abriu a tela — decide como a conversa é resolvida quando não vem por prop. */
  selfRole: 'student' | 'trainer'
  counterpartName: string
  /**
   * Conversa a abrir. O ALUNO não precisa passar: é resolvida pelo vínculo dele com o personal.
   * O personal precisa, porque ele tem uma conversa por aluno (a lista é a fatia seguinte da
   * Fase 12 — ver docs/ROADMAP.md).
   */
  conversationId?: string
}

/**
 * Conversa personal ↔ aluno em cima do Supabase: histórico paginado, envio persistido e
 * atualização por Realtime (`useChatConversation`). O alinhamento da bolha sai do `senderId`
 * comparado à sessão, não de um papel passado pela tela.
 */
export function ChatPage({ selfRole, counterpartName, conversationId }: ChatPageProps) {
  const [draft, setDraft] = useState('')

  // O aluno tem UMA conversa; o personal escolhe o aluno (e aí a conversa chega por prop).
  const resolved = useAsyncData<string | null>(async () => {
    if (conversationId) return conversationId
    if (selfRole !== 'student') return null
    return (await chatRepository.ensureConversationForCurrentStudent()).id
  }, [conversationId, selfRole])

  const chat = useChatConversation(resolved.data ?? undefined)

  function handleSend(): void {
    const text = draft.trim()
    if (!text || chat.sending) return
    setDraft('')
    void chat.send(text)
  }

  if (resolved.status === 'error' || chat.status === 'error') {
    return (
      <ErrorState
        title="Não foi possível carregar a conversa"
        description={resolved.errorMessage ?? chat.errorMessage ?? 'Tente novamente em instantes.'}
      />
    )
  }

  if (resolved.status === 'loading') {
    return <LoadingState label="Carregando conversa…" />
  }

  if (resolved.data === null) {
    return (
      <EmptyState
        icon="chat"
        title="Escolha um aluno"
        description="A conversa abre a partir da ficha do aluno."
      />
    )
  }

  const messages = chat.messages
  if (!messages) {
    return <LoadingState label="Carregando conversa…" />
  }

  return (
    <div className="mx-auto flex h-full max-w-container-max flex-col px-margin-mobile py-4 md:px-margin-desktop">
      {chat.hasMore && (
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={() => void chat.loadOlder()}
            className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-text-secondary"
          >
            VER MENSAGENS ANTERIORES
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {messages.map((message) => {
          const isSelf = message.senderId === chat.selfId
          return (
            <div
              key={message.id}
              className={`flex min-w-0 max-w-[85%] flex-col ${isSelf ? 'self-end items-end' : 'items-start'}`}
            >
              {!isSelf && (
                <span className="mb-1 ml-1 font-mono text-[10px] text-action-primary">
                  {counterpartName.toUpperCase()}
                </span>
              )}
              <div
                className={`rounded-tl-xl rounded-br-xl rounded-bl-xl border p-3 ${
                  isSelf
                    ? 'border-action-primary/20 bg-action-primary/20 text-text-primary'
                    : 'border-border bg-surface-elevated text-text-primary'
                } ${message.pending ? 'opacity-60' : ''}`}
              >
                {message.context.label !== '' && (
                  <p className="mb-1 font-mono text-[10px] uppercase text-text-secondary">
                    {message.context.label}
                  </p>
                )}
                {/* overflow-wrap:anywhere (não `break-words`/overflow-wrap:break-word — esse
                    valor é ignorado no cálculo de min/max-content por spec, então a bolha ainda
                    calcula a largura como se a palavra não quebrasse e só quebra a linha depois,
                    tarde demais). Mensagem pode conter link/token longo sem espaço. */}
                <p className="[overflow-wrap:anywhere]">{message.body}</p>
              </div>
              <span className="mt-1 ml-1 font-mono text-[10px] text-text-secondary">
                {message.pending ? 'enviando…' : formatMessageTime(message.createdAt)}
              </span>
            </div>
          )
        })}
      </div>

      {chat.sendErrorMessage && (
        <p role="alert" className="pb-2 text-sm text-error">
          {chat.sendErrorMessage}
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-border bg-surface p-gutter">
        <div className="relative flex-1 border-b border-border focus-within:border-action-primary">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSend()
            }}
            placeholder="Escreva sua mensagem..."
            aria-label="Mensagem"
            className="w-full bg-transparent px-2 py-3 text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={chat.sending}
          aria-label="Enviar mensagem"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-action-primary text-action-primary-foreground active:scale-95 disabled:opacity-50"
        >
          <Icon name="send" />
        </button>
      </div>
    </div>
  )
}
