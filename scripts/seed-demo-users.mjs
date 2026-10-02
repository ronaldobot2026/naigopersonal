#!/usr/bin/env node
/**
 * Cria os dois usuários reais de demonstração no Supabase Auth (personal + aluno) — a fatia
 * mínima de login real da Fase 9 (ver docs/ROADMAP.md). Sem isso não existe `auth.uid()` e a RLS
 * bloqueia qualquer leitura/escrita da Avaliação Física.
 *
 * Roda uma vez, na sua máquina, com a SERVICE_ROLE_KEY do projeto (nunca a chave publicável).
 * Essa chave bypassa RLS — não a coloque em .env.local nem em nenhum arquivo versionado; passe
 * só como variável de ambiente na hora de rodar o script.
 *
 * Uso:
 *   SUPABASE_URL=https://<projeto>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<sua service_role key> \
 *   TRAINER_EMAIL=personal@example.com TRAINER_PASSWORD='senha-forte-aqui' \
 *   STUDENT_EMAIL=aluno@example.com STUDENT_PASSWORD='outra-senha-forte' \
 *   node scripts/seed-demo-users.mjs
 *
 * No fim, o script imprime a linha para colar em .env.local (VITE_DEMO_STUDENT_ID=...).
 */
import { createClient } from '@supabase/supabase-js'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Variável de ambiente ${name} não definida. Ver o cabeçalho deste script.`)
    process.exit(1)
  }
  return value
}

const supabaseUrl = requireEnv('SUPABASE_URL')
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const trainerEmail = requireEnv('TRAINER_EMAIL')
const trainerPassword = requireEnv('TRAINER_PASSWORD')
const studentEmail = requireEnv('STUDENT_EMAIL')
const studentPassword = requireEnv('STUDENT_PASSWORD')

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: trainer, error: trainerError } = await admin.auth.admin.createUser({
    email: trainerEmail,
    password: trainerPassword,
    email_confirm: true,
    user_metadata: { role: 'trainer', full_name: 'Personal (demo)' },
  })
  if (trainerError) throw trainerError
  console.log(`Personal criado: ${trainer.user.id} (${trainerEmail})`)

  const { data: student, error: studentError } = await admin.auth.admin.createUser({
    email: studentEmail,
    password: studentPassword,
    email_confirm: true,
    user_metadata: {
      role: 'student',
      full_name: 'Aluno Demo',
      trainer_id: trainer.user.id,
    },
  })
  if (studentError) throw studentError
  console.log(`Aluno criado: ${student.user.id} (${studentEmail})`)

  console.log('\nAdicione ao seu .env.local:')
  console.log(`VITE_DEMO_STUDENT_ID=${student.user.id}`)
  console.log('\nPara logar, use os e-mails/senhas passados acima na tela de login do app.')
}

main().catch((error) => {
  console.error('Falha ao criar os usuários de demonstração:', error.message ?? error)
  process.exit(1)
})
