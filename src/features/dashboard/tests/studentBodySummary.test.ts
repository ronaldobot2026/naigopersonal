import { describe, expect, it } from 'vitest'
import { createDraftPhysicalAssessment } from '@/features/assessments/physical/domain/createDraftPhysicalAssessment'
import type { PhysicalAssessment } from '@/types/domain'
import { summarizeBody } from '../domain/studentBodySummary'

function avaliacao(
  updatedAt: string,
  biometrics: Partial<PhysicalAssessment['biometrics']>,
  status: PhysicalAssessment['status'] = 'completed',
): PhysicalAssessment {
  const base = createDraftPhysicalAssessment('aluno-1', 'personal-1')
  return { ...base, status, updatedAt, biometrics: { ...base.biometrics, ...biometrics } }
}

describe('summarizeBody', () => {
  it('sem avaliação concluída, nada a mostrar', () => {
    const summary = summarizeBody([avaliacao('2026-10-01', { weightKg: 80 }, 'draft')])
    expect(summary.assessedAt).toBeNull()
    expect(summary.weightKg).toEqual({ value: null, changePercent: null })
  })

  it('usa a avaliação concluída mais recente e compara com a anterior', () => {
    const summary = summarizeBody([
      avaliacao('2026-08-01', { weightKg: 80, bodyFatPercent: 20 }),
      avaliacao('2026-10-01', { weightKg: 76, bodyFatPercent: null }),
      avaliacao('2026-10-05', { weightKg: 999 }, 'draft'),
    ])

    expect(summary.assessedAt).toBe('2026-10-01')
    expect(summary.weightKg.value).toBe(76)
    expect(summary.weightKg.changePercent).toBeCloseTo(-5)
    // Campo não medido na última avaliação: mostra o último valor medido, sem tendência.
    expect(summary.bodyFatPercent).toEqual({ value: 20, changePercent: null })
  })
})
