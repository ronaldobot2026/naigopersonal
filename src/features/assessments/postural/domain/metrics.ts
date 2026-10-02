/**
 * Cálculo das métricas posturais por vista.
 *
 * Frente e costas medem inclinação de ombros e quadris em relação à horizontal; as vistas
 * laterais medem o desvio de cabeça e tronco em relação à vertical.
 *
 * Nenhuma métrica aqui é um diagnóstico. Os textos de `automaticObservation` usam
 * deliberadamente linguagem não conclusiva (ver docs/POSTURAL_ASSESSMENT.md) e toda
 * métrica carrega `trainerValidation: 'pending'` até o treinador revisar.
 */
import type { NormalizedLandmark, PoseLandmarks } from './landmarks'
import {
  angleBetweenPoints,
  deviationFromVertical,
  distance,
  normalizeBySize,
  signedDistanceFromLine,
  slopeDegrees,
} from './geometry'
import { POSTURE_THRESHOLDS } from './postureThresholds'
import type { CaptureQuality, PosturalMetric, PosturalView } from './posturalAssessment.types'
import { SIDE_VIEW_LANDMARKS, getPosturalViewDefinition } from './posturalViews'

/** Referência geométrica contra a qual o segmento é medido. */
type AngleReference = 'horizontal' | 'vertical'

interface MetricDefinition {
  id: string
  label: string
  from: keyof PoseLandmarks
  to: keyof PoseLandmarks
  reference: AngleReference
  attentionThresholdDeg: number
}

/**
 * Métrica de ângulo formado por três pontos (a–vértice–c), comparada contra o alinhamento
 * "esperado" de 180° (segmento reto). Usada para joelho e pelve — ver seção 4 de
 * docs/CORRECTIVE_PRESCRIPTION.md.
 */
interface ThreePointAngleDefinition {
  id: string
  label: string
  a: keyof PoseLandmarks
  vertex: keyof PoseLandmarks
  c: keyof PoseLandmarks
  attentionDeviationDeg: number
  /** Frase curta sobre o que o desvio pode indicar, sempre em tom não-conclusivo. */
  observationHint: string
}

/**
 * Métrica de desvio lateral de um ponto em relação à reta entre outros dois pontos, normalizada
 * pela largura do corpo (distância entre ombros). Usada para o rastreamento do joelho em relação
 * ao pé (valgo/varo) nas vistas frontal e posterior.
 */
interface LineDeviationDefinition {
  id: string
  label: string
  point: keyof PoseLandmarks
  lineStart: keyof PoseLandmarks
  lineEnd: keyof PoseLandmarks
  attentionRatio: number
  observationHint: string
}

function buildUnavailableMetric(
  id: string,
  label: string,
  view: PosturalView,
  reason: string,
  unit: PosturalMetric['unit'] = 'degree',
): PosturalMetric {
  return {
    id,
    label,
    view,
    value: null,
    unit,
    confidence: 0,
    status: 'not_available',
    automaticObservation: reason,
    trainerValidation: 'pending',
  }
}

function describeAngle(reference: AngleReference, absValue: number, isAttention: boolean): string {
  const measurement =
    reference === 'horizontal'
      ? `diferença angular estimada de ${absValue.toFixed(1)}° em relação à horizontal`
      : `desvio estimado de ${absValue.toFixed(1)}° em relação à vertical`

  return isAttention
    ? `Indicador visual de assimetria: ${measurement}. Requer validação do profissional.`
    : `${measurement.charAt(0).toUpperCase()}${measurement.slice(1)}, sem destaque automático. Requer validação do profissional.`
}

function describeJointDeviation(deviationDeg: number, isAttention: boolean, hint: string): string {
  const measurement = `desvio de ${deviationDeg.toFixed(1)}° em relação ao alinhamento esperado (180°)`

  return isAttention
    ? `Indicador visual de alteração de alinhamento: ${measurement}. ${hint} Requer validação do profissional.`
    : `${measurement.charAt(0).toUpperCase()}${measurement.slice(1)}, sem destaque automático. Requer validação do profissional.`
}

