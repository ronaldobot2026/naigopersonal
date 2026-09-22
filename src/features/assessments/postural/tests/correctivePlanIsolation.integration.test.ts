/// <reference types="node" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getSupabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import {
  CORRECTIVE_PRESCRIPTION_VERSION,
  type CorrectivePlan,
} from '../domain/correctivePrescription.types'
import { correctivePlanRepository } from '../repositories/correctivePlanRepository'

/**
 * Isolamento RLS de `corrective_plans`/`corrective_plan_items` (docs/CORRECTIVE_PRESCRIPTION.md,
 * seção 6) — mesmo padrão de `src/features/students/tests/studentDataIsolation.integration.test.ts`:
 * semeia um personal e dois alunos efêmeros com a service_role key (só setup/limpeza), e toda
 * leitura/escrita avaliada passa pela chave publicável e pelo repositório que a UI usa.
 *
 * Cobre: personal publica e lê planos dos dois alunos; personal não consegue gravar como autor
 * outra pessoa (`evaluator_id = auth.uid()` no `with check`); aluno A lê o próprio plano publicado
 * e não enxerga o plano (nem os itens) do aluno B, nem o próprio rascunho.
 *
 * Requer `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` além de `VITE_SUPABASE_URL`/
 * `VITE_SUPABASE_PUBLISHABLE_KEY`, e a migration `20260922120000_corrective_plans.sql` aplicada.
 * Sem as credenciais, pula. Para rodar localmente:
 *   supabase start
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role local> npm run test:run -- correctivePlanIsolation
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const hasCredentials = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && PUBLISHABLE_KEY)
if (!hasCredentials) {
  console.warn(
    'correctivePlanIsolation.integration.test.ts: pulado — faltam SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ' +
      '(além de VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY, já exigidas pelo app).',
  )
}

function buildPlan(studentId: string, assessmentId: string): CorrectivePlan {
  return {
    id: crypto.randomUUID(),
    studentId,
    assessmentId,
    findings: [
      {
        id: 'finding:front.shoulderInclination',
        kind: 'shoulder_elevation',
        side: 'right',
        sourceMetricId: 'front.shoulderInclination',
        view: 'front',
        measuredValue: 4.2,
        thresholdValue: 3,
        evidence: 'ombro direito ~4,2° acima da linha dos ombros',
        targetMuscles: ['traps'],
        rationale: 'justificativa',
      },
    ],
    items: [
      {
        id: 'finding:front.shoulderInclination:0001',
        exerciseId: '0001',
        exerciseName: 'Exercício 0001',
        findingId: 'finding:front.shoulderInclination',
        targetMuscles: ['traps'],
        sets: 3,
        reps: '12-15',
        origin: 'suggested',
        validation: 'pending',
      },
    ],
    status: 'draft',
    createdAt: new Date().toISOString(),
    prescriptionVersion: CORRECTIVE_PRESCRIPTION_VERSION,
  }
}

describe.skipIf(!hasCredentials)('isolamento do plano corretivo entre alunos (RLS)', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const trainerEmail = `corrective-trainer-${runId}@example.com`
  const studentAEmail = `corrective-student-a-${runId}@example.com`
  const studentBEmail = `corrective-student-b-${runId}@example.com`
  const trainerPassword = `Corretivo-T-${runId}`
  const studentAPassword = `Corretivo-A-${runId}`
  const studentBPassword = `Corretivo-B-${runId}`

  let admin: SupabaseClient<Database>
  let trainerId: string
  let studentAId: string
  let studentBId: string
  let assessmentAId: string
  let draftAssessmentAId: string
  let assessmentBId: string

  async function createUser(email: string, password: string, metadata: Record<string, string>) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error || !data.user) throw error ?? new Error(`Falha ao criar ${email}`)
    return data.user.id
  }

  async function createAssessment(studentId: string) {
    const { data, error } = await admin
      .from('physical_assessments')
      .insert({ student_id: studentId, evaluator_id: trainerId, status: 'completed' })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('Falha ao semear avaliação')
    return data.id
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

    trainerId = await createUser(trainerEmail, trainerPassword, {
      role: 'trainer',
      full_name: 'Personal (teste plano corretivo)',
    })
    studentAId = await createUser(studentAEmail, studentAPassword, {
      role: 'student',
      full_name: 'Aluno A (teste plano corretivo)',
      trainer_id: trainerId,
    })
    studentBId = await createUser(studentBEmail, studentBPassword, {
      role: 'student',
      full_name: 'Aluno B (teste plano corretivo)',
      trainer_id: trainerId,
    })

    assessmentAId = await createAssessment(studentAId)
    draftAssessmentAId = await createAssessment(studentAId)
    assessmentBId = await createAssessment(studentBId)
  })

  afterAll(async () => {
    await getSupabase().auth.signOut()
    await Promise.all(
      [studentAId, studentBId, trainerId].filter(Boolean).map((id) => admin.auth.admin.deleteUser(id)),
    )
  })

  it('personal publica e lê o plano dos dois alunos, sem duplicar ao republicar', async () => {
    await signInAs(trainerEmail, trainerPassword)

    await correctivePlanRepository.publish(buildPlan(studentAId, assessmentAId), trainerId)
    await correctivePlanRepository.publish(buildPlan(studentBId, assessmentBId), trainerId)
    await correctivePlanRepository.saveDraft(buildPlan(studentAId, draftAssessmentAId), trainerId)
    // Republicar a mesma avaliação reabre o plano existente em vez de criar outro.
    await correctivePlanRepository.publish(buildPlan(studentBId, assessmentBId), trainerId)

    const planA = await correctivePlanRepository.findByAssessmentId(assessmentAId)
    const planB = await correctivePlanRepository.findByAssessmentId(assessmentBId)
    expect(planA?.status).toBe('published')
    expect(planA?.items).toHaveLength(1)
    expect(planB?.status).toBe('published')
    expect(planB?.items).toHaveLength(1)
    await expect(correctivePlanRepository.findByStudentId(studentBId)).resolves.toHaveLength(1)
    await expect(correctivePlanRepository.findByStudentId(studentAId)).resolves.toHaveLength(2)
  })

  it('personal não grava plano em nome de outro autor (evaluator_id forjado)', async () => {
    await signInAs(trainerEmail, trainerPassword)

    const forgedAssessmentId = await createAssessment(studentAId)
    await expect(
      correctivePlanRepository.publish(buildPlan(studentAId, forgedAssessmentId), studentBId),
    ).rejects.toThrow()
  })

  it('aluno A lê só o próprio plano publicado — nada do aluno B, nem o próprio rascunho', async () => {
    const client = await signInAs(studentAEmail, studentAPassword)

    // SQL direto: RLS falha em silêncio (lista vazia, não erro).
    const { data: planRowsB, error: plansError } = await client
      .from('corrective_plans')
      .select('*')
      .eq('student_id', studentBId)
    expect(plansError).toBeNull()
    expect(planRowsB).toEqual([])

    const planIdB = (await admin.from('corrective_plans').select('id').eq('assessment_id', assessmentBId).single())
      .data!.id
    const { data: itemRowsB, error: itemsError } = await client
      .from('corrective_plan_items')
      .select('*')
      .eq('plan_id', planIdB)
    expect(itemsError).toBeNull()
    expect(itemRowsB).toEqual([])

    // Mesmo caminho que a UI vai usar.
    await expect(correctivePlanRepository.findByAssessmentId(assessmentBId)).resolves.toBeNull()
    await expect(correctivePlanRepository.findByStudentId(studentBId)).resolves.toEqual([])
    await expect(correctivePlanRepository.findByAssessmentId(draftAssessmentAId)).resolves.toBeNull()

    // Sanity check: sem isto, um RLS que bloqueia tudo passaria disfarçado de sucesso acima.
    const ownPlans = await correctivePlanRepository.findByStudentId(studentAId)
    expect(ownPlans).toHaveLength(1)
    expect(ownPlans[0].assessmentId).toBe(assessmentAId)
    expect(ownPlans[0].items).toHaveLength(1)
  })

  it('aluno não escreve plano, nem o próprio', async () => {
    await signInAs(studentAEmail, studentAPassword)

    await expect(
      correctivePlanRepository.publish(buildPlan(studentAId, assessmentAId), studentAId),
    ).rejects.toThrow()

    // E o plano publicado pelo personal continua intacto.
    const { data } = await admin
      .from('corrective_plans')
      .select('evaluator_id, status')
      .eq('assessment_id', assessmentAId)
      .single()
    expect(data).toEqual({ evaluator_id: trainerId, status: 'published' })
  })
})
