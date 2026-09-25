/**
 * Comparação postural entre duas avaliações físicas do mesmo aluno.
 *
 * Decisões de domínio que valem mais que o código:
 *
 * 1. Comparação por MÓDULO. O sinal dos ângulos posturais codifica o LADO (ex.: pelve inclinada
 *    para a esquerda vs. para a direita), não a gravidade — a mesma convenção já documentada em
 *    `measurementFormat.ts`. Comparar valores com sinal diria que -8° "melhorou" para +2°, quando
 *    na verdade o desvio caiu de 8° para 2°. Por isso todo delta é `|atual| - |anterior|`.
 *
 * 2. Encadeamento por `createdAt` (data da coleta), nunca por `updatedAt`: reabrir uma avaliação
 *    antiga altera `updatedAt` e faria o par comparado mudar sem nenhuma coleta nova.
 *
 * 3. Rascunho (`status === 'draft'`) fica FORA do encadeamento: os dados ainda podem mudar e
 *    comparar contra algo inacabado produz conclusão falsa.
 *
 * 4. Nada aqui é diagnóstico. Quando a confiança da detecção é baixa ou falta valor, o resultado
 *    é `inconclusive` e o texto é deliberadamente não conclusivo.
 */
import type { PhysicalAssessment } from '@/types/domain'
import type { PosturalMetric, PosturalView } from './posturalAssessment.types'
import { POSTURAL_VIEWS } from './posturalViews'

/** Sufixos (após `${view}.`) das métricas que entram na comparação: joelho, pelve e cabeça. */
export const COMPARED_METRIC_KEYS = [
  'pelvicTilt',
  'headAlignment',
  'kneeAngle',
  'kneeTrackingDeviationLeft',
  'kneeTrackingDeviationRight',
] as const

export type ComparedMetricKey = (typeof COMPARED_METRIC_KEYS)[number]

/**
 * Variação mínima em módulo para considerar que houve mudança real, por unidade de medida.
 * Abaixo disso a diferença é ruído de captura (posição do aluno, enquadramento) e não alteração
 * postural — tratar 0,3° como "piora" geraria alarme falso a cada avaliação.
 */
export const COMPARISON_NOISE_THRESHOLD = {
  degree: 1,
  /** Razão em relação à largura do corpo: 0,01 = 1 ponto percentual. */
  ratio: 0.01,
  normalized_distance: 0.01,
} as const satisfies Record<PosturalMetric['unit'], number>

export type PosturalComparisonDirection = 'improved' | 'worsened' | 'stable' | 'inconclusive'

export interface PosturalMetricComparison {
  id: string
  label: string
  view: PosturalView
  unit: PosturalMetric['unit']
  /** Valor bruto com sinal, como gravado. `null` quando a métrica não pôde ser medida. */
  currentValue: number | null
  previousValue: number | null
  /** `|atual| - |anterior|`. Negativo = desvio menor. `null` quando não há como comparar. */
  delta: number | null
  direction: PosturalComparisonDirection
  /** Alguma das duas leituras veio com confiança abaixo do mínimo. */
  lowConfidence: boolean
  /** Texto técnico em pt-BR, não conclusivo, para o personal ler. */
  note: string
}

export type PosturalComparisonResult =
  | { kind: 'no_previous' }
  | { kind: 'current_without_postural' }
  | { kind: 'previous_without_postural'; previousCreatedAt: string }
  | {
      kind: 'available'
      currentCreatedAt: string
      previousCreatedAt: string
      metrics: PosturalMetricComparison[]
    }

/**
 * Par (atual, anterior) do encadeamento: só avaliações concluídas, ordenadas por `createdAt`
 * decrescente. Recebe a lista em qualquer ordem — não assume a ordenação da página.
 */
export function selectComparablePair(
  assessments: readonly PhysicalAssessment[],
): { current: PhysicalAssessment | null; previous: PhysicalAssessment | null } {
  const completed = assessments
    .filter((assessment) => assessment.status === 'completed')
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return { current: completed[0] ?? null, previous: completed[1] ?? null }
}

function metricKeyOf(metricId: string): string {
  // Os ids têm o formato `${view}.${chave}`; a chave é o que identifica a métrica entre vistas.
  const separatorIndex = metricId.indexOf('.')
  return separatorIndex === -1 ? metricId : metricId.slice(separatorIndex + 1)
}

