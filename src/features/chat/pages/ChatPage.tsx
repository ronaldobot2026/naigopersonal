import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Icon } from '@/components/ui/Icon'
import { useAsyncData } from '@/hooks/useAsyncData'
import { formatMessageTime, type ChatMessage } from '../domain/chatMessage.types'
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
  /**
   * Para onde o rótulo de contexto da mensagem leva, quando leva a algum lugar. Recebe a mensagem
   * e devolve `null` para contexto sem destino (conversa solta, ou execução que não existe mais).
   *
   * É prop e não cálculo interno porque o destino depende de quem olha: o PERSONAL volta para a
   * execução na aderência do aluno (`/personal/alunos/:id?sessao=…`), e o aluno não tem essa tela.
   */
  contextHref?: (message: ChatMessage) => string | null
}

/**
 * Conversa personal ↔ aluno em cima do Supabase: histórico paginado, envio persistido e
 * atualização por Realtime (`useChatConversation`). O alinhamento da bolha sai do `senderId`
 * comparado à sessão, não de um papel passado pela tela.
 */
export function ChatPage({
  selfRole,
  counterpartName,
  conversationId,
  contextHref,
}: ChatPageProps) {
  const [draft, setDraft] = useState('')

  // O aluno tem UMA conversa; o personal escolhe o aluno (e aí a conversa chega por prop).
  const resolved = useAsyncData<string | null>(async () => {
    if (conversationId) return conversationId
    if (selfRole !== 'student') return null
    return (await chatRepository.ensureConversationForCurrentStudent()).id
  }, [conversationId, selfRole])

  const chat = useChatConversation(resolved.data ?? undefined)

  const scroller = useRef<HTMLDivElement>(null)
  const lastSeenId = useRef<string | undefined>(undefined)

  /*
   * Rola para o fim quando chega mensagem NOVA (a última da thread mudou) — é o que faz a
   * mensagem do Realtime aparecer sem o usuário tocar em nada.
   *
   * A comparação é pelo id da última mensagem, não por `messages.length`: `loadOlder` também
   * aumenta o tamanho da lista, e rolar para o fim ali jogaria fora exatamente o histórico que o
   * usuário acabou de pedir.
   */
  const messages = chat.messages
  useEffect(() => {
    if (!messages || messages.length === 0) return
    const lastId = messages[messages.length - 1].id
    if (lastId === lastSeenId.current) return
    lastSeenId.current = lastId
    const element = scroller.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages])

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

  if (!messages) {
    return <LoadingState label="Carregando conversa…" />
  }

  return (
    /*
     * `pb-24 md:pb-4`: no mobile a BottomNavigation é `fixed` e cobriria o campo de digitação.
     * Com `box-border` (padrão do Tailwind) o padding entra na conta do `h-full`, então a tela
     * termina acima da barra em vez de passar por baixo dela.
     */
    <div className="mx-auto flex h-full max-w-container-max flex-col px-margin-mobile pt-4 pb-24 md:px-margin-desktop md:pb-4">
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

      <div ref={scroller} className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          // Estado vazio honesto: conversa nova é conversa vazia. Nunca mensagem de exemplo.
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon="chat"
              title="Nenhuma mensagem ainda"
              description={`Escreva abaixo para começar a conversa com ${counterpartName}.`}
            />
          </div>
        ) : (
          messages.map((message) => {
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
                  {/*
                    O rótulo congelado do contexto ("Treino A · Supino com barra") é o que separa
                    este chat de um WhatsApp: vai acima do texto, em bloco próprio com barra
                    lateral, para não ser lido como parte da mensagem.
                  */}
                  {message.context.label !== '' &&
                    (() => {
                      const href = contextHref?.(message) ?? null
                      const className =
                        'mb-2 flex items-center gap-1 border-l-2 border-action-primary/60 bg-surface-high/50 py-1 pl-2 font-mono text-[10px] uppercase tracking-wide'
                      // Com destino o rótulo é LINK: é como o personal volta à execução que gerou
                      // a dúvida. Sem destino segue texto — link que não leva a nada é pior que
                      // texto.
                      return href === null ? (
                        <p className={`${className} text-text-secondary`}>
                          {message.context.label}
                        </p>
                      ) : (
                        <Link
                          to={href}
                          className={`${className} text-action-primary hover:underline`}
                        >
                          {message.context.label}
                          <Icon name="open_in_new" className="text-xs" />
                        </Link>
                      )
                    })()}
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
          })
        )}
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
            // `text-base` (16px) não é estética: abaixo de 16px o Safari do iOS dá zoom no campo
            // ao focar e a tela fica deslocada. `enterKeyHint` troca o Enter do teclado por
            // "enviar" — e o envio tem botão próprio, porque teclado mobile nem sempre tem Enter
            // visível.
            className="w-full bg-transparent px-2 py-3 text-base text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
            enterKeyHint="send"
            autoComplete="off"
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