function describeLineDeviation(ratio: number, isAttention: boolean, hint: string): string {
  const measurement = `desvio lateral equivalente a ${(ratio * 100).toFixed(1)}% da largura do corpo`

  return isAttention
    ? `Indicador visual de alteração de alinhamento: ${measurement}. ${hint} Requer validação do profissional.`
    : `${measurement.charAt(0).toUpperCase()}${measurement.slice(1)}, sem destaque automático. Requer validação do profissional.`
}

function buildAngleMetric(
  definition: MetricDefinition,
  view: PosturalView,
  a: NormalizedLandmark | undefined,
  b: NormalizedLandmark | undefined,
): PosturalMetric {
  if (!a || !b) {
    return buildUnavailableMetric(
      definition.id,
      definition.label,
      view,
      'Captura insuficiente para análise: pontos necessários não detectados.',
    )
  }

  const confidence = Math.min(a.visibility ?? 0, b.visibility ?? 0)
  const value =
    definition.reference === 'horizontal' ? slopeDegrees(a, b) : deviationFromVertical(a, b)
  const absValue = Math.abs(value)

  if (confidence < POSTURE_THRESHOLDS.minConfidenceForConclusiveMetric) {
    return {
      id: definition.id,
      label: definition.label,
      view,
      value,
      unit: 'degree',
      confidence,
      status: 'low_confidence',
      automaticObservation:
        'Resultado não conclusivo: confiança da detecção abaixo do mínimo para esta leitura.',
      trainerValidation: 'pending',
    }
  }

  const isAttention = absValue >= definition.attentionThresholdDeg
  return {
    id: definition.id,
    label: definition.label,
    view,
    value,
    unit: 'degree',
    confidence,
    status: isAttention ? 'attention' : 'within_expected_range',
    automaticObservation: describeAngle(definition.reference, absValue, isAttention),
    trainerValidation: 'pending',
  }
}

/**
 * Métrica de ângulo entre três pontos (joelho e pelve). O valor guardado é o desvio em relação
 * aos 180° esperados de um segmento reto — nunca o ângulo bruto — para seguir a mesma convenção
 * das métricas de vista lateral acima (`value` já é a grandeza comparada ao limiar).
 */
function buildThreePointAngleMetric(
  definition: ThreePointAngleDefinition,
  view: PosturalView,
  a: NormalizedLandmark | undefined,
  vertex: NormalizedLandmark | undefined,
  c: NormalizedLandmark | undefined,
): PosturalMetric {
  if (!a || !vertex || !c) {
    return buildUnavailableMetric(
      definition.id,
      definition.label,
      view,
      'Captura insuficiente para análise: pontos necessários não detectados.',
    )
  }

  const confidence = Math.min(a.visibility ?? 0, vertex.visibility ?? 0, c.visibility ?? 0)

  let deviation: number
  try {
    deviation = 180 - angleBetweenPoints(a, vertex, c)
  } catch {
    // Pontos coincidentes com o vértice: dado degenerado, não crashar a avaliação por isso.
    return buildUnavailableMetric(
      definition.id,
      definition.label,
      view,
      'Não foi possível calcular o ângulo: pontos coincidentes na captura.',
    )
  }

  if (confidence < POSTURE_THRESHOLDS.minConfidenceForConclusiveMetric) {
    return {
      id: definition.id,
      label: definition.label,
      view,
      value: deviation,
      unit: 'degree',
      confidence,
      status: 'low_confidence',
      automaticObservation:
        'Resultado não conclusivo: confiança da detecção abaixo do mínimo para esta leitura.',
      trainerValidation: 'pending',
    }
  }

  const isAttention = deviation >= definition.attentionDeviationDeg
  return {
    id: definition.id,
    label: definition.label,
    view,
    value: deviation,
    unit: 'degree',
    confidence,
    status: isAttention ? 'attention' : 'within_expected_range',
    automaticObservation: describeJointDeviation(deviation, isAttention, definition.observationHint),
    trainerValidation: 'pending',
  }
}

