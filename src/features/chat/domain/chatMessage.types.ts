/**
 * Domínio do chat personal ↔ aluno (Fase 12 do docs/ROADMAP.md).
 *
 * Espelha `public.messages`/`public.conversations` (migration 20261007140000) em camelCase: o
 * `snake_case` das linhas do Supabase não sai do repositório.
 */

/** Mesmo `check` de `messages.context_kind` no banco. */
export const CHAT_CONTEXT_KINDS = ['free', 'workout_log', 'exercise', 'assessment'] as const

export type ChatContextKind = (typeof CHAT_CONTEXT_KINDS)[number]

export type ChatAttachmentKind = 'image' | 'video'

/**
 * A que a mensagem se refere. `label` é o rótulo legível CONGELADO no envio ("Treino A · Supino
 * com barra") — vem denormalizado do banco de propósito, para a mensagem continuar fazendo
 * sentido depois de a ficha mudar. Conversa solta é `kind: 'free'` com `id: null` e label vazio.
 */
export interface ChatMessageContext {
  kind: ChatContextKind
  id: string | null
  label: string
}

export const FREE_CONTEXT: ChatMessageContext = { kind: 'free', id: null, label: '' }

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  body: string
  context: ChatMessageContext
  /** Preenchidos só na versão com mídia — as colunas já existem no banco. */
  attachmentPath: string | null
  attachmentKind: ChatAttachmentKind | null
  /** `null` enquanto quem RECEBEU não abriu a conversa. Quem envia nunca marca a própria. */
  readAt: string | null
  createdAt: string
  /**
   * Só na mensagem otimista, enquanto o `insert` não confirmou. Nunca vem do banco — o id da
   * mensagem é gerado no cliente e reenviado no insert, então a confirmação (ou o evento do
   * Realtime) substitui esta linha pela definitiva em vez de duplicá-la.
   */
  pending?: boolean
}

export interface Conversation {
  id: string
  trainerId: string
  studentId: string
  /** Mantido por trigger no banco (`messages_touch_conversation`) — ordena a lista. */
  lastMessageAt: string | null
  createdAt: string
}

/** Uma linha da lista de conversas do personal. */
export interface ConversationSummary {
  conversation: Conversation
  lastMessage: ChatMessage | null
  unreadCount: number
}

/** Mensagem que `userId` recebeu e ainda não leu — é o que alimenta o contador de não lidas. */
export function isUnreadFor(
  message: Pick<ChatMessage, 'readAt' | 'senderId'>,
  userId: string,
): boolean {
  return message.readAt === null && message.senderId !== userId
}

/** Horário da bolha ("14:20"). Formatado aqui para a tela não repetir `toLocaleTimeString`. */
export function formatMessageTime(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
