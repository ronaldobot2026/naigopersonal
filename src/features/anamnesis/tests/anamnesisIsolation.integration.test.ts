/// <reference types="node" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getSupabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { anamnesisRepository } from '../repositories/anamnesisRepository'

/**
 * Isolamento RLS de `anamneses` (migration `20261001120000_anamneses.sql`) — mesmo padrão de
 * `src/features/assessments/postural/tests/correctivePlanIsolation.integration.test.ts`: semeia
 * dois personais e três alunos efêmeros com a service_role key (só setup/limpeza), e toda
 * leitura/escrita avaliada passa pela chave publicável e pelo repositório que a UI usa.
 *
 * Anamnese é dado de saúde (LGPD), então o que está sob teste é o negativo:
 * - aluno A não lê nem responde a anamnese do aluno B (mesmo personal);
 * - personal de outro aluno (outro trainer) não lê a anamnese do aluno A;
 * - aluno não vê o rascunho (`draft`) que o personal ainda está preenchendo;
 * - aluno não altera `template_id`/`trainer_id`/`filled_by` da própria linha (trigger
 *   `anamneses_guard_student_update` — RLS filtra linha, não coluna);
 * - anamnese concluída fica travada para o aluno (`using` exige `pending_student`).
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
    'anamnesisIsolation.integration.test.ts: pulado — faltam SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ' +
      '(além de VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY, já exigidas pelo app).',
  )
}

describe.skipIf(!hasCredentials)('isolamento da anamnese entre alunos (RLS)', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const trainerEmail = `anamnese-trainer-${runId}@naigo.demo`
  const otherTrainerEmail = `anamnese-trainer2-${runId}@naigo.demo`
  const studentAEmail = `anamnese-student-a-${runId}@naigo.demo`
  const studentBEmail = `anamnese-student-b-${runId}@naigo.demo`
  const studentCEmail = `anamnese-student-c-${runId}@naigo.demo`
  const trainerPassword = `Anamnese-T1-${runId}`
  const otherTrainerPassword = `Anamnese-T2-${runId}`
  const studentAPassword = `Anamnese-A-${runId}`
  const studentBPassword = `Anamnese-B-${runId}`
  const studentCPassword = `Anamnese-C-${runId}`

  let admin: SupabaseClient<Database>
  let trainerId: string
  let otherTrainerId: string
  let studentAId: string
  let studentBId: string
  let studentCId: string
  /** Pendente do aluno A (é o que ele pode responder). */
  let pendingAId: string
  /** Rascunho do personal para o aluno A (o aluno nunca deve enxergar). */
  let draftAId: string
  /** Pendente do aluno B (o aluno A nunca deve enxergar nem alterar). */
  let pendingBId: string

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

  async function signInAs(email: string, password: string) {
    const client = getSupabase()
    await client.auth.signOut()
    const { error } = await client.auth.signInWithPassword({ email, password })
    expect(error).toBeNull()
    return client
  }

  beforeAll(async () => {
    admin = createClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    trainerId = await createUser(trainerEmail, trainerPassword, 'Personal 1 (teste anamnese)')
    otherTrainerId = await createUser(
      otherTrainerEmail,
      otherTrainerPassword,
      'Personal 2 (teste anamnese)',
    )
    studentAId = await createUser(studentAEmail, studentAPassword, 'Aluno A (teste anamnese)')
    studentBId = await createUser(studentBEmail, studentBPassword, 'Aluno B (teste anamnese)')
    studentCId = await createUser(studentCEmail, studentCPassword, 'Aluno C (teste anamnese)')

    // handle_new_user ignora role/trainer_id do metadata desde o hardening de 2026-09-21 — o
    // vínculo é do fluxo de convite; aqui, via service_role.
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
    await getSupabase().auth.signOut()
    // Alunos antes dos personais: as anamneses referenciam o trainer (`trainer_id` → profiles)
    // e só saem pelo cascade do aluno; apagando o personal primeiro, ele sobra no banco.
    await Promise.all(
      [studentAId, studentBId, studentCId]
        .filter(Boolean)
        .map((id) => admin.auth.admin.deleteUser(id)),
    )
    for (const id of [trainerId, otherTrainerId].filter(Boolean)) {
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) throw error
    }
    // Prova do negativo: nenhum usuário do run sobrou.
    const { data, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listError) throw listError
    expect(data.users.filter((user) => user.email?.includes(runId))).toEqual([])
  })

  it('personal cria e lê as anamneses dos próprios alunos', async () => {
    await signInAs(trainerEmail, trainerPassword)

    const pendingA = await anamnesisRepository.create({
      studentId: studentAId,
      trainerId,
      templateId: 'parq',
      filledBy: 'student',
    })
    const draftA = await anamnesisRepository.create({
      studentId: studentAId,
      trainerId,
      templateId: 'standard',
      filledBy: 'trainer',
    })
    const pendingB = await anamnesisRepository.create({
      studentId: studentBId,
      trainerId,
      templateId: 'parq',
      filledBy: 'student',
    })
    pendingAId = pendingA.id
    draftAId = draftA.id
    pendingBId = pendingB.id

    expect(pendingA.status).toBe('pending_student')
    expect(draftA.status).toBe('draft')

    const listA = await anamnesisRepository.findByStudentId(studentAId)
    expect(listA.map((a) => a.id).sort()).toEqual([draftAId, pendingAId].sort())
    await expect(anamnesisRepository.findByStudentId(studentBId)).resolves.toHaveLength(1)
  })

  it('personal não cria anamnese em nome de outro autor (trainer_id forjado)', async () => {
    await signInAs(trainerEmail, trainerPassword)

    await expect(
      anamnesisRepository.create({
        studentId: studentAId,
        trainerId: otherTrainerId,
        templateId: 'parq',
        filledBy: 'trainer',
      }),
    ).rejects.toThrow()
  })

  it('personal de outro aluno não lê a anamnese do aluno A', async () => {
    const client = await signInAs(otherTrainerEmail, otherTrainerPassword)

    // SQL direto: RLS falha em silêncio (lista vazia, não erro).
    const { data, error } = await client.from('anamneses').select('*').eq('student_id', studentAId)
    expect(error).toBeNull()
    expect(data).toEqual([])

    await expect(anamnesisRepository.findById(pendingAId)).resolves.toBeNull()
    await expect(anamnesisRepository.findByStudentId(studentAId)).resolves.toEqual([])

    // Sanity check: sem isto, um RLS que bloqueia tudo passaria disfarçado de sucesso acima.
    const own = await anamnesisRepository.create({
      studentId: studentCId,
      trainerId: otherTrainerId,
      templateId: 'parq',
      filledBy: 'trainer',
    })
    expect(own.studentId).toBe(studentCId)
    await expect(anamnesisRepository.findByStudentId(studentCId)).resolves.toHaveLength(1)
  })

  it('aluno A lê só a própria pendente — nada do aluno B, nem o rascunho do personal', async () => {
    const client = await signInAs(studentAEmail, studentAPassword)

    const { data: rowsB, error: errorB } = await client
      .from('anamneses')
      .select('*')
      .eq('student_id', studentBId)
    expect(errorB).toBeNull()
    expect(rowsB).toEqual([])

    await expect(anamnesisRepository.findById(pendingBId)).resolves.toBeNull()
    await expect(anamnesisRepository.findById(draftAId)).resolves.toBeNull()

    const own = await anamnesisRepository.findByStudentId(studentAId)
    expect(own).toHaveLength(1)
    expect(own[0].id).toBe(pendingAId)
    expect(own[0].status).toBe('pending_student')
  })

  it('aluno A não responde a anamnese do aluno B', async () => {
    const client = await signInAs(studentAEmail, studentAPassword)

    // Update bloqueado pela RLS não dá erro: afeta zero linhas.
    const { data, error } = await client
      .from('anamneses')
      .update({ answers: { invadido: { choice: 'yes' } } })
      .eq('id', pendingBId)
      .select('*')
    expect(error).toBeNull()
    expect(data).toEqual([])

    const { data: rowB } = await admin
      .from('anamneses')
      .select('answers, status')
      .eq('id', pendingBId)
      .single()
    expect(rowB).toEqual({ answers: {}, status: 'pending_student' })
  })

  it('aluno A não troca template/autor da própria anamnese (trigger de guarda)', async () => {
    const client = await signInAs(studentAEmail, studentAPassword)

    const { error: templateError } = await client
      .from('anamneses')
      .update({ template_id: 'standard' })
      .eq('id', pendingAId)
    expect(templateError).not.toBeNull()

    const { error: trainerError } = await client
      .from('anamneses')
      .update({ trainer_id: studentAId })
      .eq('id', pendingAId)
    expect(trainerError).not.toBeNull()

    const { data: row } = await admin
      .from('anamneses')
      .select('template_id, trainer_id, filled_by')
      .eq('id', pendingAId)
      .single()
    expect(row).toEqual({ template_id: 'parq', trainer_id: trainerId, filled_by: 'student' })
  })

  it('aluno A responde e conclui a própria anamnese, e depois ela fica travada', async () => {
    await signInAs(studentAEmail, studentAPassword)

    const pending = await anamnesisRepository.findById(pendingAId)
    expect(pending).not.toBeNull()

    const saved = await anamnesisRepository.saveAnswers(pending!, {
      q1: { choice: 'no' },
      q2: { choice: 'yes', text: 'dor no ombro direito' },
    })
    expect(saved.answers.q2?.text).toBe('dor no ombro direito')

    const completed = await anamnesisRepository.complete(saved, saved.answers)
    expect(completed.status).toBe('completed')
    expect(completed.completedAt).toBeTruthy()

    // Concluída: o `using` da policy exige pending_student, então o aluno não altera mais nada.
    const { data: afterLock, error: lockError } = await getSupabase()
      .from('anamneses')
      .update({ answers: { q1: { choice: 'yes' } } })
      .eq('id', pendingAId)
      .select('*')
    expect(lockError).toBeNull()
    expect(afterLock).toEqual([])

    // E continua legível para o aluno (status completed entra no select dele).
    await expect(anamnesisRepository.findById(pendingAId)).resolves.toMatchObject({
      status: 'completed',
    })
  })
})
