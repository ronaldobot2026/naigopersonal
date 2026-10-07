/// <reference types="node" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getSupabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { createWorkoutPlan } from '../domain/createWorkoutPlan'
import type { WorkoutPlan } from '../domain/workout.types'
import { workoutPlanRepository } from '../repositories/workoutPlanRepository'
import { workoutRepository } from '../repositories/workoutRepository'

/**
 * Isolamento RLS de `workout_plans` e o espelho personal → aluno — mesmo padrão de
 * `correctivePlanIsolation.integration.test.ts`: semeia um personal e dois alunos efêmeros com a
 * service_role key (só setup/limpeza); toda leitura/escrita avaliada passa pela chave publicável e
 * pelos repositórios que a UI usa.
 *
 * Cobre: aluno não vê rascunho; vê a ficha depois de publicada, exatamente como foi montada; edição
 * posterior não vaza até republicar; aluno A não vê a ficha do aluno B; personal não grava em nome
 * de outro autor; aluno não grava ficha.
 *
 * Requer `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` além de `VITE_SUPABASE_URL`/
 * `VITE_SUPABASE_PUBLISHABLE_KEY`, e a migration `20261007120000_workout_plans.sql` aplicada.
 * Sem as credenciais, pula. Para rodar:
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role> npm run test:run -- workoutPlanIsolation
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const hasCredentials = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && PUBLISHABLE_KEY)
if (!hasCredentials) {
  console.warn(
    'workoutPlanIsolation.integration.test.ts: pulado — faltam SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ' +
      '(além de VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY, já exigidas pelo app).',
  )
}

function buildPlan(studentId: string, objective: string): WorkoutPlan {
  return {
    ...createWorkoutPlan(studentId, 'Aluno'),
    objective,
    weeklyFrequency: 3,
    divisions: [
      {
        id: 'A',
        label: 'Superior',
        entries: [
          { exerciseId: '0025', sets: 4, reps: '8-10', loadKg: 40, rir: 2, restSeconds: 90 },
        ],
      },
      { id: 'B', label: 'Inferior', entries: [{ exerciseId: '0043', sets: 3, reps: '10' }] },
    ],
  }
}

describe.skipIf(!hasCredentials)('ficha de treino: espelho personal → aluno (RLS)', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const trainerEmail = `workout-trainer-${runId}@example.com`
  const studentAEmail = `workout-student-a-${runId}@example.com`
  const studentBEmail = `workout-student-b-${runId}@example.com`
  const trainerPassword = `Treino-T-${runId}`
  const studentAPassword = `Treino-A-${runId}`
  const studentBPassword = `Treino-B-${runId}`

  let admin: SupabaseClient<Database>
  let trainerId: string
  let studentAId: string
  let studentBId: string

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

    trainerId = await createUser(trainerEmail, trainerPassword, 'Personal (teste ficha)')
    studentAId = await createUser(studentAEmail, studentAPassword, 'Aluno A (teste ficha)')
    studentBId = await createUser(studentBEmail, studentBPassword, 'Aluno B (teste ficha)')

    // handle_new_user cria todo mundo como 'student' sem vínculo (hardening de 2026-09-21); o
    // papel de trainer e o vínculo aluno↔personal são do fluxo de convite — aqui, via service_role.
    const { error: roleError } = await admin
      .from('profiles')
      .update({ role: 'trainer' })
      .eq('id', trainerId)
    if (roleError) throw roleError
    const { error: linkError } = await admin.from('students').insert([
      { id: studentAId, trainer_id: trainerId },
      { id: studentBId, trainer_id: trainerId },
    ])
    if (linkError) throw linkError
  })

  afterAll(async () => {
    await getSupabase().auth.signOut()
    // Alunos antes do personal: o cascade dos alunos leva as linhas de que o personal é autor
    // (avaliações, planos, fichas); apagando tudo em paralelo, o personal ainda era referenciado
    // e sobrava no banco.
    await Promise.all(
      [studentAId, studentBId].filter(Boolean).map((id) => admin.auth.admin.deleteUser(id)),
    )
    if (trainerId) {
      const { error } = await admin.auth.admin.deleteUser(trainerId)
      if (error) throw error
    }
  })

  it('aluno não vê a ficha enquanto ela é só rascunho', async () => {
    await signInAs(trainerEmail, trainerPassword)
    await workoutPlanRepository.saveDraft(buildPlan(studentAId, 'rascunho'), trainerId)

    await signInAs(studentAEmail, studentAPassword)
    await expect(workoutRepository.findProgram(studentAId)).resolves.toBeNull()
  })

  it('depois de publicar, o aluno vê a ficha exatamente como o personal montou', async () => {
    await signInAs(trainerEmail, trainerPassword)
    const montada = buildPlan(studentAId, 'hipertrofia')
    await workoutPlanRepository.publish(montada, trainerId)
    // Republicar não duplica: continua uma linha draft + uma published.
    await workoutPlanRepository.publish(montada, trainerId)
    const { count } = await admin
      .from('workout_plans')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentAId)
    expect(count).toBe(2)

    await signInAs(studentAEmail, studentAPassword)
    const program = await workoutRepository.findProgram(studentAId)
    expect(program?.plan.objective).toBe('hipertrofia')
    expect(program?.plan.divisions).toEqual(montada.divisions)
    expect(program?.sessions.map((session) => session.id)).toEqual(['A', 'B'])
    expect(program?.sessions[0].exercises[0]).toEqual(montada.divisions[0].entries[0])
  })

  it('edição salva depois de publicar não chega ao aluno até republicar', async () => {
    await signInAs(trainerEmail, trainerPassword)
    await workoutPlanRepository.saveDraft(
      buildPlan(studentAId, 'emagrecimento (em edição)'),
      trainerId,
    )

    await signInAs(studentAEmail, studentAPassword)
    expect((await workoutRepository.findProgram(studentAId))?.plan.objective).toBe('hipertrofia')

    await signInAs(trainerEmail, trainerPassword)
    const { draft, published } = await workoutPlanRepository.findForTrainer(studentAId, 'Aluno A')
    expect(draft?.objective).toBe('emagrecimento (em edição)')
    expect(published?.objective).toBe('hipertrofia')
  })

  it('aluno A não enxerga a ficha do aluno B', async () => {
    await signInAs(trainerEmail, trainerPassword)
    await workoutPlanRepository.publish(buildPlan(studentBId, 'ficha do B'), trainerId)

    const client = await signInAs(studentAEmail, studentAPassword)
    const { data, error } = await client
      .from('workout_plans')
      .select('*')
      .eq('student_id', studentBId)
    expect(error).toBeNull()
    expect(data).toEqual([])
    await expect(workoutRepository.findProgram(studentBId)).resolves.toBeNull()
  })

  it('personal não grava ficha em nome de outro autor', async () => {
    await signInAs(trainerEmail, trainerPassword)
    await expect(
      workoutPlanRepository.saveDraft(buildPlan(studentBId, 'forjada'), studentAId),
    ).rejects.toThrow()
  })

  it('aluno não consegue gravar a própria ficha', async () => {
    await signInAs(studentAEmail, studentAPassword)
    await expect(
      workoutPlanRepository.publish(buildPlan(studentAId, 'eu mesmo'), studentAId),
    ).rejects.toThrow()
  })
})
