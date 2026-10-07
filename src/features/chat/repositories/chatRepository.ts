import { generateId } from '@/lib/generateId'
import { getSupabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import {
  FREE_CONTEXT,
  type ChatAttachmentKind,
  type ChatMessage,
  type ChatMessageContext,
  type Conversation,
  type ConversationSummary,
} from '../domain/chatMessage.types'

type ConversationRow = Database['public']['Tables']['conversations']['Row']
type MessageRow = Database['public']['Tables']['messages']['Row']

/** Tamanho da página da conversa (a tela lê as últimas N e sobe). */
export const DEFAULT_MESSAGE_PAGE_SIZE = 30

export interface ListMessagesRange {
  /** Cursor: só mensagens ANTERIORES a este `created_at` (paginação para trás). */
  before?: string
  limit?: number
}

export interface SendMessageInput {
  conversationId: string
  body: string
  context?: ChatMessageContext
  /**
   * Id gerado no cliente. Quem envia já tem a mensagem na tela antes da resposta; reenviar o
   * mesmo id faz a confirmação e o evento do Realtime substituírem a bolha otimista em vez de
   * criarem outra (ver `domain/chatThread.ts`).
   */
  id?: string
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    studentId: row.student_id,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  }
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    context: {
      kind: row.context_kind as ChatMessageContext['kind'],
      id: row.context_id,
      label: row.context_label,
    },
    attachmentPath: row.attachment_path,
    attachmentKind: row.attachment_kind as ChatAttachmentKind | null,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

/**
 * Quem está logado, pela SESSÃO — nunca por parâmetro. `sender_id` vindo de fora seria mensagem
 * assinada por outro; a RLS (`sender_id = auth.uid()`) recusaria, mas o erro apareceria só em
 * produção.
 */
async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession()
  if (error) throw error
  const userId = data.session?.user.id
  if (!userId) throw new Error('Sessão expirada. Entre novamente para conversar.')
  return userId
}

async function lastMessageOf(conversationId: string): Promise<ChatMessage | null> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const rows = (data ?? []) as MessageRow[]
  return rows.length > 0 ? toMessage(rows[0]) : null
}

/**
 * Conversa personal↔aluno e mensagens no Supabase (migrations 2026100714*). Mesma forma do
 * `workoutLogRepository`: nada de `snake_case` sai daqui, e toda escrita confia na RLS do banco
 * como autorização de verdade.
 */
