import { describe, expect, it } from 'vitest'
import type {
  CorrectivePlan,
  CorrectivePlanItem,
} from '@/features/assessments/postural/domain/correctivePrescription.types'
import { pickLatestPublished } from '../hooks/useStudentCorrectivePlan'

function item(id: string, validation: CorrectivePlanItem['validation']): CorrectivePlanItem {
  return {
    id,
    exerciseId: id,
    exerciseName: `Exercício ${id}`,
    findingId: 'f1',
    targetMuscles: [],
    sets: 3,
    reps: '12',
    origin: 'suggested',
    validation,
  }
}

function plano(
  id: string,
  status: CorrectivePlan['status'],
  publishedAt?: string,
  items = [item('1', 'pending')],
): CorrectivePlan {
  return {
    id,
    studentId: 'aluno-1',
    assessmentId: `aval-${id}`,
    findings: [],
    items,
    status,
    createdAt: '2026-09-01T00:00:00.000Z',
    publishedAt,
    prescriptionVersion: '2026.1',
  }
}

describe('pickLatestPublished', () => {
  it('sem plano publicado, nada a mostrar', () => {
    expect(pickLatestPublished([])).toBeNull()
    expect(pickLatestPublished([plano('rascunho', 'draft')])).toBeNull()
  })

  it('pega o publicado mais recente', () => {
    const latest = pickLatestPublished([
      plano('antigo', 'published', '2026-09-10T00:00:00.000Z'),
      plano('novo', 'published', '2026-10-01T00:00:00.000Z'),
      plano('rascunho', 'draft'),
    ])
    expect(latest?.id).toBe('novo')
  })

  it('o aluno não vê exercício que o personal rejeitou', () => {
    const latest = pickLatestPublished([
      plano('p', 'published', '2026-10-01T00:00:00.000Z', [
        item('ok', 'accepted'),
        item('fora', 'rejected'),
      ]),
    ])
    expect(latest?.items.map((entry) => entry.id)).toEqual(['ok'])
  })

  it('o mesmo exercício sugerido para dois achados aparece uma vez só', () => {
    const esquerdo = { ...item('0095', 'pending'), id: 'esq', findingId: 'cabeca-esq' }
    const direito = { ...item('0095', 'pending'), id: 'dir', findingId: 'cabeca-dir' }
    const latest = pickLatestPublished([
      plano('p', 'published', '2026-10-01T00:00:00.000Z', [
        esquerdo,
        item('0044', 'pending'),
        direito,
      ]),
    ])
    expect(latest?.items.map((entry) => entry.exerciseId)).toEqual(['0095', '0044'])
  })
})
