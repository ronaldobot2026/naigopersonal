import type { RawLandmark } from '../../domain/landmarks'

const DEFAULT_VISIBILITY = 0.95

/** Pose frontal parada, ombros e quadris nivelados, todos os pontos com alta confiança. */
const BASE_POSE: Record<number, RawLandmark> = {
  0: { x: 0.5, y: 0.12, visibility: DEFAULT_VISIBILITY }, // nose
  7: { x: 0.47, y: 0.13, visibility: DEFAULT_VISIBILITY }, // leftEar
  8: { x: 0.53, y: 0.13, visibility: DEFAULT_VISIBILITY }, // rightEar
  11: { x: 0.4, y: 0.3, visibility: DEFAULT_VISIBILITY }, // leftShoulder
  12: { x: 0.6, y: 0.3, visibility: DEFAULT_VISIBILITY }, // rightShoulder
  13: { x: 0.35, y: 0.4, visibility: DEFAULT_VISIBILITY }, // leftElbow
  14: { x: 0.65, y: 0.4, visibility: DEFAULT_VISIBILITY }, // rightElbow
  15: { x: 0.32, y: 0.5, visibility: DEFAULT_VISIBILITY }, // leftWrist
  16: { x: 0.68, y: 0.5, visibility: DEFAULT_VISIBILITY }, // rightWrist
  23: { x: 0.42, y: 0.55, visibility: DEFAULT_VISIBILITY }, // leftHip
  24: { x: 0.58, y: 0.55, visibility: DEFAULT_VISIBILITY }, // rightHip
  25: { x: 0.42, y: 0.75, visibility: DEFAULT_VISIBILITY }, // leftKnee
  26: { x: 0.58, y: 0.75, visibility: DEFAULT_VISIBILITY }, // rightKnee
  27: { x: 0.42, y: 0.92, visibility: DEFAULT_VISIBILITY }, // leftAnkle
  28: { x: 0.58, y: 0.92, visibility: DEFAULT_VISIBILITY }, // rightAnkle
  29: { x: 0.41, y: 0.94, visibility: DEFAULT_VISIBILITY }, // leftHeel
  30: { x: 0.59, y: 0.94, visibility: DEFAULT_VISIBILITY }, // rightHeel
  31: { x: 0.44, y: 0.95, visibility: DEFAULT_VISIBILITY }, // leftFootIndex
  32: { x: 0.56, y: 0.95, visibility: DEFAULT_VISIBILITY }, // rightFootIndex
}

function buildPoseArray(
  overrides: Record<number, RawLandmark | undefined> = {},
  length = 33,
): (RawLandmark | undefined)[] {
  const merged: Record<number, RawLandmark | undefined> = { ...BASE_POSE, ...overrides }
  return Array.from({ length }, (_, index) => merged[index])
}

/** Pose "boa": todos os pontos exigidos presentes, alta confiança, ombros/quadris nivelados. */
export const GOOD_FRONTAL_POSE = buildPoseArray()

/** Ombro direito ~8.5° mais baixo — deve cair em "attention"; quadris permanecem nivelados. */
export const TILTED_SHOULDERS_POSE = buildPoseArray({
  12: { x: 0.6, y: 0.33, visibility: DEFAULT_VISIBILITY },
})

/** Ombros detectados, porém com visibilidade abaixo do mínimo aceitável. */
export const LOW_VISIBILITY_SHOULDERS_POSE = buildPoseArray({
  11: { x: 0.4, y: 0.3, visibility: 0.3 },
  12: { x: 0.6, y: 0.3, visibility: 0.3 },
})

/** Array truncado — quadris, joelhos, tornozelos e pés nunca são detectados. */
export const MISSING_LOWER_BODY_POSE = buildPoseArray({}, 17)

/** Pessoa longe demais da câmera: pouca extensão vertical entre cabeça e pés. */
export const TOO_FAR_POSE = buildPoseArray({
  0: { x: 0.5, y: 0.45, visibility: DEFAULT_VISIBILITY },
  27: { x: 0.42, y: 0.55, visibility: DEFAULT_VISIBILITY },
  28: { x: 0.58, y: 0.55, visibility: DEFAULT_VISIBILITY },
})

/**
 * Perfil direito alinhado: orelha, ombro, quadril e tornozelo praticamente sobre a mesma
 * vertical. Os pontos do lado esquerdo quase se sobrepõem aos do direito, como em uma foto
 * de perfil real.
 */
const RIGHT_SIDE_POSE_BASE: Record<number, RawLandmark> = {
  0: { x: 0.55, y: 0.12, visibility: DEFAULT_VISIBILITY }, // nose (à frente da orelha)
  7: { x: 0.51, y: 0.13, visibility: DEFAULT_VISIBILITY }, // leftEar
  8: { x: 0.5, y: 0.13, visibility: DEFAULT_VISIBILITY }, // rightEar
  11: { x: 0.51, y: 0.3, visibility: DEFAULT_VISIBILITY }, // leftShoulder
  12: { x: 0.5, y: 0.3, visibility: DEFAULT_VISIBILITY }, // rightShoulder
  13: { x: 0.53, y: 0.4, visibility: DEFAULT_VISIBILITY }, // leftElbow
  14: { x: 0.52, y: 0.4, visibility: DEFAULT_VISIBILITY }, // rightElbow
  15: { x: 0.55, y: 0.5, visibility: DEFAULT_VISIBILITY }, // leftWrist
  16: { x: 0.54, y: 0.5, visibility: DEFAULT_VISIBILITY }, // rightWrist
  23: { x: 0.51, y: 0.55, visibility: DEFAULT_VISIBILITY }, // leftHip
  24: { x: 0.5, y: 0.55, visibility: DEFAULT_VISIBILITY }, // rightHip
  25: { x: 0.51, y: 0.75, visibility: DEFAULT_VISIBILITY }, // leftKnee
  26: { x: 0.5, y: 0.75, visibility: DEFAULT_VISIBILITY }, // rightKnee
  27: { x: 0.51, y: 0.92, visibility: DEFAULT_VISIBILITY }, // leftAnkle
  28: { x: 0.5, y: 0.92, visibility: DEFAULT_VISIBILITY }, // rightAnkle
  29: { x: 0.48, y: 0.94, visibility: DEFAULT_VISIBILITY }, // leftHeel
  30: { x: 0.47, y: 0.94, visibility: DEFAULT_VISIBILITY }, // rightHeel
  31: { x: 0.56, y: 0.95, visibility: DEFAULT_VISIBILITY }, // leftFootIndex
  32: { x: 0.55, y: 0.95, visibility: DEFAULT_VISIBILITY }, // rightFootIndex
}

function buildSidePoseArray(
  overrides: Record<number, RawLandmark | undefined> = {},
): (RawLandmark | undefined)[] {
  const merged: Record<number, RawLandmark | undefined> = { ...RIGHT_SIDE_POSE_BASE, ...overrides }
  return Array.from({ length: 33 }, (_, index) => merged[index])
}

/** Perfil direito "bom": cabeça e tronco sobre a vertical. */
export const GOOD_RIGHT_SIDE_POSE = buildSidePoseArray()

/** Perfil direito com a cabeça projetada à frente do ombro (~17° da vertical). */
export const FORWARD_HEAD_SIDE_POSE = buildSidePoseArray({
  8: { x: 0.55, y: 0.13, visibility: DEFAULT_VISIBILITY },
})

/** A mesma pose frontal, porém rotulada como captura lateral — orientação incompatível. */
export const FRONTAL_POSE_LABELED_AS_SIDE = GOOD_FRONTAL_POSE
