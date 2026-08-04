import { useEffect, useRef } from 'react'
import { BODY_SEGMENT_CONNECTIONS, type PoseLandmarks } from '../domain/landmarks'
import type { PosturalView } from '../domain/posturalAssessment.types'
import { SIDE_VIEW_LANDMARKS, getPosturalViewDefinition } from '../domain/posturalViews'

type SkeletonOverlayProps = {
  landmarks: PoseLandmarks
  view: PosturalView
  width: number
  height: number
  showSkeleton: boolean
  showReferenceLines: boolean
}

const SKELETON_COLOR = '#cbc6b8'
const JOINT_COLOR = '#f2ca50'
const REFERENCE_COLOR = 'rgba(255, 180, 171, 0.8)'

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmarks,
  width: number,
  height: number,
): void {
  ctx.strokeStyle = SKELETON_COLOR
  ctx.lineWidth = 2
  for (const [a, b] of BODY_SEGMENT_CONNECTIONS) {
    const pointA = landmarks[a]
    const pointB = landmarks[b]
    if (!pointA || !pointB) continue
    ctx.beginPath()
    ctx.moveTo(pointA.x * width, pointA.y * height)
    ctx.lineTo(pointB.x * width, pointB.y * height)
    ctx.stroke()
  }

  ctx.fillStyle = JOINT_COLOR
  for (const point of Object.values(landmarks)) {
    if (!point) continue
    ctx.beginPath()
    ctx.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Frente e costas: linhas horizontais de ombros e quadris + eixo vertical central. */
function drawBilateralReferences(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmarks,
  width: number,
  height: number,
): void {
  const { leftShoulder, rightShoulder, leftHip, rightHip } = landmarks

  if (leftShoulder && rightShoulder) {
    ctx.beginPath()
    ctx.moveTo(leftShoulder.x * width, leftShoulder.y * height)
    ctx.lineTo(rightShoulder.x * width, rightShoulder.y * height)
    ctx.stroke()

    const centerX = ((leftShoulder.x + rightShoulder.x) / 2) * width
    ctx.beginPath()
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, height)
    ctx.stroke()
  }

  if (leftHip && rightHip) {
    ctx.beginPath()
    ctx.moveTo(leftHip.x * width, leftHip.y * height)
    ctx.lineTo(rightHip.x * width, rightHip.y * height)
    ctx.stroke()
  }
}

/** Laterais: linha de prumo a partir do tornozelo, referência visual para cabeça e tronco. */
function drawSideReferences(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmarks,
  side: 'left' | 'right',
  width: number,
  height: number,
): void {
  const points = SIDE_VIEW_LANDMARKS[side]
  const ankle = landmarks[points.ankle]
  if (!ankle) return

  const plumbX = ankle.x * width
  ctx.beginPath()
  ctx.moveTo(plumbX, 0)
  ctx.lineTo(plumbX, height)
  ctx.stroke()

  for (const name of [points.ear, points.shoulder, points.hip] as const) {
    const point = landmarks[name]
    if (!point) continue
    ctx.beginPath()
    ctx.moveTo(plumbX, point.y * height)
    ctx.lineTo(point.x * width, point.y * height)
    ctx.stroke()
  }
}

/**
 * Desenha o skeleton e as linhas de referência sobre a imagem capturada, adaptadas à vista.
 * Coordenadas dos landmarks são normalizadas [0,1] e a imagem NÃO é espelhada
 * (o espelhamento é aplicado apenas ao <video> ao vivo, via CSS, para conforto do usuário —
 * ver CameraCapture.tsx e docs/POSTURAL_ASSESSMENT.md).
 */
export function SkeletonOverlay({
  landmarks,
  view,
  width,
  height,
  showSkeleton,
  showReferenceLines,
}: SkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0 || height === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    if (showSkeleton) {
      drawSkeleton(ctx, landmarks, width, height)
    }

    if (showReferenceLines) {
      ctx.strokeStyle = REFERENCE_COLOR
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])

      const side = getPosturalViewDefinition(view).side
      if (side) {
        drawSideReferences(ctx, landmarks, side, width, height)
      } else {
        drawBilateralReferences(ctx, landmarks, width, height)
      }

      ctx.setLineDash([])
    }
  }, [landmarks, view, width, height, showSkeleton, showReferenceLines])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}