export const chatRepository = {
  /**
   * A conversa do par, criando-a se ainda não existir. Idempotente pelo `unique (trainer_id,
   * student_id)`: `insert ... on conflict do nothing` seguido do `select` da linha.
   *
   * Dois detalhes que parecem acidentais e não são:
   *
   * 1. Não é select-then-insert. Duas telas abrindo a conversa ao mesmo tempo passariam as duas
   *    pelo select vazio e a segunda tomaria `23505`; aqui a corrida morre no `do nothing`.
   * 2. `ignoreDuplicates: true` é obrigatório, não otimização. O upsert normal do supabase-js é
   *    `on conflict do update`, e o ALUNO só tem policy de `insert` em `conversations` (a de
   *    `update` existe apenas para o personal, via `conversations_all_trainer`) — o `do update`
   *    bateria na RLS justamente no caso comum de a conversa já existir.
   */
  async ensureConversation(trainerId: string, studentId: string): Promise<Conversation> {
    const supabase = getSupabase()

    const { error: upsertError } = await supabase
      .from('conversations')
      .upsert(
        { trainer_id: trainerId, student_id: studentId },
        { onConflict: 'trainer_id,student_id', ignoreDuplicates: true },
      )
    if (upsertError) throw upsertError

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('trainer_id', trainerId)
      .eq('student_id', studentId)
      .single()
    if (error) throw error
    return toConversation(data as ConversationRow)
  },

  /**
   * A conversa do ALUNO logado com o próprio personal. O aluno não escolhe interlocutor: o
   * `trainer_id` vem de `students`, que é o mesmo vínculo que a policy
   * `conversations_insert_own` exige — mandar outro id resultaria em violação de RLS.
   */
  async ensureConversationForCurrentStudent(): Promise<Conversation> {
    const studentId = await currentUserId()
    const { data, error } = await getSupabase()
      .from('students')
      .select('trainer_id')
      .eq('id', studentId)
      .single()
    if (error) throw error
    return chatRepository.ensureConversation(
      (data as Pick<Database['public']['Tables']['students']['Row'], 'trainer_id'>).trainer_id,
      studentId,
    )
  },

  /**
   * A conversa do aluno logado, se já existir — SEM criar.
   *
   * O badge de não lidas roda no shell, em toda tela do aluno; usar `ensureConversation` ali
   * criaria a linha de `conversations` só porque o app abriu, antes de qualquer mensagem. Quem
   * cria é a tela do chat, quando o aluno de fato entra na conversa.
   */
  async findConversationForCurrentStudent(): Promise<Conversation | null> {
    const studentId = await currentUserId()
    const { data, error } = await getSupabase()
      .from('conversations')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })
      .limit(1)
    if (error) throw error
    const rows = (data ?? []) as ConversationRow[]
    return rows.length > 0 ? toConversation(rows[0]) : null
  },

  /**
   * Página da conversa, da mensagem MAIS RECENTE para a mais antiga (índice
   * `messages_conversation_created_idx`). `before` é o cursor para subir no histórico: passe o
   * `createdAt` da mensagem mais antiga que já está na tela.
   */
  async listMessages(
    conversationId: string,
    range: ListMessagesRange = {},
  ): Promise<ChatMessage[]> {
    let query = getSupabase().from('messages').select('*').eq('conversation_id', conversationId)

    if (range.before !== undefined) query = query.lt('created_at', range.before)

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(range.limit ?? DEFAULT_MESSAGE_PAGE_SIZE)
    if (error) throw error
    return ((data ?? []) as MessageRow[]).map(toMessage)
  },

  /**
   * Envia a mensagem. `sender_id` vem da sessão; o contexto default é conversa solta (`free`).
   *
   * O `body` é enviado sem espaços nas pontas porque o banco exige `length(trim(body)) > 0` —
   * mandar `"   "` seria um `23514` em vez de um aviso de campo vazio.
   */
  async sendMessage({ conversationId, body, context, id }: SendMessageInput): Promise<ChatMessage> {
    const trimmed = body.trim()
    if (!trimmed) throw new Error('Mensagem vazia.')

    const senderId = await currentUserId()
    const effective = context ?? FREE_CONTEXT

    const { data, error } = await getSupabase()
      .from('messages')
      .insert({
        id: id ?? generateId(),
        conversation_id: conversationId,
        sender_id: senderId,
        body: trimmed,
        context_kind: effective.kind,
        context_id: effective.id,
        context_label: effective.label,
      })
      .select('*')
      .single()
    if (error) throw error
    return toMessage(data as MessageRow)
  },

  /**
   * Marca como lidas as mensagens indicadas. `read_at is null` no filtro mantém a data da PRIMEIRA
   * leitura (reabrir a conversa não reescreve o horário), e a RLS garante que só o destinatário
   * consegue marcar — quem enviou não marca a própria mensagem como lida.
   */
  async markRead(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return

    const { error } = await getSupabase()
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', messageIds)
      .is('read_at', null)
    if (error) throw error
  },

  /**
   * Quantas mensagens o usuário logado recebeu e ainda não leu nesta conversa. `head: true` não
   * traz linha nenhuma — é só o `count`, servido pelo índice parcial
   * `messages_unread_by_recipient_idx`.
   */
  async unreadCount(conversationId: string): Promise<number> {
    const userId = await currentUserId()
    const { count, error } = await getSupabase()
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .is('read_at', null)
      .neq('sender_id', userId)
    if (error) throw error
    return count ?? 0
  },

  /**
   * Lista de conversas do personal, da mexida mais recente para a mais antiga (índice
   * `conversations_trainer_last_message_idx`), cada uma com a última mensagem e as não lidas DELE.
   *
   * As não lidas saem numa consulta só (`in`, filtro parcial) e são contadas em memória — é um
   * conjunto naturalmente pequeno. A última mensagem é uma consulta de UMA linha por conversa, em
   * paralelo: "a última de cada grupo" não é expressável em PostgREST sem `distinct on`, e o
   * atalho de varrer as N mensagens mais recentes de todas as conversas juntas esconderia a
   * última mensagem de uma conversa parada atrás das de uma conversa movimentada.
   */
  async listConversations(trainerId: string): Promise<ConversationSummary[]> {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
    if (error) throw error

    const conversations = ((data ?? []) as ConversationRow[]).map(toConversation)
    if (conversations.length === 0) return []

    const ids = conversations.map((conversation) => conversation.id)

    const { data: unreadRows, error: unreadError } = await supabase
      .from('messages')
      .select('conversation_id, sender_id, read_at')
      .in('conversation_id', ids)
      .is('read_at', null)
      .neq('sender_id', trainerId)
    if (unreadError) throw unreadError

    // As linhas que voltaram JÁ são as não lidas dele (`read_at is null` + `sender_id <>`): aqui
    // só se agrupa por conversa.
    const unreadByConversation = new Map<string, number>()
    for (const row of (unreadRows ?? []) as Pick<MessageRow, 'conversation_id'>[]) {
      unreadByConversation.set(
        row.conversation_id,
        (unreadByConversation.get(row.conversation_id) ?? 0) + 1,
      )
    }

    const lastMessages = await Promise.all(ids.map((id) => lastMessageOf(id)))

    return conversations.map((conversation, index) => ({
      conversation,
      lastMessage: lastMessages[index],
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    }))
  },

  /** As conversas do PERSONAL logado. O `trainer_id` sai da sessão, nunca de parâmetro. */
  async listConversationsForCurrentTrainer(): Promise<ConversationSummary[]> {
    return chatRepository.listConversations(await currentUserId())
  },

  /**
   * Não lidas do usuário logado em TODAS as conversas dele — o número do badge da navegação do
   * personal, que tem uma conversa por aluno.
   *
   * Não há filtro de conversa aqui de propósito: a RLS de `messages`
   * (`messages_select_participants` → `can_access_conversation`) já restringe o `count` às
   * conversas em que ele participa. Listar as conversas primeiro para depois contar com `in`
   * seria um round-trip a mais pelo mesmo número.
   */
  async unreadCountForCurrentUser(): Promise<number> {
    const userId = await currentUserId()
    const { count, error } = await getSupabase()
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .neq('sender_id', userId)
    if (error) throw error
    return count ?? 0
  },

  /**
   * Assina os `INSERT` em `messages` de TODAS as conversas do usuário logado — é o que faz a caixa
   * de entrada do personal (e o badge dele) subirem sem recarregar.
   *
   * Sem filtro de `conversation_id`, e isso é uma decisão: `postgres_changes` aceita um filtro de
   * igualdade, não um `in`, então assinar N conversas exigiria N canais e ainda deixaria de fora a
   * conversa que um aluno acabar de abrir. A RLS continua sendo a autorização — o Realtime só
   * entrega a linha a quem poderia tê-la lido pelo `select` —, e quem consome ignora o que não
   * reconhece (ver `applyIncomingMessage`).
   */
  subscribeToAllMessages(onInsert: (message: ChatMessage) => void): () => void {
    const supabase = getSupabase()
    const channel = supabase
      // Sufixo único pelo mesmo motivo de `subscribeToMessages`: dois assinantes no mesmo topic
      // multiplexam e um deles fica mudo.
      .channel(`messages:all:${generateId()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => onInsert(toMessage(payload.new as MessageRow)),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  },

  /**
   * Assina os `INSERT` em `messages` da conversa aberta e devolve a função de cancelamento.
   *
   * O filtro é por `conversation_id` no servidor (a tela não recebe evento de conversa alheia), e
   * a RLS vale aqui também: o Realtime só entrega a linha a quem poderia tê-la lido.
   *
   * O topic leva um sufixo único por assinatura, e isso NÃO é cosmético: o supabase-js multiplexa
   * canais por topic e um segundo `join` no mesmo topic não recebe os eventos. A tela do chat e o
   * contador de não lidas da navegação assinam a MESMA conversa ao mesmo tempo — com topic fixo,
   * um dos dois ficaria mudo (foi exatamente o que aconteceu: a mensagem nova não chegava na tela
   * aberta porque o badge já tinha tomado o canal `messages:<id>`).
   *
   * Quem consome reconcilia por id — o remetente recebe o evento da PRÓPRIA mensagem, que já está
   * na tela (ver `mergeMessage`).
   */
  subscribeToMessages(conversationId: string, onInsert: (message: ChatMessage) => void): () => void {
    const supabase = getSupabase()
    const channel = supabase
      .channel(`messages:${conversationId}:${generateId()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => onInsert(toMessage(payload.new as MessageRow)),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  },
}
