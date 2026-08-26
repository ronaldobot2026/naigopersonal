/**
 * Liga os achados da Avaliação Postural às sugestões de exercício da Correção Postural.
 *
 * IMPORTANTE — isto **não** é prescrição automática de tratamento (o que
 * `docs/POSTURAL_ASSESSMENT.md` proíbe explicitamente). O que este módulo faz é ordenar uma
 * vitrine: quando a avaliação destacou um indicador para revisão, as sugestões daquela região
 * aparecem primeiro. A indicação final continua sendo do profissional, e nenhuma métrica
 * rejeitada por ele influencia a lista.
 *
 * O acoplamento com `features/assessments/postural` é só de tipo e de limiar — nenhuma regra de
 * cálculo é reimplementada aqui, e a dependência não é recíproca (a feature postural não conhece
 * `workouts`), então não há ciclo.
 */
import type { PosturalMetric } from '@/features/assessments/postural/domain/posturalAssessment.types'
import { POSTURE_THRESHOLDS } from '@/features/assessments/postural/domain/postureThresholds'
import type { Exercise } from './exercise.types'
import { selectPosturalExercises, type PosturalCategoryId } from './posturalProgram'

export type PosturalFocusId = 'cintura_escapular' | 'quadril_pelve' | 'cervical' | 'tronco'

export interface PosturalFocus {
  id: PosturalFocusId
  label: string
  /** Frase exibida ao aluno. Linguagem não conclusiva, como o resto do módulo postural. */
  rationale: string
  /** Rótulos pt-BR de `target` que caracterizam a região (ver `exerciseTaxonomy.ts`). */
  muscles: readonly string[]
  /** Rótulos pt-BR de `bodyPart` que caracterizam a região. */
  bodyParts: readonly string[]
}

/**
 * Sufixo do id da métrica (`front.shoulderInclination` → `shoulderInclination`) mapeado para a
 * região que ele observa e para o limiar de atenção correspondente. Os limiares vêm de
 * `POSTURE_THRESHOLDS` para que ajustar o threshold da avaliação ajuste também a ordenação aqui.
 */
const METRIC_FOCUS: Record<string, { focus: PosturalFocusId; attentionThresholdDeg: number }> = {
  shoulderInclination: {
    focus: 'cintura_escapular',
    attentionThresholdDeg: POSTURE_THRESHOLDS.shoulderInclinationAttentionDeg,
  },
  hipInclination: {
    focus: 'quadril_pelve',
    attentionThresholdDeg: POSTURE_THRESHOLDS.hipInclinationAttentionDeg,
  },
  headAlignment: {
    focus: 'cervical',
    attentionThresholdDeg: POSTURE_THRESHOLDS.headAlignmentAttentionDeg,
  },
  trunkAlignment: {
    focus: 'tronco',
    attentionThresholdDeg: POSTURE_THRESHOLDS.trunkAlignmentAttentionDeg,
  },
}

export const POSTURAL_FOCUSES: readonly PosturalFocus[] = [
  {
    id: 'cintura_escapular',
    label: 'Cintura escapular',
    rationale: 'A avaliação destacou a inclinação dos ombros para revisão do profissional.',
    muscles: ['Trapézio', 'Dorsal superior', 'Deltoides', 'Levantador da escápula', 'Dorsais'],
    bodyParts: ['Ombros', 'Costas'],
  },
  {
    id: 'quadril_pelve',
    label: 'Quadril e pelve',
    rationale: 'A avaliação destacou a inclinação dos quadris para revisão do profissional.',
    muscles: ['Glúteos', 'Abdutores', 'Adutores', 'Posteriores de coxa', 'Quadríceps'],
    bodyParts: ['Coxas'],
  },
  {
    id: 'cervical',
    label: 'Cervical e torácica alta',
    rationale:
      'A avaliação destacou o alinhamento da cabeça sobre o ombro para revisão do profissional.',
    muscles: ['Levantador da escápula', 'Trapézio', 'Dorsal superior', 'Peitoral'],
    bodyParts: ['Pescoço', 'Ombros'],
  },
  {
    id: 'tronco',
    label: 'Tronco e core',
    rationale: 'A avaliação destacou o alinhamento do tronco para revisão do profissional.',
    muscles: ['Coluna', 'Abdômen', 'Dorsais', 'Dorsal superior'],
    bodyParts: ['Core', 'Costas'],
  },
] as const

