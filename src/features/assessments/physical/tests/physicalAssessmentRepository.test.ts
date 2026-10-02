import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PhysicalAssessment } from '@/types/domain'

/**
 * Regressão: `saveDraft` rebaixava para 'draft' qualquer avaliação salva, inclusive as já
 * concluídas. Como o wizard faz auto-save a cada alteração de campo e a mesma tela serve para
 * reabrir uma avaliação do histórico, tocar em um campo de avaliação concluída a virava rascunho —
 * e a RLS do aluno (só lê status='completed') fazia o relatório dele desaparecer.
 */

/** Captura o payload enviado ao Supabase para conferir o `status` gravado. */
const upsertPhysicalAssessments = vi.fn(async (_payload: { status: string }) => ({ error: null }))
const upsertBodyMetrics = vi.fn(async (_payload: unknown) => ({ error: null }))

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      if (table === 'physical_assessments') {
        return { upsert: (payload: unknown) => upsertPhysicalAssessments(payload as { status: string }) }
      }
      if (table === 'body_metrics') {
        return { upsert: (payload: unknown) => upsertBodyMetrics(payload) }
      }
      throw new Error(`Tabela inesperada no teste: ${table}`)
    },
  }),
}))

import { physicalAssessmentRepository } from '../repositories/physicalAssessmentRepository'

function avaliacao(status: PhysicalAssessment['status']): PhysicalAssessment {
  return {
    id: 'avaliacao-1',
    studentId: 'aluno-1',
    evaluatorId: 'personal-1',
    createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    status,
    biometrics: {} as PhysicalAssessment['biometrics'],
    anthropometry: {} as PhysicalAssessment['anthropometry'],
    visualRecords: [],
  }
}

/** Lê o `status` do último upsert feito em `physical_assessments`. */
function statusGravado(): string {
  const ultimaChamada = upsertPhysicalAssessments.mock.calls.at(-1)
  if (!ultimaChamada) throw new Error('Nenhum upsert em physical_assessments foi feito.')
  return ultimaChamada[0].status
}

describe('physicalAssessmentRepository.saveDraft', () => {
  beforeEach(() => {
    upsertPhysicalAssessments.mockClear()
    upsertBodyMetrics.mockClear()
  })

  it('não rebaixa uma avaliação concluída ao salvar (auto-save do wizard)', async () => {
    const salva = await physicalAssessmentRepository.saveDraft(avaliacao('completed'))

    expect(statusGravado()).toBe('completed')
    expect(salva.status).toBe('completed')
  })

  it('mantém rascunho como rascunho', async () => {
    const salva = await physicalAssessmentRepository.saveDraft(avaliacao('draft'))

    expect(statusGravado()).toBe('draft')
    expect(salva.status).toBe('draft')
  })

  it('complete() promove rascunho para concluída', async () => {
    const salva = await physicalAssessmentRepository.complete(avaliacao('draft'))

    expect(statusGravado()).toBe('completed')
    expect(salva.status).toBe('completed')
  })
})
