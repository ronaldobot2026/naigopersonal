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
import { deviationFromVertical, slopeDegrees } from './geometry'
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

function buildUnavailableMetric(
  id: string,
  label: string,
  view: PosturalView,
  reason: string,
): PosturalMetric {
  return {
    id,
    label,
    view,
    value: null,
    unit: 'degree',
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

  if (!quality.passed) {
    return definitions.map((definition) =>
      buildUnavailableMetric(
        definition.id,
        definition.label,
        view,
        'Captura insuficiente para análise.',
      ),
    )
  }

  return definitions.map((definition) =>
    buildAngleMetric(definition, view, landmarks[definition.from], landmarks[definition.to]),
  )
}