export function getPosturalFocus(id: PosturalFocusId): PosturalFocus {
  const focus = POSTURAL_FOCUSES.find((item) => item.id === id)
  if (!focus) throw new Error(`Foco postural desconhecido: ${id}`)
  return focus
}

export interface PosturalFinding {
  focus: PosturalFocus
  /** Métricas que sustentam o foco, já filtradas (nunca rejeitadas pelo treinador). */
  metrics: PosturalMetric[]
  /**
   * Maior razão |valor| / limiar entre as métricas de apoio. Acima de 1 significa que a leitura
   * passou do limiar de atenção; serve só para ordenar a vitrine, não é escala clínica.
   */
  severity: number
  /** `false` enquanto qualquer métrica de apoio ainda estiver aguardando o treinador. */
  isTrainerValidated: boolean
}

function getMetricKey(metricId: string): string {
  return metricId.split('.')[1] ?? metricId
}

/**
 * Uma métrica só entra se foi destacada para atenção e o treinador não a rejeitou.
 *
 * `low_confidence` e `not_available` ficam de fora por definição — o próprio módulo postural
 * os trata como não conclusivos, então usá-los para direcionar exercício seria afirmar mais do
 * que o dado sustenta.
 */
function isEligible(metric: PosturalMetric): boolean {
  return (
    metric.status === 'attention' &&
    metric.trainerValidation !== 'rejected' &&
    metric.value !== null
  )
}

/**
 * Agrupa as métricas destacadas por região, da mais acentuada para a menos.
 *
 * Quando duas vistas apontam a mesma região (frente e costas, por exemplo), elas se somam no
 * mesmo achado em vez de virarem dois itens repetidos na tela.
 */
export function derivePosturalFindings(metrics: PosturalMetric[]): PosturalFinding[] {
  const byFocus = new Map<PosturalFocusId, PosturalMetric[]>()

  for (const metric of metrics) {
    if (!isEligible(metric)) continue
    const mapping = METRIC_FOCUS[getMetricKey(metric.id)]
    if (!mapping) continue
    byFocus.set(mapping.focus, [...(byFocus.get(mapping.focus) ?? []), metric])
  }

  const findings: PosturalFinding[] = []
  for (const [focusId, supporting] of byFocus) {
    const severity = Math.max(
      ...supporting.map((metric) => {
        const { attentionThresholdDeg } = METRIC_FOCUS[getMetricKey(metric.id)]
        return Math.abs(metric.value ?? 0) / attentionThresholdDeg
      }),
    )

    findings.push({
      focus: getPosturalFocus(focusId),
      metrics: supporting,
      severity,
      isTrainerValidated: supporting.every((metric) => metric.trainerValidation !== 'pending'),
    })
  }

  return findings.sort((a, b) => b.severity - a.severity)
}

function matchesFocus(exercise: Exercise, focus: PosturalFocus): boolean {
  return focus.muscles.includes(exercise.target) || focus.bodyParts.includes(exercise.bodyPart)
}

/**
 * Recorte do catálogo para uma região específica, dentro de uma das categorias já existentes
 * (mobilidade / alongamento / fortalecimento). Compõe com `selectPosturalExercises` em vez de
 * refazer os filtros de equipamento e de alongamento.
 */
export function selectExercisesForFocus(
  exercises: Exercise[],
  focusId: PosturalFocusId,
  category: PosturalCategoryId,
): Exercise[] {
  const focus = getPosturalFocus(focusId)
  return selectPosturalExercises(exercises, category).filter((exercise) =>
    matchesFocus(exercise, focus),
  )
}
