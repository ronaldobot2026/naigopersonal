/**
 * Regras de composição da sessão postural: como capturas e métricas de cada uma das quatro
 * vistas se combinam em um único `PosturalAssessment`, sem mutação.
 *
 * A UI não deve manipular os arrays `captures` / `metrics` diretamente — recapturar uma vista
 * substitui apenas os dados daquela vista e preserva a validação já feita nas demais.
 */
import type {
  PosturalAssessment,
  PosturalCapture,
  PosturalMetric,
  PosturalView,
} from './posturalAssessment.types'
import { POSTURAL_PROCESSING_VERSION } from './posturalAssessment.types'
import { POSTURAL_VIEWS } from './posturalViews'

export function createEmptyPosturalAssessment(): PosturalAssessment {
  return {
    consentAccepted: false,
    captures: [],
    metrics: [],
    processingVersion: POSTURAL_PROCESSING_VERSION,
  }
}

export function getCaptureForView(
  assessment: PosturalAssessment | undefined,
  view: PosturalView,
): PosturalCapture | undefined {
  return assessment?.captures.find((capture) => capture.view === view)
}

export function getMetricsForView(
  assessment: PosturalAssessment | undefined,
  view: PosturalView,
): PosturalMetric[] {
  return (assessment?.metrics ?? []).filter((metric) => metric.view === view)
}

/** Vistas já capturadas, na ordem canônica do protocolo. */
export function getCapturedViews(assessment: PosturalAssessment | undefined): PosturalView[] {
  return POSTURAL_VIEWS.filter((view) => getCaptureForView(assessment, view) !== undefined)
}

/** Vistas ainda pendentes ou cuja captura foi reprovada no quality gate. */
export function getPendingViews(assessment: PosturalAssessment | undefined): PosturalView[] {
  return POSTURAL_VIEWS.filter((view) => {
    const capture = getCaptureForView(assessment, view)
    return capture === undefined || !capture.quality.passed
  })
}

/** Uma avaliação só está completa com as quatro vistas capturadas e aprovadas. */
export function isPosturalAssessmentComplete(assessment: PosturalAssessment | undefined): boolean {
  return assessment !== undefined && getPendingViews(assessment).length === 0
}

/** Substitui captura e métricas de uma vista, preservando as demais. */
export function upsertViewCapture(
  assessment: PosturalAssessment | undefined,
  capture: PosturalCapture,
  metrics: PosturalMetric[],
): PosturalAssessment {
  const base = assessment ?? createEmptyPosturalAssessment()

  return {
    ...base,
    consentAccepted: true,
    captures: [...base.captures.filter((item) => item.view !== capture.view), capture],
    metrics: [...base.metrics.filter((item) => item.view !== capture.view), ...metrics],
    processingVersion: POSTURAL_PROCESSING_VERSION,
  }
}

/** Aplica a validação do treinador a uma métrica, sem tocar nas demais vistas. */
export function replaceMetrics(
  assessment: PosturalAssessment,
  updated: PosturalMetric[],
): PosturalAssessment {
  const updatedById = new Map(updated.map((metric) => [metric.id, metric]))
  return {
    ...assessment,
    metrics: assessment.metrics.map((metric) => updatedById.get(metric.id) ?? metric),
  }
}