/**
 * Métrica de desvio lateral de `point` em relação à reta `lineStart`→`lineEnd`, normalizada pela
 * largura do corpo (distância entre ombros). Usada para o rastreamento do joelho (valgo/varo).
 */
function buildLineDeviationMetric(
  definition: LineDeviationDefinition,
  view: PosturalView,
  point: NormalizedLandmark | undefined,
  lineStart: NormalizedLandmark | undefined,
  lineEnd: NormalizedLandmark | undefined,
  leftShoulder: NormalizedLandmark | undefined,
  rightShoulder: NormalizedLandmark | undefined,
): PosturalMetric {
  if (!point || !lineStart || !lineEnd || !leftShoulder || !rightShoulder) {
    return buildUnavailableMetric(
      definition.id,
      definition.label,
      view,
      'Captura insuficiente para análise: pontos necessários não detectados.',
      'ratio',
    )
  }

  const confidence = Math.min(
    point.visibility ?? 0,
    lineStart.visibility ?? 0,
    lineEnd.visibility ?? 0,
    leftShoulder.visibility ?? 0,
    rightShoulder.visibility ?? 0,
  )

  let ratio: number
  try {
    const bodyWidth = distance(leftShoulder, rightShoulder)
    ratio = normalizeBySize(Math.abs(signedDistanceFromLine(point, lineStart, lineEnd)), bodyWidth)
  } catch {
    // Largura do corpo zero ou reta degenerada: dado incoerente, não crashar a avaliação por isso.
    return buildUnavailableMetric(
      definition.id,
      definition.label,
      view,
      'Não foi possível calcular o desvio: pontos de referência coincidentes na captura.',
      'ratio',
    )
  }

  if (confidence < POSTURE_THRESHOLDS.minConfidenceForConclusiveMetric) {
    return {
      id: definition.id,
      label: definition.label,
      view,
      value: ratio,
      unit: 'ratio',
      confidence,
      status: 'low_confidence',
      automaticObservation:
        'Resultado não conclusivo: confiança da detecção abaixo do mínimo para esta leitura.',
      trainerValidation: 'pending',
    }
  }

  const isAttention = ratio >= definition.attentionRatio
  return {
    id: definition.id,
    label: definition.label,
    view,
    value: ratio,
    unit: 'ratio',
    confidence,
    status: isAttention ? 'attention' : 'within_expected_range',
    automaticObservation: describeLineDeviation(ratio, isAttention, definition.observationHint),
    trainerValidation: 'pending',
  }
}

function bilateralDefinitions(view: PosturalView): MetricDefinition[] {
  return [
    {
      id: `${view}.shoulderInclination`,
      label: 'Inclinação dos ombros',
      from: 'leftShoulder',
      to: 'rightShoulder',
      reference: 'horizontal',
      attentionThresholdDeg: POSTURE_THRESHOLDS.shoulderInclinationAttentionDeg,
    },
    {
      id: `${view}.hipInclination`,
      label: 'Inclinação dos quadris',
      from: 'leftHip',
      to: 'rightHip',
      reference: 'horizontal',
      attentionThresholdDeg: POSTURE_THRESHOLDS.hipInclinationAttentionDeg,
    },
  ]
}

function sideDefinitions(view: PosturalView, side: 'left' | 'right'): MetricDefinition[] {
  const points = SIDE_VIEW_LANDMARKS[side]
  return [
    {
      id: `${view}.headAlignment`,
      label: 'Alinhamento da cabeça sobre o ombro',
      from: points.ear,
      to: points.shoulder,
      reference: 'vertical',
      attentionThresholdDeg: POSTURE_THRESHOLDS.headAlignmentAttentionDeg,
    },
    {
      id: `${view}.trunkAlignment`,
      label: 'Alinhamento do tronco',
      from: points.shoulder,
      to: points.hip,
      reference: 'vertical',
      attentionThresholdDeg: POSTURE_THRESHOLDS.trunkAlignmentAttentionDeg,
    },
  ]
}

