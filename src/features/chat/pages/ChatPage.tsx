import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { MOCK_CHAT_MESSAGES, type ChatMessage } from '@/mocks/chat'

type ChatPageProps = {
  /** Quem está "logado" nesta tela — decide alinhamento das mensagens enviadas/recebidas. */
  selfRole: 'student' | 'trainer'
  counterpartName: string
}

/**
 * Chat local, sem backend real — mensagens seguem apenas em memória durante a sessão
 * (ver docs/DECISIONS.md, fase de dados demo).
 */
export function ChatPage({ selfRole, counterpartName }: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES)
  const [draft, setDraft] = useState('')

  function handleSend(): void {
    const text = draft.trim()
    if (!text) return
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      from: selfRole,
      text,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((current) => [...current, message])
    setDraft('')
  }

  return (
    <div className="mx-auto flex h-full max-w-container-max flex-col px-margin-mobile py-4 md:px-margin-desktop">
      <div className="mb-4 flex justify-center">
        <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-text-secondary">
          HOJE
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {messages.map((message) => {
          const isSelf = message.from === selfRole
          return (
            <div
              key={message.id}
              className={`flex max-w-[85%] flex-col ${isSelf ? 'self-end items-end' : 'items-start'}`}
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
                }`}
              >
                <p>{message.text}</p>
              </div>
              <span className="mt-1 ml-1 font-mono text-[10px] text-text-secondary">
                {message.time}
              </span>
            </div>
          )
        })}
      </div>

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
          aria-label="Enviar mensagem"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-action-primary text-action-primary-foreground active:scale-95"
        >
          <Icon name="send" />
        </button>
      </div>
    </div>
  )
}
