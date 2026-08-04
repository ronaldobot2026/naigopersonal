/**
 * Quality gate da captura postural — decide se uma captura tem qualidade suficiente
 * para prosseguir ao cálculo de métricas, e explica exatamente o motivo quando falha.
 * Todas as coordenadas são normalizadas [0,1] relativas à imagem (saída do Pose Landmarker).
 */
import type { LandmarkName, Point2D, PoseLandmarks } from './landmarks'
import type { CaptureQuality, PosturalView } from './posturalAssessment.types'
import { deviationFromHorizontal } from './geometry'
import { POSTURE_THRESHOLDS } from './postureThresholds'

const REQUIRED_LANDMARKS_BY_VIEW: Record<PosturalView, readonly LandmarkName[]> = {
  front: [
    'nose',
    'leftShoulder',
    'rightShoulder',
    'leftHip',
    'rightHip',
    'leftKnee',
    'rightKnee',
    'leftAnkle',
    'rightAnkle',
  ],
  back: [
    'leftShoulder',
    'rightShoulder',
    'leftHip',
    'rightHip',
    'leftKnee',
    'rightKnee',
    'leftAnkle',
    'rightAnkle',
  ],
  left_side: ['leftEar', 'leftShoulder', 'leftHip', 'leftKnee', 'leftAnkle'],
  right_side: ['rightEar', 'rightShoulder', 'rightHip', 'rightKnee', 'rightAnkle'],
}

const TOP_REFERENCE_BY_VIEW: Record<PosturalView, readonly LandmarkName[]> = {
  front: ['nose'],
  back: ['leftShoulder', 'rightShoulder'],
  left_side: ['leftEar'],
  right_side: ['rightEar'],
}

const BOTTOM_REFERENCE_BY_VIEW: Record<PosturalView, readonly LandmarkName[]> = {
  front: ['leftAnkle', 'rightAnkle'],
  back: ['leftAnkle', 'rightAnkle'],
  left_side: ['leftAnkle'],
  right_side: ['rightAnkle'],
}

/** Vistas em que ombros e quadris devem aparecer alinhados horizontalmente (frente e costas). */
const BILATERAL_VIEWS: readonly PosturalView[] = ['front', 'back']

const EXTREME_CAMERA_TILT_DEG = 20

function averagePoint(
  landmarks: PoseLandmarks,
  names: readonly LandmarkName[],
): { x: number; y: number } | undefined {
  const points = names
    .map((name) => landmarks[name])
    .filter((point): point is NonNullable<typeof point> => point !== undefined)
  if (points.length === 0) return undefined
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  }
}

/**
 * Verifica se a orientação do corpo é compatível com a vista escolhida, comparando a largura
 * aparente dos ombros com a extensão vertical do corpo. Heurística deliberadamente folgada
 * (ver POSTURE_THRESHOLDS): só reprova quando a discrepância é evidente, para não bloquear
 * capturas legítimas. Retorna lista vazia quando não há dados suficientes para decidir.
 */
function checkOrientation(
  view: PosturalView,
  shoulders: readonly Point2D[] | undefined,
  bodySpanRatio: number | undefined,
): string[] {
  if (!shoulders || shoulders.length < 2 || bodySpanRatio === undefined || bodySpanRatio <= 0) {
    return []
  }

  const shoulderSpanRatio = Math.abs(shoulders[0].x - shoulders[1].x) / bodySpanRatio
  const isSideView = !BILATERAL_VIEWS.includes(view)

  if (isSideView && shoulderSpanRatio > POSTURE_THRESHOLDS.maxShoulderSpanRatioForSideView) {
    return ['A pessoa parece estar de frente, e não de perfil — gire 90° para esta captura.']
  }
  if (!isSideView && shoulderSpanRatio < POSTURE_THRESHOLDS.minShoulderSpanRatioForBilateralView) {
    return ['A pessoa parece estar de perfil — vire o corpo para esta captura.']
  }
  return []
}

/** Avalia se uma captura tem qualidade suficiente para prosseguir. Nunca lança erro. */
export function evaluateCaptureQuality(
  landmarks: PoseLandmarks,
  view: PosturalView,
): CaptureQuality {
  const reasons: string[] = []
  const requiredLandmarks = REQUIRED_LANDMARKS_BY_VIEW[view]

  const visibilities = requiredLandmarks.map((name) => landmarks[name]?.visibility ?? 0)
  const missingLandmarks = requiredLandmarks.filter(
    (name, index) =>
      landmarks[name] === undefined ||
      visibilities[index] < POSTURE_THRESHOLDS.minLandmarkVisibility,
  )

  if (missingLandmarks.length > 0) {
    reasons.push(
      'Alguns pontos do corpo não foram detectados com confiança suficiente. Ajuste a iluminação e o enquadramento.',
    )
  }

  const topReference = averagePoint(landmarks, TOP_REFERENCE_BY_VIEW[view])
  const bottomReference = averagePoint(landmarks, BOTTOM_REFERENCE_BY_VIEW[view])
  const margin = POSTURE_THRESHOLDS.frameMarginRatio
  let bodySpanRatio: number | undefined

  if (!topReference || !bottomReference) {
    reasons.push('Não foi possível localizar a cabeça e os pés na imagem.')
  } else {
    if (topReference.y < margin) {
      reasons.push('Cabeça muito próxima da borda superior — afaste a câmera ou recue.')
    }
    if (bottomReference.y > 1 - margin) {
      reasons.push('Pés fora do enquadramento — afaste a câmera ou recue.')
    }

    bodySpanRatio = bottomReference.y - topReference.y
    if (bodySpanRatio < POSTURE_THRESHOLDS.minBodySpanRatio) {
      reasons.push('Pessoa muito pequena na imagem — aproxime a câmera.')
    }
  }

  const shoulders =
    landmarks.leftShoulder && landmarks.rightShoulder
      ? [landmarks.leftShoulder, landmarks.rightShoulder]
      : undefined
  const hips =
    landmarks.leftHip && landmarks.rightHip ? [landmarks.leftHip, landmarks.rightHip] : undefined

  // A heurística de câmera inclinada só faz sentido quando ombros e quadris deveriam aparecer
  // horizontais. De perfil, os dois pontos de cada par quase se sobrepõem e o ângulo é ruído.
  if (shoulders && hips && BILATERAL_VIEWS.includes(view)) {
    const shoulderTilt = deviationFromHorizontal(shoulders[0], shoulders[1])
    const hipTilt = deviationFromHorizontal(hips[0], hips[1])
    if (shoulderTilt > EXTREME_CAMERA_TILT_DEG && hipTilt > EXTREME_CAMERA_TILT_DEG) {
      reasons.push('A câmera parece estar muito inclinada — nivele antes de capturar.')
    }
  }

  reasons.push(...checkOrientation(view, shoulders, bodySpanRatio))

  const score =
    visibilities.length > 0 ? visibilities.reduce((sum, v) => sum + v, 0) / visibilities.length : 0
  if (score < POSTURE_THRESHOLDS.minQualityScore && missingLandmarks.length === 0) {
    reasons.push(
      'Confiança geral da detecção abaixo do mínimo — tente novamente com melhor iluminação.',
    )
  }

  return {
    passed: reasons.length === 0 && score >= POSTURE_THRESHOLDS.minQualityScore,
    score,
    reasons,
  }
}
