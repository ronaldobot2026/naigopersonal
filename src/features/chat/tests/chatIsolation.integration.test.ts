/// <reference types="node" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '@/lib/supabase/database.types'

/**
 * Isolamento RLS do chat (`conversations` + `messages`, migration
 * `20261007140000_chat_conversations_messages.sql`) — mesmo padrão de
 * `src/features/anamnesis/tests/anamnesisIsolation.integration.test.ts`: semeia dois personais e
 * três alunos efêmeros com a service_role key (só setup/limpeza) e toda leitura/escrita avaliada
 * passa pela chave publicável, como a UI.
 *
 * Esta fatia é só banco (não há repositório de chat no Supabase ainda), então as asserções são
 * SQL direto. O que está sob teste é o negativo:
 * - aluno A não lê nem escreve na conversa do aluno B (mesmo personal);
 * - personal de outro aluno não lê a conversa nem as mensagens do aluno A;
 * - ninguém forja `sender_id` (mensagem assinada por outro);
 * - aluno não abre conversa com personal que não é o seu;
 * - quem ENVIOU não marca a própria mensagem como lida; quem recebeu marca;
 * - quem recebeu não reescreve o `body` (trigger `messages_guard_update`).
 *
 * Requer `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` além de `VITE_SUPABASE_URL`/
 * `VITE_SUPABASE_PUBLISHABLE_KEY`. Sem as credenciais, pula. Para rodar:
 *   SUPABASE_SERVICE_ROLE_KEY=$(cat ~/.config/naigo/service_role.key) npx vitest run integration
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const hasCredentials = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && PUBLISHABLE_KEY)
if (!hasCredentials) {
  console.warn(
    'chatIsolation.integration.test.ts: pulado — faltam SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ' +
      '(além de VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY, já exigidas pelo app).',
  )
}

describe.skipIf(!hasCredentials)('isolamento do chat entre alunos (RLS)', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const trainerEmail = `chat-trainer-${runId}@naigo.demo`
  const otherTrainerEmail = `chat-trainer2-${runId}@naigo.demo`
  const studentAEmail = `chat-student-a-${runId}@naigo.demo`
  const studentBEmail = `chat-student-b-${runId}@naigo.demo`
  const studentCEmail = `chat-student-c-${runId}@naigo.demo`
  const trainerPassword = `Chat-T1-${runId}`
  const otherTrainerPassword = `Chat-T2-${runId}`
  const studentAPassword = `Chat-A-${runId}`
  const studentBPassword = `Chat-B-${runId}`
  const studentCPassword = `Chat-C-${runId}`

  let admin: SupabaseClient<Database>
  let trainerId: string
  let otherTrainerId: string
  let studentAId: string
  let studentBId: string
  let studentCId: string
  /** Conversa do personal 1 com o aluno A. */
  let conversationAId: string
  /** Conversa do personal 1 com o aluno B (o aluno A nunca deve enxergar). */
  let conversationBId: string
  /** Mensagem do personal na conversa A (o aluno A é o destinatário). */
  let trainerMessageAId: string

  async function createUser(email: string, password: string, fullName: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error || !data.user) throw error ?? new Error(`Falha ao criar ${email}`)
    return data.user.id
  }

  /**
   * Um cliente autenticado POR usuário, logado uma única vez — e não o singleton do app com
   * signOut/signIn a cada teste, como nos testes de isolamento mais antigos. Motivo medido: com
   * 10 casos, o login repetido estoura o rate limit de auth do projeto
   * ("Request rate limit reached", 429) quando a suíte de integração roda inteira. A chave segue
   * sendo a publicável e a RLS continua avaliando `auth.uid()` do usuário logado — só o número
   * de sign-ins muda.
   */
  const sessions = new Map<string, SupabaseClient<Database>>()

  async function signInAs(email: string, password: string) {
    const cached = sessions.get(email)
    if (cached) return cached
    const client = createClient<Database>(SUPABASE_URL!, PUBLISHABLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await client.auth.signInWithPassword({ email, password })
    expect(error).toBeNull()
    sessions.set(email, client)
    return client
  }

  beforeAll(async () => {
    admin = createClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    trainerId = await createUser(trainerEmail, trainerPassword, 'Personal 1 (teste chat)')
    otherTrainerId = await createUser(
      otherTrainerEmail,
      otherTrainerPassword,
      'Personal 2 (teste chat)',
    )
    studentAId = await createUser(studentAEmail, studentAPassword, 'Aluno A (teste chat)')
    studentBId = await createUser(studentBEmail, studentBPassword, 'Aluno B (teste chat)')
    studentCId = await createUser(studentCEmail, studentCPassword, 'Aluno C (teste chat)')

    // handle_new_user ignora role/trainer_id do metadata desde o hardening de 2026-09-21.
    const { error: roleError } = await admin
      .from('profiles')
      .update({ role: 'trainer' })
      .in('id', [trainerId, otherTrainerId])
    if (roleError) throw roleError
    const { error: linkError } = await admin.from('students').insert([
      { id: studentAId, trainer_id: trainerId },
      { id: studentBId, trainer_id: trainerId },
      { id: studentCId, trainer_id: otherTrainerId },
    ])
    if (linkError) throw linkError
  })

  afterAll(async () => {
    await Promise.all([...sessions.values()].map((client) => client.auth.signOut()))
    // Alunos antes dos personais: a conversa referencia o trainer (`trainer_id` → profiles) e só
    // sai pelo cascade do aluno; apagando o personal primeiro, ele sobra no banco.
    await Promise.all(
      [studentAId, studentBId, studentCId]
        .filter(Boolean)
        .map((id) => admin.auth.admin.deleteUser(id)),
    )
    for (const id of [trainerId, otherTrainerId].filter(Boolean)) {
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) throw error
    }
    const { data, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listError) throw listError
    expect(data.users.filter((user) => user.email?.includes(runId))).toEqual([])
  })

  it('personal abre conversa com os próprios alunos e manda a primeira mensagem', async () => {
    const client = await signInAs(trainerEmail, trainerPassword)

    const { data: conversations, error: insertError } = await client
      .from('conversations')
      .insert([
        { trainer_id: trainerId, student_id: studentAId },
        { trainer_id: trainerId, student_id: studentBId },
      ])
      .select('id, student_id, last_message_at')
    expect(insertError).toBeNull()
    expect(conversations).toHaveLength(2)
    conversationAId = conversations!.find((c) => c.student_id === studentAId)!.id
    conversationBId = conversations!.find((c) => c.student_id === studentBId)!.id
    // Conversa recém-aberta não tem mensagem: o trigger ainda não tocou nada.
    expect(conversations!.every((c) => c.last_message_at === null)).toBe(true)

    const { data: message, error: messageError } = await client
      .from('messages')
      .insert({
        conversation_id: conversationAId,
        sender_id: trainerId,
        body: 'Vi que você aumentou a carga no supino, como foi?',
        context_kind: 'exercise',
        context_label: 'Treino A · Supino com barra',
      })
      .select('id, read_at, context_label, attachment_path')
      .single()
    expect(messageError).toBeNull()
    trainerMessageAId = message!.id
    expect(message!.read_at).toBeNull()
    expect(message!.context_label).toBe('Treino A · Supino com barra')
    // Anexo existe no schema mas não nesta fatia (só texto).
    expect(message!.attachment_path).toBeNull()

    // `last_message_at` é derivado por trigger — ninguém escreve na conversa para isso.
    const { data: touched } = await admin
      .from('conversations')
      .select('last_message_at')
      .eq('id', conversationAId)
      .single()
    expect(touched!.last_message_at).not.toBeNull()
  })

  it('personal não abre conversa em nome de outro personal (trainer_id forjado)', async () => {
    const client = await signInAs(trainerEmail, trainerPassword)

    const { error } = await client
      .from('conversations')
      .insert({ trainer_id: otherTrainerId, student_id: studentAId })
    expect(error).not.toBeNull()
  })

  it('personal de outro aluno não lê a conversa nem as mensagens do aluno A', async () => {
    const client = await signInAs(otherTrainerEmail, otherTrainerPassword)

    // RLS falha em silêncio na leitura: lista vazia, não erro.
    const { data: conversations, error: conversationsError } = await client
      .from('conversations')
      .select('*')
      .eq('student_id', studentAId)
    expect(conversationsError).toBeNull()
    expect(conversations).toEqual([])

    const { data: messages, error: messagesError } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationAId)
    expect(messagesError).toBeNull()
    expect(messages).toEqual([])

    // Sanity check: sem isto, um RLS que bloqueia tudo passaria disfarçado de sucesso acima.
    const { data: own, error: ownError } = await client
      .from('conversations')
      .insert({ trainer_id: otherTrainerId, student_id: studentCId })
      .select('id')
      .single()
    expect(ownError).toBeNull()
    expect(own!.id).toBeTruthy()
  })

  it('aluno A lê só a própria conversa — nada do aluno B', async () => {
    const client = await signInAs(studentAEmail, studentAPassword)

    const { data: conversations, error } = await client.from('conversations').select('id')
    expect(error).toBeNull()
    expect(conversations!.map((c) => c.id)).toEqual([conversationAId])

    const { data: messages, error: messagesError } = await client
      .from('messages')
      .select('id, body')
      .eq('conversation_id', conversationAId)
    expect(messagesError).toBeNull()
    expect(messages!.map((m) => m.id)).toEqual([trainerMessageAId])

    const { data: foreign, error: foreignError } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationBId)
    expect(foreignError).toBeNull()
    expect(foreign).toEqual([])
  })

  it('aluno A não escreve na conversa do aluno B', async () => {
    const client = await signInAs(studentAEmail, studentAPassword)

    const { error } = await client.from('messages').insert({
      conversation_id: conversationBId,
      sender_id: studentAId,
      body: 'invasão',
    })
    expect(error).not.toBeNull()

    const { count } = await admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationBId)
    expect(count).toBe(0)
  })

  it('ninguém forja sender_id: aluno A não manda mensagem assinada pelo personal', async () => {
    const client = await signInAs(studentAEmail, studentAPassword)

    const { error } = await client.from('messages').insert({
      conversation_id: conversationAId,
      sender_id: trainerId,
      body: 'assinada pelo personal',
    })
    expect(error).not.toBeNull()

    // E a própria, assinada por ele, passa — o bloqueio acima é do sender forjado, não do insert.
    const { data: own, error: ownError } = await client
      .from('messages')
      .insert({
        conversation_id: conversationAId,
        sender_id: studentAId,
        body: 'Foi tranquilo, subi para 47,5 kg',
        context_kind: 'workout_log',
      })
      .select('id')
      .single()
    expect(ownError).toBeNull()
    expect(own!.id).toBeTruthy()
  })

  it('aluno A não abre conversa com personal que não é o dele', async () => {
    const client = await signInAs(studentAEmail, studentAPassword)

    const { error } = await client
      .from('conversations')
      .insert({ trainer_id: otherTrainerId, student_id: studentAId })
    expect(error).not.toBeNull()
  })

  it('só quem recebeu marca a mensagem como lida — quem enviou, nunca', async () => {
    // Quem enviou: update bloqueado pela RLS afeta zero linhas (não dá erro).
    const trainerClient = await signInAs(trainerEmail, trainerPassword)
    const readAt = new Date().toISOString()
    const { data: senderTry, error: senderError } = await trainerClient
      .from('messages')
      .update({ read_at: readAt })
      .eq('id', trainerMessageAId)
      .select('id')
    expect(senderError).toBeNull()
    expect(senderTry).toEqual([])

    const { data: stillUnread } = await admin
      .from('messages')
      .select('read_at')
      .eq('id', trainerMessageAId)
      .single()
    expect(stillUnread!.read_at).toBeNull()

    // Quem recebeu: marca.
    const studentClient = await signInAs(studentAEmail, studentAPassword)
    const { data: recipientTry, error: recipientError } = await studentClient
      .from('messages')
      .update({ read_at: readAt })
      .eq('id', trainerMessageAId)
      .select('id, read_at')
    expect(recipientError).toBeNull()
    expect(recipientTry).toHaveLength(1)
    expect(recipientTry![0].read_at).not.toBeNull()
  })

  it('quem recebeu não reescreve o corpo da mensagem (trigger de guarda)', async () => {
    const client = await signInAs(studentAEmail, studentAPassword)

    const { error } = await client
      .from('messages')
      .update({ body: 'texto trocado' })
      .eq('id', trainerMessageAId)
    expect(error).not.toBeNull()

    const { data: row } = await admin
      .from('messages')
      .select('body, context_label')
      .eq('id', trainerMessageAId)
      .single()
    expect(row).toEqual({
      body: 'Vi que você aumentou a carga no supino, como foi?',
      context_label: 'Treino A · Supino com barra',
    })
  })

  it('mensagem vazia não entra (check de body)', async () => {
    const client = await signInAs(studentAEmail, studentAPassword)

    const { error } = await client
      .from('messages')
      .insert({ conversation_id: conversationAId, sender_id: studentAId, body: '   ' })
    expect(error).not.toBeNull()
  })
})
