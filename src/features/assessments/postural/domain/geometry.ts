/**
 * Funções geométricas puras usadas pela Avaliação Postural.
 *
 * Convenção de coordenadas: espaço normalizado da imagem (x cresce para a direita,
 * y cresce para baixo — origem no canto superior esquerdo), igual à saída do
 * Pose Landmarker. Nenhuma função aqui depende de React, canvas ou do modelo de pose.
 */
import type { Point2D } from './landmarks'

const RAD_TO_DEG = 180 / Math.PI

/** Distância euclidiana entre dois pontos. */
export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Ponto médio entre dois pontos. */
export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Dobra um ângulo em graus para o intervalo (-90, 90], tratando a linha como não-direcional. */
function foldToLineAngle(angleDeg: number): number {
  let folded = angleDeg
  if (folded > 90) folded -= 180
  if (folded <= -90) folded += 180
  return folded
}

/**
 * Inclinação do segmento a→b em relação à horizontal, em graus, no intervalo (-90, 90].
 * Sinal positivo indica que `b` está mais baixo que `a` na imagem (y maior).
 */
export function slopeDegrees(a: Point2D, b: Point2D): number {
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * RAD_TO_DEG
  return foldToLineAngle(angle)
}

/** Desvio absoluto do segmento a→b em relação à horizontal, em graus [0, 90]. */
export function deviationFromHorizontal(a: Point2D, b: Point2D): number {
  return Math.abs(slopeDegrees(a, b))
}

/** Desvio absoluto do segmento a→b em relação à vertical, em graus [0, 90]. */
export function deviationFromVertical(a: Point2D, b: Point2D): number {
  const angle = Math.atan2(b.x - a.x, b.y - a.y) * RAD_TO_DEG
  return Math.abs(foldToLineAngle(angle))
}

/**
 * Ângulo em graus [0, 180] formado no vértice pelos raios vértice→a e vértice→c.
 * Lança erro se algum dos raios tiver comprimento zero (pontos coincidentes com o vértice),
 * pois o ângulo não é geometricamente definido nesse caso.
 */
export function angleBetweenPoints(a: Point2D, vertex: Point2D, c: Point2D): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y }
  const v2 = { x: c.x - vertex.x, y: c.y - vertex.y }
  const mag1 = Math.hypot(v1.x, v1.y)
  const mag2 = Math.hypot(v2.x, v2.y)

  if (mag1 === 0 || mag2 === 0) {
    throw new Error(
      'angleBetweenPoints: não é possível calcular o ângulo com pontos coincidentes ao vértice.',
    )
  }

  const dot = v1.x * v2.x + v1.y * v2.y
  const cos = Math.min(1, Math.max(-1, dot / (mag1 * mag2)))
  return Math.acos(cos) * RAD_TO_DEG
}

/**
 * Normaliza um valor absoluto por um comprimento de referência (ex.: tamanho do tronco),
 * retornando uma razão adimensional comparável entre corpos e enquadramentos diferentes.
 */
export function normalizeBySize(value: number, referenceLength: number): number {
  if (referenceLength <= 0) {
    throw new Error('normalizeBySize: referenceLength deve ser maior que zero.')
  }
  return value / referenceLength
}

export interface BilateralComparison {
  /** right - left, preserva o sinal (qual lado está maior/mais alto). */
  difference: number
  /** |right - left| / média(|left|, |right|) — 0 quando idênticos, cresce com a assimetria. */
  asymmetryRatio: number
}

/** Compara uma métrica entre os lados esquerdo e direito do corpo. */
export function bilateralComparison(left: number, right: number): BilateralComparison {
  const difference = right - left
  const averageMagnitude = (Math.abs(left) + Math.abs(right)) / 2
  const asymmetryRatio = averageMagnitude === 0 ? 0 : Math.abs(difference) / averageMagnitude
  return { difference, asymmetryRatio }
}
