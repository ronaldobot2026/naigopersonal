import { useSearchParams } from 'react-router-dom'
import {
  buildSessionHighlightPath,
  INBOX_CONVERSATION_PARAM,
} from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { StudentContextPanel } from '../components/StudentContextPanel'
import type { ChatMessage } from '../domain/chatMessage.types'
import { formatInboxTime, previewBody, type InboxEntry } from '../domain/inbox'
import { useTrainerInbox } from '../hooks/useTrainerInbox'
import { ChatPage } from './ChatPage'

/** Uma linha da caixa de entrada. Não lidas em destaque: é o que o personal procura na lista. */
function InboxRow({
  entry,
  selected,
  onSelect,
}: {
  entry: InboxEntry
  selected: boolean
  onSelect: () => void
}) {
  const unread = entry.unreadCount > 0

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        aria-label={
          unread
            ? `${entry.studentName}, ${entry.unreadCount} não lidas`
            : `Conversa com ${entry.studentName}`
        }
        className={`flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors ${
          selected ? 'bg-surface-high' : 'hover:bg-surface-elevated'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            {/* Negrito marca a conversa com mensagem não lida — não só a bolinha vermelha. */}
            <p
              className={`min-w-0 truncate ${
                unread ? 'font-bold text-text-primary' : 'text-text-primary'
              }`}
            >
              {entry.studentName}
            </p>
            <span className="shrink-0 font-mono text-[10px] text-text-secondary">
              {formatInboxTime(entry.lastActivityAt)}
            </span>
          </div>
          <p
            className={`mt-0.5 truncate text-xs ${
              unread ? 'text-text-primary' : 'text-text-secondary'
            }`}
          >
            {previewBody(entry.lastMessage)}
          </p>
        </div>
        {unread && (
          <span
            // O número também vai no aria-label do botão: quem usa leitor de tela não vê a bolha.
            aria-hidden="true"
            className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-error px-1.5 font-mono text-[10px] font-bold leading-none text-white"
          >
            {entry.unreadCount > 99 ? '99+' : entry.unreadCount}
          </span>
        )}
      </button>
    </li>
  )
}

/**
 * Caixa de entrada do PERSONAL (`/personal/chat`): todas as conversas dos alunos dele numa lista,
 * a conversa aberta ao lado e os NÚMEROS do aluno na mesma tela.
 *
 * O contrário da tela do aluno, que tem uma conversa só. Aqui o personal precisa responder rápido
 * e com contexto — daí as três colunas no desktop (lista · conversa · contexto) e a decisão de
 * reusar `ChatPage` em vez de reescrever a conversa: o envio, a paginação, a reconciliação do
 * Realtime e a marcação de leitura são os MESMOS dos dois lados.
 *
 * A conversa aberta vive na URL (`?conversa=<id>`), não em estado local: isso faz o link da
 * confirmação de envio do aluno e o botão voltar do navegador funcionarem, e dá ao personal um
 * endereço para a conversa de um aluno.
 *
 * No mobile a tela é uma coisa OU outra (lista ou conversa) — três colunas num iPhone não é
 * contexto, é nada legível.
 */
export function TrainerInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { status, entries, errorMessage, markRead } = useTrainerInbox()

  const selectedId = searchParams.get(INBOX_CONVERSATION_PARAM)
  const selected = entries.find((entry) => entry.conversationId === selectedId) ?? null

  function openConversation(entry: InboxEntry): void {
    const next = new URLSearchParams(searchParams)
    next.set(INBOX_CONVERSATION_PARAM, entry.conversationId)
    setSearchParams(next)
    // A conversa vai marcar como lida ao abrir (`useChatConversation`); a lista acompanha na hora
    // em vez de esperar uma releitura — contador teimando sobre a conversa aberta é só ruído.
    markRead(entry.conversationId)
  }

  function closeConversation(): void {
    const next = new URLSearchParams(searchParams)
    next.delete(INBOX_CONVERSATION_PARAM)
    setSearchParams(next)
  }

  /**
   * Link de volta do contexto: a mensagem do aluno guarda `context_id` = a EXECUÇÃO do treino
   * (`workout_logs.id`, decisão de schema da CHAT-4), então dá para abrir exatamente aquela sessão
   * na aderência dele. `assessment` já tem a própria tela, e `free` não tem para onde ir.
   */
  function contextHref(message: ChatMessage): string | null {
    if (selected === null) return null
    if (message.context.id === null) return null
    if (message.context.kind !== 'exercise' && message.context.kind !== 'workout_log') return null
    return buildSessionHighlightPath(selected.studentId, message.context.id)
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
        <ErrorState
          title="Não foi possível carregar as conversas"
          description={errorMessage ?? 'Tente novamente em instantes.'}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-6 pb-24 md:px-margin-desktop md:pb-6">
      <div className={selected ? 'hidden lg:block' : undefined}>
        <PageHeader eyebrow="Conversas" title="Caixa de entrada" />
      </div>

      {status === 'loading' && <LoadingState label="Carregando conversas…" />}

      {status === 'ready' && entries.length === 0 && (
        // Estado vazio honesto: personal sem aluno conversando não ganha conversa de exemplo.
        <EmptyState
          icon="chat"
          title="Nenhuma conversa ainda"
          description="Quando um aluno mandar a primeira mensagem — da ficha, de um treino ou de uma avaliação — ela aparece aqui."
        />
      )}

      {status === 'ready' && entries.length > 0 && (
        <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)_16rem] lg:gap-4">
          {/* Lista: no mobile desaparece quando uma conversa está aberta. */}
          <nav
            aria-label="Conversas dos alunos"
            className={`rounded-lg border border-border bg-surface lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto ${
              selected ? 'hidden lg:block' : 'block'
            }`}
          >
            <ul>
              {entries.map((entry) => (
                <InboxRow
                  key={entry.conversationId}
                  entry={entry}
                  selected={entry.conversationId === selected?.conversationId}
                  onSelect={() => openConversation(entry)}
                />
              ))}
            </ul>
          </nav>

          {selected === null ? (
            <div className="mt-4 hidden lg:col-span-2 lg:mt-0 lg:block">
              <EmptyState
                icon="chat"
                title="Escolha uma conversa"
                description="A conversa abre ao lado, com a aderência e a última avaliação do aluno."
              />
            </div>
          ) : (
            <>
              <section
                aria-label={`Conversa com ${selected.studentName}`}
                className="flex min-h-0 flex-col rounded-lg border border-border bg-surface lg:h-[calc(100vh-14rem)]"
              >
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <button
                    type="button"
                    onClick={closeConversation}
                    aria-label="Voltar para a caixa de entrada"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-elevated lg:hidden"
                  >
                    <Icon name="arrow_back" />
                  </button>
                  <p className="min-w-0 flex-1 truncate font-bold text-text-primary">
                    {selected.studentName}
                  </p>
                </div>
                {/* `min-h-0` no pai + `flex-1` aqui: sem isso a conversa estoura a coluna em vez
                    de rolar dentro dela. */}
                <div className="min-h-0 flex-1">
                  <ChatPage
                    selfRole="trainer"
                    counterpartName={selected.studentName}
                    conversationId={selected.conversationId}
                    contextHref={contextHref}
                  />
                </div>
              </section>

              <div className="mt-4 lg:mt-0">
                <StudentContextPanel
                  studentId={selected.studentId}
                  studentName={selected.studentName}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
