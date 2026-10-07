import type { PhysicalAssessment } from '@/types/domain'

/** Métrica da home do aluno: o valor da avaliação mais recente e a variação contra a anterior. */
export interface BodyMetricSummary {
  value: number | null
  /** Variação percentual contra a avaliação anterior que tinha o mesmo campo; `null` sem base. */
  changePercent: number | null
}

export interface StudentBodySummary {
  /** Data da avaliação concluída mais recente; `null` se o aluno não tem nenhuma. */
  assessedAt: string | null
  weightKg: BodyMetricSummary
  bodyFatPercent: BodyMetricSummary
  muscleMassKg: BodyMetricSummary
}

type MetricKey = 'weightKg' | 'bodyFatPercent' | 'muscleMassKg'

function summarize(history: PhysicalAssessment[], key: MetricKey): BodyMetricSummary {
  const withValue = history.filter((assessment) => assessment.biometrics[key] !== null)
  const [latest, previous] = withValue
  const value = latest?.biometrics[key] ?? null
  const before = previous?.biometrics[key] ?? null
  const changePercent = value !== null && before ? ((value - before) / before) * 100 : null
  return { value, changePercent }
}

/**
 * Resumo corporal do aluno a partir das avaliações CONCLUÍDAS — as mesmas que ele já enxerga em
 * "Minhas avaliações" (a RLS nunca entrega rascunho para o aluno). Antes a home mostrava números
 * fixos de exemplo (78,4 kg, 14,2 %…) iguais para todo aluno.
 */
export function summarizeBody(assessments: PhysicalAssessment[]): StudentBodySummary {
  const history = assessments
    .filter((assessment) => assessment.status === 'completed')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return {
    assessedAt: history[0]?.updatedAt ?? null,
    weightKg: summarize(history, 'weightKg'),
    bodyFatPercent: summarize(history, 'bodyFatPercent'),
    muscleMassKg: summarize(history, 'muscleMassKg'),
  }
}
