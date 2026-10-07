/// <reference types="node" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getSupabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { groupHistorySessions } from '../domain/workoutHistory'
import { workoutLogRepository } from '../repositories/workoutLogRepository'

/**
 * Isolamento RLS da EXECUÇÃO do treino (`workout_logs` + `set_logs`,
 * migration `20261007130000_workout_execution_logs.sql`) — mesmo padrão de
 * `correctivePlanIsolation.integration.test.ts`: semeia dois personais e dois alunos efêmeros com a
 * service_role key (só setup/limpeza), e toda leitura/escrita avaliada passa pela chave publicável,
 * autenticada como o usuário que a UI teria logado.
 *
 * Cobre:
 * - aluno registra e lê o PRÓPRIO treino (sessão + séries);
 * - aluno A não LÊ e não ESCREVE log do aluno B (nem sessão, nem série, nem série pendurada na
 *   sessão do outro);
 * - personal do aluno LÊ os logs dele, mas não ESCREVE (acompanhar é leitura);
 * - personal de outro aluno não lê nada;
 * - o log sobrevive à ficha: apagar `workout_plans` zera `workout_plan_id` e mantém a sessão.
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
    'workoutLogIsolation.integration.test.ts: pulado — faltam SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ' +
      '(além de VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY, já exigidas pelo app).',
  )
}

describe.skipIf(!hasCredentials)('execução do treino: isolamento de workout_logs/set_logs', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  // Todo dado de teste nasce @naigo.demo e morre no afterAll — nunca @example.com, que já deixou
  // usuário órfão no banco de produção.
  const trainerEmail = `log-trainer-${runId}@naigo.demo`
  const otherTrainerEmail = `log-trainer-outro-${runId}@naigo.demo`
  const studentAEmail = `log-student-a-${runId}@naigo.demo`
  const studentBEmail = `log-student-b-${runId}@naigo.demo`
  const password = `Execucao-${runId}`

  let admin: SupabaseClient<Database>
  let trainerId: string
  let otherTrainerId: string
  let studentAId: string
  let studentBId: string
  let logAId: string
  let logBId: string

  async function createUser(email: string, fullName: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error || !data.user) throw error ?? new Error(`Falha ao criar ${email}`)
    return data.user.id
  }

  async function signInAs(email: string) {
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

    trainerId = await createUser(trainerEmail, 'Personal (teste execução)')
    otherTrainerId = await createUser(otherTrainerEmail, 'Personal alheio (teste execução)')
    studentAId = await createUser(studentAEmail, 'Aluno A (teste execução)')
    studentBId = await createUser(studentBEmail, 'Aluno B (teste execução)')

    // handle_new_user cria todo mundo como 'student' sem vínculo (hardening de 2026-09-21).
    const { error: roleError } = await admin
      .from('profiles')
      .update({ role: 'trainer' })
      .in('id', [trainerId, otherTrainerId])
    if (roleError) throw roleError
    const { error: linkError } = await admin.from('students').insert([
      { id: studentAId, trainer_id: trainerId },
      { id: studentBId, trainer_id: trainerId },
    ])
    if (linkError) throw linkError

    // Sessão do aluno B semeada pelo service_role: existe no banco para provar que A e o personal
    // alheio não a enxergam, sem depender de nenhuma escrita avaliada no teste.
    const { data: logB, error: logBError } = await admin
      .from('workout_logs')
      .insert({ student_id: studentBId, division_key: 'B' })
      .select('id')
      .single()
    if (logBError || !logB) throw logBError ?? new Error('Falha ao semear sessão do aluno B')
    logBId = logB.id
    const { error: setBError } = await admin.from('set_logs').insert({
      workout_log_id: logBId,
      student_id: studentBId,
      exercise_id: '0043',
      exercise_name: 'Agachamento livre',
      set_index: 1,
      reps: 10,
      weight_kg: 80,
      done: true,
      completed_at: new Date().toISOString(),
    })
    if (setBError) throw setBError
  })

  afterAll(async () => {
    await getSupabase().auth.signOut()
    // Alunos antes dos personais: o cascade dos alunos leva as linhas que referenciam o personal;
    // apagando em paralelo, o personal ainda era referenciado e sobrava no banco.
    await Promise.all(
      [studentAId, studentBId].filter(Boolean).map((id) => admin.auth.admin.deleteUser(id)),
    )
    for (const id of [trainerId, otherTrainerId].filter(Boolean)) {
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) throw error
    }
  })

  it('aluno registra e lê a própria sessão e as próprias séries', async () => {
    const client = await signInAs(studentAEmail)

    const { data: log, error: logError } = await client
      .from('workout_logs')
      .insert({ student_id: studentAId, division_key: 'A', notes: 'pesado hoje' })
      .select('id, completed_at')
      .single()
    expect(logError).toBeNull()
    expect(log?.completed_at).toBeNull() // sessão em andamento
    logAId = log!.id

    const { error: setError } = await client.from('set_logs').insert({
      workout_log_id: logAId,
      student_id: studentAId,
      exercise_id: '0025',
      exercise_name: 'Supino reto com barra',
      set_index: 1,
      reps: 8,
      weight_kg: 60,
      rpe: 8,
      done: true,
      completed_at: new Date().toISOString(),
    })
    expect(setError).toBeNull()

    const { error: finishError } = await client
      .from('workout_logs')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', logAId)
    expect(finishError).toBeNull()

    const { data: mine } = await client
      .from('set_logs')
      .select('exercise_id, exercise_name, weight_kg, reps, rpe')
      .eq('student_id', studentAId)
      .eq('exercise_id', '0025')
      .order('completed_at', { ascending: false })
    expect(mine).toEqual([
      {
        exercise_id: '0025',
        exercise_name: 'Supino reto com barra',
        weight_kg: 60,
        reps: 8,
        rpe: 8,
      },
    ])
  })

  it('aluno A não enxerga sessão nem série do aluno B', async () => {
    const client = await signInAs(studentAEmail)

    const { data: logs, error: logsError } = await client.from('workout_logs').select('id')
    expect(logsError).toBeNull()
    expect(logs?.map((row) => row.id)).toEqual([logAId])

    const { data: sets } = await client.from('set_logs').select('id').eq('student_id', studentBId)
    expect(sets).toEqual([])
  })

  it('aluno A não escreve log em nome do aluno B', async () => {
    const client = await signInAs(studentAEmail)

    const { error: forgedLog } = await client
      .from('workout_logs')
      .insert({ student_id: studentBId, division_key: 'A' })
    expect(forgedLog).not.toBeNull()

    // Nem série em nome do outro, nem série própria pendurada na sessão do outro (a FK composta
    // (workout_log_id, student_id) fecha esse caminho mesmo se a RLS deixasse passar).
    const { error: forgedSet } = await client.from('set_logs').insert({
      workout_log_id: logBId,
      student_id: studentBId,
      exercise_id: '0025',
      exercise_name: 'Supino forjado',
      set_index: 2,
    })
    expect(forgedSet).not.toBeNull()

    const { error: hijackedSet } = await client.from('set_logs').insert({
      workout_log_id: logBId,
      student_id: studentAId,
      exercise_id: '0025',
      exercise_name: 'Supino sequestrado',
      set_index: 3,
    })
    expect(hijackedSet).not.toBeNull()

    // E não apaga nem edita o que é do outro.
    const { count } = await admin
      .from('set_logs')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentBId)
    await client.from('set_logs').delete().eq('student_id', studentBId)
    const { count: afterCount } = await admin
      .from('set_logs')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentBId)
    expect(afterCount).toBe(count)
  })

  it('personal lê a execução dos próprios alunos, mas não escreve', async () => {
    const client = await signInAs(trainerEmail)

    const { data: logs, error } = await client.from('workout_logs').select('id, student_id')
    expect(error).toBeNull()
    expect(logs?.map((row) => row.id).sort()).toEqual([logAId, logBId].sort())

    const { data: sets } = await client.from('set_logs').select('exercise_name, weight_kg')
    expect(sets).toHaveLength(2)

    const { error: writeError } = await client
      .from('workout_logs')
      .insert({ student_id: studentAId, division_key: 'C' })
    expect(writeError).not.toBeNull()

    const { error: setWriteError } = await client.from('set_logs').insert({
      workout_log_id: logAId,
      student_id: studentAId,
      exercise_id: '0025',
      exercise_name: 'Série inventada pelo personal',
      set_index: 9,
    })
    expect(setWriteError).not.toBeNull()
  })

  it('personal de outro aluno não lê execução alheia', async () => {
    const client = await signInAs(otherTrainerEmail)

    const { data: logs, error } = await client.from('workout_logs').select('id')
    expect(error).toBeNull()
    expect(logs).toEqual([])

    const { data: sets } = await client.from('set_logs').select('id')
    expect(sets).toEqual([])
  })

  it('o log sobrevive à ficha: apagar workout_plans zera o vínculo e mantém a sessão', async () => {
    const { data: plan, error: planError } = await admin
      .from('workout_plans')
      .insert({
        student_id: studentAId,
        trainer_id: trainerId,
        status: 'published',
        objective: 'ficha que vai morrer',
        divisions: [],
      })
      .select('id')
      .single()
    if (planError || !plan) throw planError ?? new Error('Falha ao semear ficha')

    const { error: linkError } = await admin
      .from('workout_logs')
      .update({ workout_plan_id: plan.id })
      .eq('id', logAId)
    expect(linkError).toBeNull()

    const { error: deleteError } = await admin.from('workout_plans').delete().eq('id', plan.id)
    expect(deleteError).toBeNull()

    const { data: survivor } = await admin
      .from('workout_logs')
      .select('id, workout_plan_id, division_key')
      .eq('id', logAId)
      .single()
    expect(survivor).toEqual({ id: logAId, workout_plan_id: null, division_key: 'A' })
  })

  /**
   * O teste real da denormalização da F10-1, agora pela porta que a TELA usa (o repositório, e não
   * SQL cru): o histórico de carga tem de continuar lá depois de a ficha ser apagada.
   */
  it('histórico de carga sobrevive à ficha apagada (lido pelo repositório, como a tela lê)', async () => {
    const exerciseId = '0047'
    const seedWeights = [
      { weight: 30, reps: 10, when: '2026-09-23T12:00:00.000Z' },
      { weight: 32.5, reps: 9, when: '2026-09-30T12:00:00.000Z' },
    ]

    // Ficha publicada + duas sessões concluídas penduradas nela, tudo via service_role (setup).
    const { data: plan, error: planError } = await admin
      .from('workout_plans')
      .insert({
        student_id: studentAId,
        trainer_id: trainerId,
        status: 'published',
        objective: 'ficha do histórico',
        divisions: [],
      })
      .select('id')
      .single()
    if (planError || !plan) throw planError ?? new Error('Falha ao semear ficha do histórico')

    for (const seed of seedWeights) {
      const { data: log, error: logError } = await admin
        .from('workout_logs')
        .insert({
          student_id: studentAId,
          workout_plan_id: plan.id,
          division_key: 'A',
          started_at: seed.when,
          completed_at: seed.when,
        })
        .select('id')
        .single()
      if (logError || !log) throw logError ?? new Error('Falha ao semear sessão do histórico')

      const { error: setError } = await admin.from('set_logs').insert({
        workout_log_id: log.id,
        student_id: studentAId,
        exercise_id: exerciseId,
        exercise_name: 'Remada curvada',
        set_index: 1,
        reps: seed.reps,
        weight_kg: seed.weight,
        done: true,
        completed_at: seed.when,
      })
      if (setError) throw setError
    }

    await signInAs(studentAEmail)

    const antes = await workoutLogRepository.listExerciseSets(studentAId, exerciseId)
    const ultimaAntes = await workoutLogRepository.lastWeightFor(studentAId, exerciseId)
    expect(antes).toHaveLength(2)
    expect(ultimaAntes).toMatchObject({ weightKg: 32.5, reps: 9 })

    // A ficha morre — editada e republicada, ou simplesmente apagada pelo personal.
    const { error: deleteError } = await admin.from('workout_plans').delete().eq('id', plan.id)
    expect(deleteError).toBeNull()

    const depois = await workoutLogRepository.listExerciseSets(studentAId, exerciseId)
    const ultimaDepois = await workoutLogRepository.lastWeightFor(studentAId, exerciseId)

    expect(depois).toHaveLength(2)
    expect(ultimaDepois).toEqual(ultimaAntes)
    // Nome e carga continuam legíveis porque moram na própria série, não na ficha nem no catálogo.
    expect(depois.map((set) => [set.exerciseName, set.weightKg, set.reps])).toEqual([
      ['Remada curvada', 32.5, 9],
      ['Remada curvada', 30, 10],
    ])

    const sessoes = groupHistorySessions(depois)
    expect(sessoes).toHaveLength(2)
    expect(sessoes[0]).toMatchObject({ topWeightKg: 32.5, totalReps: 9 })

    // E o vínculo com a ficha foi zerado, não cascateado junto com as séries.
    const { data: logs } = await admin
      .from('workout_logs')
      .select('workout_plan_id')
      .eq('student_id', studentAId)
      .eq('division_key', 'A')
    expect(logs?.every((row) => row.workout_plan_id === null)).toBe(true)
  })

  it('regravar a mesma série atualiza a linha em vez de duplicar', async () => {
    const client = await signInAs(studentAEmail)
    const row = {
      workout_log_id: logAId,
      student_id: studentAId,
      exercise_id: '0025',
      exercise_name: 'Supino reto com barra',
      set_index: 1,
    }

    // O executor grava a cada toque do aluno; o alvo é o índice único
    // (workout_log_id, exercise_id, set_index) da migration 20261007131000.
    const { error: firstError } = await client
      .from('set_logs')
      .upsert(
        { ...row, reps: 8, weight_kg: 60 },
        { onConflict: 'workout_log_id,exercise_id,set_index' },
      )
    expect(firstError).toBeNull()
    const { error: secondError } = await client
      .from('set_logs')
      .upsert(
        { ...row, reps: 7, weight_kg: 62.5, done: true },
        { onConflict: 'workout_log_id,exercise_id,set_index' },
      )
    expect(secondError).toBeNull()

    const { data: sets } = await client
      .from('set_logs')
      .select('reps, weight_kg, done')
      .eq('workout_log_id', logAId)
      .eq('exercise_id', '0025')
    expect(sets).toEqual([{ reps: 7, weight_kg: 62.5, done: true }])
  })
})
