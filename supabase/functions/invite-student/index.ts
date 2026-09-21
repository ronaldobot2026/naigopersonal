// Edge Function "invite-student" — Fase 8 do docs/ROADMAP.md (cadastro/convite de aluno pela
// UI). Ver docs/BACKEND_PLAN.md ("Convite via auth.admin.inviteUserByEmail + trigger em
// auth.users, sem tabela de convites") e docs/PENTEST_REPORT.md (achado crítico remediado no
// commit 9fa594c).
//
// Por que isto precisa ser uma Edge Function (service_role), e não o cliente direto:
// `auth.admin.inviteUserByEmail` só existe na Admin API (exige service_role, que nunca pode
// chegar ao navegador). E, desde a migration `20260921150000_security_hardening.sql`, o trigger
// `handle_new_user()` deliberadamente NÃO lê mais `role`/`trainer_id` de `raw_user_meta_data`
// (esse era o achado crítico do pentest — qualquer cliente podia se autovincular como aluno de
// um personal só sabendo o `trainer_id`). Todo usuário novo nasce `profiles.role = 'student'`
// sem nenhum vínculo. O vínculo aluno↔personal (a linha em `public.students`) passa a ser
// responsabilidade exclusiva desta função, DEPOIS de validar server-side (via JWT verificado,
// nunca por dado enviado pelo cliente) que quem está chamando é de fato um trainer.
//
// verify_jwt fica no padrão (true, sem entrada em supabase/config.toml) — o gateway já rejeita
// chamada sem JWT válido antes de invocar o handler; o checável aqui é o papel (trainer), que o
// JWT sozinho não garante.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_FULL_NAME_LENGTH = 120

interface InviteStudentPayload {
  email: string
  full_name: string
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function parsePayload(raw: unknown): InviteStudentPayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { email, full_name: fullName } = raw as Record<string, unknown>
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) return null
  if (typeof fullName !== 'string' || fullName.trim().length === 0) return null
  if (fullName.trim().length > MAX_FULL_NAME_LENGTH) return null
  return { email: email.trim().toLowerCase(), full_name: fullName.trim() }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('invite-student: variáveis de ambiente do projeto ausentes.')
    return jsonResponse({ error: 'Configuração do servidor incompleta.' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }

  // Cliente com a chave anônima + o JWT de quem chamou — só enxerga o que a RLS deixar (o
  // próprio perfil), nunca dado de outra pessoa. É a fonte da verdade de "quem está chamando",
  // nunca um campo solto no corpo da requisição.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }
  const callerId = userData.user.id

  const { data: callerProfile, error: callerProfileError } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .maybeSingle()
  if (callerProfileError || !callerProfile) {
    return jsonResponse({ error: 'Não foi possível confirmar o perfil de quem chamou.' }, 403)
  }
  if (callerProfile.role !== 'trainer') {
    return jsonResponse({ error: 'Só um personal pode convidar alunos.' }, 403)
  }

  let payload: InviteStudentPayload | null
  try {
    payload = parsePayload(await req.json())
  } catch {
    payload = null
  }
  if (!payload) {
    return jsonResponse({ error: 'Informe um e-mail válido e o nome completo do aluno.' }, 400)
  }

  // Só a partir daqui usa service_role — e só para (1) criar o usuário via Admin API e (2)
  // gravar o vínculo trainer_id que acabou de ser validado acima, nunca para reler/decidir nada
  // a partir do corpo da requisição sem essa validação prévia.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    payload.email,
    { data: { full_name: payload.full_name } },
  )
  if (inviteError || !invited.user) {
    const message = inviteError?.message ?? 'Não foi possível convidar este aluno.'
    const status = /already|existe|registered/i.test(message) ? 409 : 400
    return jsonResponse({ error: message }, status)
  }

  const { error: linkError } = await admin
    .from('students')
    .insert({ id: invited.user.id, trainer_id: callerId })
  if (linkError) {
    // Sem o vínculo, o convite fica "pendurado" (profile sem trainer) — mais seguro desfazer o
    // convite do que deixar uma conta órfã que ninguém vê na lista de alunos.
    await admin.auth.admin.deleteUser(invited.user.id)
    console.error('invite-student: falha ao vincular aluno ao trainer', linkError)
    return jsonResponse({ error: 'Convite criado, mas o vínculo com você falhou. Tente novamente.' }, 500)
  }

  return jsonResponse({ studentId: invited.user.id }, 201)
})
