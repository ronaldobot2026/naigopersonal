// Sonda de realtime do chat: assina `postgres_changes` em `public.messages`, insere uma mensagem
// e confirma que o evento chega. Prova da publication `supabase_realtime` (a RLS por participante
// é coberta por src/features/chat/tests/chatIsolation.integration.test.ts).
//
// Roda com a service_role key — é setup/limpeza, não um teste de permissão:
//   node scripts/chat-realtime-probe.cjs
// Sai 0 se o evento chegou, 1 se não chegou. A conversa e a mensagem de sonda são apagadas no fim.
const { createClient } = require('@supabase/supabase-js')
const fs = require('node:fs')
const path = require('node:path')

const URL = process.env.SUPABASE_URL ?? 'https://midftshifkvweehrtyte.supabase.co'
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  fs.readFileSync(path.join(process.env.HOME, '.config/naigo/service_role.key'), 'utf8').trim()

;(async () => {
  const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: student, error: studentError } = await db
    .from('students')
    .select('id, trainer_id')
    .limit(1)
    .single()
  if (studentError) throw studentError
  console.log('aluno/personal usados:', student.id, student.trainer_id)

  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .insert({ trainer_id: student.trainer_id, student_id: student.id })
    .select('id')
    .single()
  if (conversationError) throw conversationError

  const received = []
  const channel = db
    .channel('chat-realtime-probe')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
      received.push(payload.new),
    )
  await new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status))
    })
  })
  console.log('canal SUBSCRIBED')

  const { data: message, error: messageError } = await db
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      sender_id: student.trainer_id,
      body: 'sonda de realtime',
      context_kind: 'free',
    })
    .select('id')
    .single()
  if (messageError) throw messageError

  const deadline = Date.now() + 10_000
  while (received.length === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  console.log('eventos recebidos:', received.length)
  if (received.length > 0) console.log('payload:', JSON.stringify(received[0]))

  await db.removeChannel(channel)
  await db.from('messages').delete().eq('id', message.id)
  await db.from('conversations').delete().eq('id', conversation.id)
  const { data: left } = await db.from('conversations').select('id')
  console.log('conversas restantes no banco:', left.length)

  process.exit(received.length > 0 ? 0 : 1)
})().catch((error) => {
  console.error('FALHOU:', error.message)
  process.exit(1)
})
