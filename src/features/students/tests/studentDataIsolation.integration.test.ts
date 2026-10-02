/// <reference types="node" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getSupabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { studentRepository } from '../repositories/studentRepository'
import { physicalAssessmentRepository } from '@/features/assessments/physical/repositories/physicalAssessmentRepository'

/**
 * Teste de integração exigido pelo docs/BACKEND_PLAN.md ("Auth e RLS", item 5): "RequireRole é
 * UX, não autorização — quem impede aluno A de ler dado de aluno B é exclusivamente o RLS".
 * `docs/DECISIONS.md`/`docs/ROADMAP.md` (Fase 7) já registravam isso como pendente por faltar um
 * segundo aluno real para testar contra.
 *
 * Roda contra um Supabase de verdade (local via `supabase start`, ou o projeto remoto). Semeia
 * dois alunos efêmeros com a service_role key — mesmo padrão do `scripts/seed-demo-users.mjs` —,
 * grava uma ficha completa para o aluno B, autentica como aluno A com a chave publicável (o mesmo
 * caminho que `LoginPage`/`signInAndFetchRole` usa) e confirma que nenhuma leitura do dado do
 * aluno B volta preenchida — nem em SQL direto, nem passando pelos repositórios que a UI usa.
 * `afterAll` apaga os três usuários (cascade cuida do resto via `on delete cascade`).
 *
 * Requer `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (só para semear/limpar; nunca usada para a
 * leitura que o teste avalia) além de `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` (as
 * mesmas que o app já exige, ver `.env.example`). Sem elas, o teste pula — não quebra
 * `npm run test:run` numa máquina/CI sem Supabase configurado. Para rodar localmente:
 *   supabase start   # imprime as chaves locais, inclusive a service_role
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role local> npm run test:run -- studentDataIsolation
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const hasCredentials = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && PUBLISHABLE_KEY)
if (!hasCredentials) {
  console.warn(
    'studentDataIsolation.integration.test.ts: pulado — faltam SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ' +
      '(além de VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY, já exigidas pelo app).',
  )
}

describe.skipIf(!hasCredentials)('isolamento de dados entre alunos (RLS)', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const trainerEmail = `isolation-trainer-${runId}@example.com`
  const studentAEmail = `isolation-student-a-${runId}@example.com`
  const studentBEmail = `isolation-student-b-${runId}@example.com`
  const studentAPassword = `Isolamento-A-${runId}`
  const studentBPassword = `Isolamento-B-${runId}`
  const trainerPassword = `Isolamento-T-${runId}`

  let admin: SupabaseClient<Database>
  let trainerId: string
  let studentAId: string
  let studentBId: string
  let assessmentBId: string

  beforeAll(async () => {
    admin = createClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: trainer, error: trainerError } = await admin.auth.admin.createUser({
      email: trainerEmail,
      password: trainerPassword,
      email_confirm: true,
      user_metadata: { role: 'trainer', full_name: 'Personal (teste isolamento)' },
    })
    if (trainerError || !trainer.user) throw trainerError ?? new Error('Falha ao criar personal de teste')
    trainerId = trainer.user.id

    const { data: studentA, error: studentAError } = await admin.auth.admin.createUser({
      email: studentAEmail,
      password: studentAPassword,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: 'Aluno A (teste isolamento)', trainer_id: trainerId },
    })
    if (studentAError || !studentA.user) throw studentAError ?? new Error('Falha ao criar aluno A de teste')
    studentAId = studentA.user.id

    const { data: studentB, error: studentBError } = await admin.auth.admin.createUser({
      email: studentBEmail,
      password: studentBPassword,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: 'Aluno B (teste isolamento)', trainer_id: trainerId },
    })
    if (studentBError || !studentB.user) throw studentBError ?? new Error('Falha ao criar aluno B de teste')
    studentBId = studentB.user.id

    // Ficha real do aluno B, gravada pelo personal (service_role só bypassa RLS aqui, no setup —
    // a leitura avaliada pelo teste é sempre pela chave publicável, como o app faz de verdade).
    const { data: assessmentB, error: assessmentError } = await admin
      .from('physical_assessments')
      .insert({
        student_id: studentBId,
        evaluator_id: trainerId,
        status: 'completed',
        general_notes: 'Ficha do aluno B — não pode vazar para o aluno A',
      })
      .select('id')
      .single()
    if (assessmentError || !assessmentB) {
      throw assessmentError ?? new Error('Falha ao semear avaliação do aluno B')
    }
    assessmentBId = assessmentB.id

    const { error: metricsError } = await admin.from('body_metrics').insert({
      assessment_id: assessmentBId,
      student_id: studentBId,
      weight_kg: 70,
    })
    if (metricsError) throw metricsError
  })

  afterAll(async () => {
    await getSupabase().auth.signOut()
    await Promise.all(
      [studentAId, studentBId, trainerId]
        .filter(Boolean)
        .map((id) => admin.auth.admin.deleteUser(id)),
    )
  })

  it('aluno A autenticado não lê nenhum dado do aluno B', async () => {
    const client = getSupabase()
    const { error: signInError } = await client.auth.signInWithPassword({
      email: studentAEmail,
      password: studentAPassword,
    })
    expect(signInError).toBeNull()

    // Leitura direta — o caminho exato citado no BACKEND_PLAN.md: "leitura dos dados do aluno B
    // retorna vazio" (RLS falha em silêncio: lista vazia, não erro).
    const { data: studentRows, error: studentsError } = await client
      .from('students')
      .select('*')
      .eq('id', studentBId)
    expect(studentsError).toBeNull()
    expect(studentRows).toEqual([])

    const { data: profileRows, error: profilesError } = await client
      .from('profiles')
      .select('*')
      .eq('id', studentBId)
    expect(profilesError).toBeNull()
    expect(profileRows).toEqual([])

    const { data: assessmentRows, error: assessmentsError } = await client
      .from('physical_assessments')
      .select('*')
      .eq('student_id', studentBId)
    expect(assessmentsError).toBeNull()
    expect(assessmentRows).toEqual([])

    const { data: metricsRows, error: metricsError } = await client
      .from('body_metrics')
      .select('*')
      .eq('student_id', studentBId)
    expect(metricsError).toBeNull()
    expect(metricsRows).toEqual([])

    // Mesmo caminho que a UI usa (repositórios recém-migrados para `database.types.ts`) — prova
    // que o isolamento vale de ponta a ponta, não só na query crua.
    await expect(studentRepository.findById(studentBId)).resolves.toBeNull()
    await expect(physicalAssessmentRepository.findById(assessmentBId)).resolves.toBeNull()
    await expect(physicalAssessmentRepository.findByStudentId(studentBId)).resolves.toEqual([])

    // Sanity check: aluno A continua enxergando o próprio registro — sem isto, um bug de RLS que
    // bloqueia tudo (sessão não autenticada, por exemplo) passaria disfarçado de sucesso acima.
    await expect(studentRepository.findById(studentAId)).resolves.not.toBeNull()
  })
})
