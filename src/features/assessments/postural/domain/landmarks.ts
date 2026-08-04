/**
 * Nomes semânticos dos pontos articulares e adaptador de índices.
 *
 * O modelo de pose (BlazePose, via @mediapipe/tasks-vision) retorna um array de 33 pontos
 * indexados numericamente. Nenhum outro módulo do domínio ou da UI deve conhecer esses
 * números — tudo passa por `toDomainLandmarks`, que traduz índice → nome semântico.
 */

export interface Point2D {
  x: number
  y: number
}

export interface NormalizedLandmark extends Point2D {
  z?: number
  visibility?: number
}

/** Estrutura mínima aceita na entrada do adaptador — deliberadamente não importa o tipo da lib. */
export interface RawLandmark {
  x: number
  y: number
  z?: number
  visibility?: number
}

export const LANDMARK_NAMES = [
  'nose',
  'leftEar',
  'rightEar',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
  'leftHeel',
  'rightHeel',
  'leftFootIndex',
  'rightFootIndex',
] as const

export type LandmarkName = (typeof LANDMARK_NAMES)[number]

/** Índice do ponto no array de 33 landmarks do BlazePose/Pose Landmarker. */
export const MEDIAPIPE_POSE_LANDMARK_INDEX: Record<LandmarkName, number> = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
}

export type PoseLandmarks = Record<LandmarkName, NormalizedLandmark | undefined>

/** Converte o array bruto (indexado por posição) do modelo em um mapa por nome semântico. */
export function toDomainLandmarks(
  raw: ReadonlyArray<RawLandmark | undefined> | undefined | null,
): PoseLandmarks {
  const result = {} as Record<LandmarkName, NormalizedLandmark | undefined>

  for (const name of LANDMARK_NAMES) {
    const index = MEDIAPIPE_POSE_LANDMARK_INDEX[name]
    const point = raw?.[index]
    result[name] = point
      ? { x: point.x, y: point.y, z: point.z, visibility: point.visibility }
      : undefined
  }

  return result
}

export const BODY_SEGMENT_CONNECTIONS: ReadonlyArray<readonly [LandmarkName, LandmarkName]> = [
  ['leftShoulder', 'rightShoulder'],
  ['leftHip', 'rightHip'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
  ['leftAnkle', 'leftHeel'],
  ['leftHeel', 'leftFootIndex'],
  ['rightAnkle', 'rightHeel'],
  ['rightHeel', 'rightFootIndex'],
  ['leftEar', 'leftShoulder'],
  ['rightEar', 'rightShoulder'],
]