function findMetric(metrics: readonly PosturalMetric[], id: string): PosturalMetric | undefined {
  return metrics.find((metric) => metric.id === id)
}

function isLowConfidence(metric: PosturalMetric | undefined): boolean {
  return metric?.status === 'low_confidence'
}

function describe(
  direction: PosturalComparisonDirection,
  delta: number | null,
  lowConfidence: boolean,
): string {
  if (direction === 'inconclusive') {
    return lowConfidence
      ? 'Leitura com confiança abaixo do mínimo em ao menos uma das avaliações: comparação não conclusiva.'
      : 'Sem medição válida em ao menos uma das avaliações: não há base para comparar.'
  }
  if (direction === 'stable' || delta === null) {
    return 'Variação dentro da margem de ruído de captura: sem alteração relevante entre as coletas.'
  }
  return direction === 'improved'
    ? 'Redução do desvio em relação à avaliação anterior. Requer validação do profissional.'
    : 'Aumento do desvio em relação à avaliação anterior. Requer validação do profissional.'
}

function compareMetric(
  id: string,
  currentMetric: PosturalMetric | undefined,
  previousMetric: PosturalMetric | undefined,
  view: PosturalView,
): PosturalMetricComparison {
  const reference = currentMetric ?? previousMetric
  const lowConfidence = isLowConfidence(currentMetric) || isLowConfidence(previousMetric)
  const currentValue = currentMetric?.value ?? null
  const previousValue = previousMetric?.value ?? null

  const base: Omit<PosturalMetricComparison, 'delta' | 'direction' | 'note'> = {
    id,
    label: reference?.label ?? id,
    view,
    unit: reference?.unit ?? 'degree',
    currentValue,
    previousValue,
    lowConfidence,
  }

  if (currentValue === null || previousValue === null || lowConfidence) {
    return { ...base, delta: null, direction: 'inconclusive', note: describe('inconclusive', null, lowConfidence) }
  }

  // Módulo dos dois lados: o sinal é lado, não gravidade (ver cabeçalho do arquivo).
  const delta = Math.abs(currentValue) - Math.abs(previousValue)
  const threshold = COMPARISON_NOISE_THRESHOLD[base.unit]
  const direction: PosturalComparisonDirection =
    Math.abs(delta) < threshold ? 'stable' : delta < 0 ? 'improved' : 'worsened'

  return { ...base, delta, direction, note: describe(direction, delta, lowConfidence) }
}

/**
 * Compara as métricas de joelho, pelve e cabeça entre a avaliação atual e a anterior.
 * Só considera métricas presentes em pelo menos uma das duas avaliações, para não poluir a tela
 * com linhas de métricas que aquela vista nem produz.
 */
export function comparePosturalAssessments(
  current: PhysicalAssessment | null,
  previous: PhysicalAssessment | null,
): PosturalComparisonResult {
  if (!current?.posturalAssessment) return { kind: 'current_without_postural' }
  if (!previous) return { kind: 'no_previous' }
  if (!previous.posturalAssessment) {
    return { kind: 'previous_without_postural', previousCreatedAt: previous.createdAt }
  }

  const currentMetrics = current.posturalAssessment.metrics
  const previousMetrics = previous.posturalAssessment.metrics
  const comparedKeys = new Set<string>(COMPARED_METRIC_KEYS)

  const metrics: PosturalMetricComparison[] = []
  for (const view of POSTURAL_VIEWS) {
    for (const key of COMPARED_METRIC_KEYS) {
      const id = `${view}.${key}`
      const currentMetric = findMetric(currentMetrics, id)
      const previousMetric = findMetric(previousMetrics, id)
      if (!currentMetric && !previousMetric) continue
      metrics.push(compareMetric(id, currentMetric, previousMetric, view))
    }
  }

  // Guarda contra ids fora do padrão `${view}.${chave}`: se alguma métrica comparável existir com
  // vista não listada, ela seria silenciosamente ignorada acima — melhor falhar visível no teste.
  const unmatched = currentMetrics.filter(
    (metric) => comparedKeys.has(metricKeyOf(metric.id)) && !metrics.some((m) => m.id === metric.id),
  )
  for (const metric of unmatched) {
    metrics.push(compareMetric(metric.id, metric, findMetric(previousMetrics, metric.id), metric.view))
  }

  return {
    kind: 'available',
    currentCreatedAt: current.createdAt,
    previousCreatedAt: previous.createdAt,
    metrics,
  }
}
