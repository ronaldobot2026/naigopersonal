/**
 * Caixa de entrada do PERSONAL — as conversas de todos os alunos dele numa lista só.
 *
 * O aluno tem uma conversa; o personal tem N, e precisa decidir em dois segundos qual abrir.
 * Daí a ordem ser pela MEXIDA mais recente (`last_message_at`, mantido por trigger no banco) e as
 * não lidas virem como número, não como enfeite.
 *
 * Tudo aqui é função pura sobre listas já carregadas: a lista chega do repositório e as mensagens
 * do Realtime são aplicadas em memória (`applyIncomingMessage`) em vez de disparar uma releitura
 * por mensagem. Nada nesta camada inventa dado: aluno sem nome em `profiles` aparece com rótulo
 * explícito, e conversa sem mensagem não ganha prévia falsa.
 */

import type { ChatMessage, ConversationSummary } from './chatMessage.types'

/** Uma linha da caixa de entrada. */
export interface InboxEntry {
  conversationId: string
  studentId: string
  /** Nome do aluno em `profiles`. Sem perfil legível, rótulo explícito — nunca id cru na tela. */
  studentName: string
  /** `null` = conversa aberta e sem nenhuma mensagem ainda. */
  lastMessage: ChatMessage | null
  /** Mensagens que o personal recebeu nesta conversa e ainda não leu. */
  unreadCount: number
  /**
   * Quando a conversa mexeu por último. Sai da ÚLTIMA MENSAGEM quando existe, e não do
   * `last_message_at` da conversa: a mensagem que acabou de chegar pelo Realtime atualiza a lista
   * antes de qualquer releitura da linha de `conversations`, e as duas datas precisam concordar.
   */
  lastActivityAt: string | null
}

/** Nome exibido quando o aluno não tem perfil legível — nunca o uuid na cara do personal. */
export const UNKNOWN_STUDENT_NAME = 'Aluno sem nome cadastrado'

/**
 * Ordem da caixa de entrada: mexida mais recente primeiro, conversa sem mensagem no fim.
 *
 * O empate (duas conversas sem atividade) cai no nome, para a lista não trocar de ordem sozinha
 * entre renders.
 */
export function sortInbox(entries: InboxEntry[]): InboxEntry[] {
  return [...entries].sort((a, b) => {
    if (a.lastActivityAt === b.lastActivityAt) return a.studentName.localeCompare(b.studentName)
    if (a.lastActivityAt === null) return 1
    if (b.lastActivityAt === null) return -1
    return b.lastActivityAt.localeCompare(a.lastActivityAt)
  })
}

/** Junta as conversas do repositório com os nomes dos alunos e devolve a lista já ordenada. */
export function buildInbox(
  summaries: ConversationSummary[],
  studentNameById: Map<string, string>,
): InboxEntry[] {
  return sortInbox(
    summaries.map((summary) => ({
      conversationId: summary.conversation.id,
      studentId: summary.conversation.studentId,
      studentName:
        studentNameById.get(summary.conversation.studentId)?.trim() || UNKNOWN_STUDENT_NAME,
      lastMessage: summary.lastMessage,
      unreadCount: summary.unreadCount,
      lastActivityAt: summary.lastMessage?.createdAt ?? summary.conversation.lastMessageAt,
    })),
  )
}

/**
 * Aplica no lugar uma mensagem que chegou pelo Realtime.
 *
 * Devolve `null` quando a conversa NÃO está na lista — é o caso de um aluno que acabou de abrir
 * conversa, e aí quem chama precisa reler a lista (a linha de `conversations` é nova e o nome do
 * aluno ainda não está em memória). Inventar uma entrada aqui mostraria uma conversa sem nome.
 *
 * `selfId` é quem está logado: mensagem enviada pelo próprio personal atualiza a prévia mas NÃO
 * conta como não lida.
 */
export function applyIncomingMessage(
  entries: InboxEntry[],
  message: ChatMessage,
  selfId: string,
): InboxEntry[] | null {
  const index = entries.findIndex((entry) => entry.conversationId === message.conversationId)
  if (index === -1) return null

  const current = entries[index]
  // Mensagem antiga (reconexão do Realtime pode reentregar) não pode rebaixar a prévia.
  const isNewer =
    current.lastMessage === null || message.createdAt >= current.lastMessage.createdAt
  const alreadyKnown = current.lastMessage?.id === message.id

  const updated: InboxEntry = {
    ...current,
    lastMessage: isNewer ? message : current.lastMessage,
    lastActivityAt: isNewer ? message.createdAt : current.lastActivityAt,
    unreadCount:
      message.senderId === selfId || alreadyKnown || message.readAt !== null
        ? current.unreadCount
        : current.unreadCount + 1,
  }

  const next = [...entries]
  next[index] = updated
  return sortInbox(next)
}

/** Zera as não lidas de uma conversa — a tela está aberta e o `markRead` já rodou nela. */
export function markInboxRead(entries: InboxEntry[], conversationId: string): InboxEntry[] {
  return entries.map((entry) =>
    entry.conversationId === conversationId && entry.unreadCount !== 0
      ? { ...entry, unreadCount: 0 }
      : entry,
  )
}

/** Não lidas de todas as conversas — é o número do badge da navegação do personal. */
export function totalUnread(entries: InboxEntry[]): number {
  return entries.reduce((total, entry) => total + entry.unreadCount, 0)
}

/**
 * Quando a conversa mexeu, curto: `14:20` para hoje, `07/10` para antes. A lista mostra dezenas de
 * linhas e data completa em todas é ruído.
 */
export function formatInboxTime(iso: string | null): string {
  if (iso === null) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Prévia de uma linha. Mensagem com contexto mostra o rótulo congelado antes do texto — é o que
 * diz ao personal se a dúvida veio de um treino ou é conversa solta, antes de ele abrir.
 */
export function previewBody(message: ChatMessage | null): string {
  if (message === null) return 'Nenhuma mensagem ainda'
  const body = message.body.replace(/\s+/g, ' ').trim()
  return message.context.label === '' ? body : `${message.context.label} · ${body}`
}
