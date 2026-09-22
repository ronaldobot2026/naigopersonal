import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabase } from '@/lib/supabase/client'
import type { CorrectivePlan } from '../domain/correctivePrescription.types'

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: vi.fn(),
}))

const mockGetSupabase = vi.mocked(getSupabase)

/** Linha crua como o Supabase devolveria para uma chamada específica. */
type ChainResult = { data: unknown; error: unknown }

/**
 * Réplica mínima do builder encadeável do supabase-js: cada método de filtro (`select`, `eq`,
 * `in`, `delete`) devolve o próprio objeto para permitir encadear, e o objeto também é "thenable"
 * (implementa `.then`) para resolver quando aguardado diretamente — exatamente como
 * `await supabase.from(t).delete().eq(...)` funciona na lib real, sem precisar de um terminal
 * explícito. `maybeSingle`/`upsert`/`insert` resolvem a mesma `result` porque, nos testes aqui,
 * cada `.from(tabela)` corresponde a exatamente uma operação da fila.
 */
function createChain(result: ChainResult) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'delete']) {
    chain[method] = vi.fn(() => chain)
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  chain.upsert = vi.fn(() => Promise.resolve(result))
  chain.insert = vi.fn(() => Promise.resolve(result))
  chain.then = (onFulfilled: (value: ChainResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return chain
}

/** Cada tabela tem uma fila FIFO de respostas — uma por chamada a `.from(tabela)`, na ordem em que o repositório as faz. */
function createSupabaseMock(queues: Record<string, ChainResult[]>) {
  const chains: Record<string, ReturnType<typeof createChain>[]> = {}
  const from = vi.fn((table: string) => {
    const queue = queues[table]
    if (!queue || queue.length === 0) {
      throw new Error(`correctivePlanRepository.test: sem resposta mockada para a tabela "${table}"`)
    }
    const chain = createChain(queue.shift()!)
    chains[table] = chains[table] ?? []
    chains[table].push(chain)
    return chain
  })
  return { from, chains }
}

const PLAN: CorrectivePlan = {
  id: 'plan-1',
  studentId: 'student-1',
  assessmentId: 'assessment-1',
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
      targetMuscles: ['traps', 'levator scapulae', 'delts'],
      rationale: 'Ombro elevado: fortalecer trapézio/deltoides com puxadas.',
    },
  ],
  items: [
    {
      id: 'finding:front.shoulderInclination:0001',
      exerciseId: '0001',
      exerciseName: 'Remada alta',
      findingId: 'finding:front.shoulderInclination',
      targetMuscles: ['traps', 'levator scapulae', 'delts'],
      sets: 3,
      reps: '12-15',
      origin: 'suggested',
      validation: 'pending',
    },
  ],
  status: 'draft',
  createdAt: '2026-09-22T12:00:00.000Z',
  prescriptionVersion: '2026.1',
}