/** Métricas de joelho e pelve (ângulo de três pontos), só nas vistas laterais. */
function threePointAngleDefinitionsForSide(
  view: PosturalView,
  side: 'left' | 'right',
): ThreePointAngleDefinition[] {
  const points = SIDE_VIEW_LANDMARKS[side]
  return [
    {
      id: `${view}.kneeAngle`,
      label: 'Alinhamento do joelho',
      a: points.hip,
      vertex: points.knee,
      c: points.ankle,
      attentionDeviationDeg: POSTURE_THRESHOLDS.kneeAngleDeviationAttentionDeg,
      observationHint: 'Pode indicar hiperextensão ou flexão do joelho no momento da captura.',
    },
    {
      id: `${view}.pelvicTilt`,
      label: 'Inclinação da pelve',
      a: points.shoulder,
      vertex: points.hip,
      c: points.knee,
      attentionDeviationDeg: POSTURE_THRESHOLDS.pelvicTiltAttentionDeg,
      observationHint: 'Pode indicar inclinação da pelve para frente ou para trás.',
    },
  ]
}

/** Métrica de rastreamento do joelho (valgo/varo), uma por lado, só nas vistas frontal/posterior. */
function lineDeviationDefinitions(view: PosturalView): LineDeviationDefinition[] {
  return (['left', 'right'] as const).map((side) => {
    const points = SIDE_VIEW_LANDMARKS[side]
    const sideLabel = side === 'left' ? 'esquerdo' : 'direito'
    const idSuffix = side === 'left' ? 'Left' : 'Right'
    return {
      id: `${view}.kneeTrackingDeviation${idSuffix}`,
      label: `Alinhamento do joelho ${sideLabel} em relação ao pé`,
      point: points.knee,
      lineStart: points.hip,
      lineEnd: points.ankle,
      attentionRatio: POSTURE_THRESHOLDS.kneeTrackingDeviationAttentionRatio,
      observationHint: 'Pode indicar padrão de valgo (joelho para dentro) ou varo (para fora).',
    }
  })
}

/** Métricas suportadas em cada vista, na ordem em que aparecem na revisão. */
export function getMetricDefinitions(view: PosturalView): MetricDefinition[] {
  const side = getPosturalViewDefinition(view).side
  return side ? sideDefinitions(view, side) : bilateralDefinitions(view)
}

/**
 * Calcula as métricas de uma vista. Se a captura não passou no quality gate, retorna métricas
 * "not_available" em vez de calcular sobre dados de baixa confiança.
 */
export function computeMetricsForView(
  landmarks: PoseLandmarks,
  quality: CaptureQuality,
  view: PosturalView,
): PosturalMetric[] {
  const definitions = getMetricDefinitions(view)
  const side = getPosturalViewDefinition(view).side
  const threePointDefinitions = side ? threePointAngleDefinitionsForSide(view, side) : []
  const lineDeviationDefs = side ? [] : lineDeviationDefinitions(view)

  if (!quality.passed) {
    return [
      ...definitions.map((definition) =>
        buildUnavailableMetric(
          definition.id,
          definition.label,
          view,
          'Captura insuficiente para análise.',
        ),
      ),
      ...threePointDefinitions.map((definition) =>
        buildUnavailableMetric(
          definition.id,
          definition.label,
          view,
          'Captura insuficiente para análise.',
        ),
      ),
      ...lineDeviationDefs.map((definition) =>
        buildUnavailableMetric(
          definition.id,
          definition.label,
          view,
          'Captura insuficiente para análise.',
          'ratio',
        ),
      ),
    ]
  }

  return [
    ...definitions.map((definition) =>
      buildAngleMetric(definition, view, landmarks[definition.from], landmarks[definition.to]),
    ),
    ...threePointDefinitions.map((definition) =>
      buildThreePointAngleMetric(
        definition,
        view,
        landmarks[definition.a],
        landmarks[definition.vertex],
        landmarks[definition.c],
      ),
    ),
    ...lineDeviationDefs.map((definition) =>
      buildLineDeviationMetric(
        definition,
        view,
        landmarks[definition.point],
        landmarks[definition.lineStart],
        landmarks[definition.lineEnd],
        landmarks.leftShoulder,
        landmarks.rightShoulder,
      ),
    ),
  ]
}