describe('correctivePlanRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findByAssessmentId', () => {
    it('devolve null quando não há plano para a avaliação', async () => {
      const supabase = createSupabaseMock({ corrective_plans: [{ data: null, error: null }] })
      mockGetSupabase.mockReturnValue(supabase as never)

      const { correctivePlanRepository } = await import('../repositories/correctivePlanRepository')
      await expect(correctivePlanRepository.findByAssessmentId('assessment-1')).resolves.toBeNull()
    })

    it('devolve o plano com os itens quando existe', async () => {
      const planRow = {
        id: 'plan-1',
        student_id: 'student-1',
        assessment_id: 'assessment-1',
        evaluator_id: 'trainer-1',
        status: 'published',
        prescription_version: '2026.1',
        findings: PLAN.findings,
        created_at: '2026-09-22T12:00:00.000Z',
        published_at: '2026-09-22T12:05:00.000Z',
      }
      const itemRow = {
        id: 'finding:front.shoulderInclination:0001',
        plan_id: 'plan-1',
        exercise_id: '0001',
        exercise_name: 'Remada alta',
        finding_id: 'finding:front.shoulderInclination',
        target_muscles: ['traps', 'levator scapulae', 'delts'],
        sets: 3,
        reps: '12-15',
        origin: 'suggested',
        validation: 'pending',
        trainer_note: null,
      }

      const supabase = createSupabaseMock({
        corrective_plans: [{ data: planRow, error: null }],
        corrective_plan_items: [{ data: [itemRow], error: null }],
      })
      mockGetSupabase.mockReturnValue(supabase as never)

      const { correctivePlanRepository } = await import('../repositories/correctivePlanRepository')
      const plan = await correctivePlanRepository.findByAssessmentId('assessment-1')

      expect(plan).not.toBeNull()
      expect(plan).toMatchObject({
        id: 'plan-1',
        studentId: 'student-1',
        assessmentId: 'assessment-1',
        status: 'published',
        prescriptionVersion: '2026.1',
        publishedAt: '2026-09-22T12:05:00.000Z',
      })
      expect(plan!.items).toEqual([
        {
          id: 'finding:front.shoulderInclination:0001',
          exerciseId: '0001',
          exerciseName: 'Remada alta',
          findingId: 'finding:front.shoulderInclination',
          targetMuscles: ['traps', 'levator scapulae', 'delts'],
          sets: 3,
          reps: '12-15',
          origin: 'suggested',
          validation: 'pending',
          trainerNote: undefined,
        },
      ])
    })
  })

  describe('findByStudentId', () => {
    it('devolve lista vazia quando o aluno não tem plano', async () => {
      const supabase = createSupabaseMock({ corrective_plans: [{ data: [], error: null }] })
      mockGetSupabase.mockReturnValue(supabase as never)

      const { correctivePlanRepository } = await import('../repositories/correctivePlanRepository')
      await expect(correctivePlanRepository.findByStudentId('student-1')).resolves.toEqual([])
    })

    it('agrupa os itens por plano', async () => {
      const planRows = [
        {
          id: 'plan-1',
          student_id: 'student-1',
          assessment_id: 'assessment-1',
          evaluator_id: 'trainer-1',
          status: 'published',
          prescription_version: '2026.1',
          findings: [],
          created_at: '2026-09-22T12:00:00.000Z',
          published_at: '2026-09-22T12:05:00.000Z',
        },
      ]
      const itemRows = [
        {
          id: 'item-1',
          plan_id: 'plan-1',
          exercise_id: '0001',
          exercise_name: 'Remada alta',
          finding_id: 'finding:front.shoulderInclination',
          target_muscles: ['traps'],
          sets: 3,
          reps: '12-15',
          origin: 'suggested',
          validation: 'pending',
          trainer_note: null,
        },
      ]

      const supabase = createSupabaseMock({
        corrective_plans: [{ data: planRows, error: null }],
        corrective_plan_items: [{ data: itemRows, error: null }],
      })
      mockGetSupabase.mockReturnValue(supabase as never)

      const { correctivePlanRepository } = await import('../repositories/correctivePlanRepository')
      const plans = await correctivePlanRepository.findByStudentId('student-1')

      expect(plans).toHaveLength(1)
      expect(plans[0].items).toHaveLength(1)
      expect(plans[0].items[0].exerciseId).toBe('0001')
    })
  })

  describe('publish', () => {
    it('cria um novo plano publicado quando não existe um para a avaliação', async () => {
      const supabase = createSupabaseMock({
        corrective_plans: [
          { data: null, error: null }, // busca por plano existente (assessment_id)
          { data: null, error: null }, // upsert
        ],
        corrective_plan_items: [
          { data: null, error: null }, // delete (limpa itens antes de reinserir)
          { data: null, error: null }, // insert
        ],
      })
      mockGetSupabase.mockReturnValue(supabase as never)

      const { correctivePlanRepository } = await import('../repositories/correctivePlanRepository')
      const result = await correctivePlanRepository.publish(PLAN, 'trainer-1')

      expect(result.id).toBe('plan-1')
      expect(result.status).toBe('published')
      expect(result.publishedAt).toBeTruthy()

      const plansChain = supabase.chains.corrective_plans[1]
      expect(plansChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'plan-1',
          student_id: 'student-1',
          assessment_id: 'assessment-1',
          evaluator_id: 'trainer-1',
          status: 'published',
          prescription_version: '2026.1',
        }),
      )

      const itemsInsertChain = supabase.chains.corrective_plan_items[1]
      expect(itemsInsertChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          plan_id: 'plan-1',
          exercise_id: '0001',
          exercise_name: 'Remada alta',
          finding_id: 'finding:front.shoulderInclination',
          target_muscles: ['traps', 'levator scapulae', 'delts'],
          sets: 3,
          reps: '12-15',
          origin: 'suggested',
          validation: 'pending',
          trainer_note: null,
        }),
      ])
      // `corrective_plan_items.id` é uuid gerado pelo banco; o id de domínio do item
      // (`${findingId}:${exerciseId}`) não é uuid e faria o insert falhar no Postgres.
      const [insertedItems] = (itemsInsertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0] as [
        Record<string, unknown>[],
      ]
      expect(insertedItems[0]).not.toHaveProperty('id')
    })

    it('reabre/substitui o plano existente da avaliação em vez de duplicar (idempotente)', async () => {
      const supabase = createSupabaseMock({
        corrective_plans: [
          { data: { id: 'existing-plan-id', published_at: '2026-09-20T00:00:00.000Z' }, error: null },
          { data: null, error: null },
        ],
        corrective_plan_items: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      })
      mockGetSupabase.mockReturnValue(supabase as never)

      const { correctivePlanRepository } = await import('../repositories/correctivePlanRepository')
      const result = await correctivePlanRepository.publish(PLAN, 'trainer-1')

      // reusa o id do plano já existente para a avaliação — nunca cria uma segunda linha.
      expect(result.id).toBe('existing-plan-id')
      expect(result.publishedAt).toBe('2026-09-20T00:00:00.000Z')

      const plansChain = supabase.chains.corrective_plans[1]
      expect(plansChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'existing-plan-id' }),
      )

      const itemsDeleteChain = supabase.chains.corrective_plan_items[0]
      expect(itemsDeleteChain.delete).toHaveBeenCalled()
      expect(itemsDeleteChain.eq).toHaveBeenCalledWith('plan_id', 'existing-plan-id')
    })
  })

  describe('saveDraft', () => {
    it('grava como rascunho, sem published_at', async () => {
      const supabase = createSupabaseMock({
        corrective_plans: [
          { data: null, error: null },
          { data: null, error: null },
        ],
        corrective_plan_items: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      })
      mockGetSupabase.mockReturnValue(supabase as never)

      const { correctivePlanRepository } = await import('../repositories/correctivePlanRepository')
      const result = await correctivePlanRepository.saveDraft(PLAN, 'trainer-1')

      expect(result.status).toBe('draft')
      expect(result.publishedAt).toBeUndefined()

      const plansChain = supabase.chains.corrective_plans[1]
      expect(plansChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft', published_at: null }),
      )
    })
  })
})
