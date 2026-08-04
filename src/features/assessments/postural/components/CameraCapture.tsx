import { useEffect, useRef, useState } from 'react'
import { CameraPermissionState } from '@/components/feedback/CameraPermissionState'
import { Button } from '@/components/ui/Button'
import type { PosturalView } from '../domain/posturalAssessment.types'
import { getPosturalViewDefinition } from '../domain/posturalViews'
import { useCameraStream } from '../hooks/useCameraStream'
import { SilhouetteGuide } from './SilhouetteGuide'

type CameraCaptureProps = {
  view: PosturalView
  onCaptured: (blob: Blob) => void
}

/**
 * Câmera com preview espelhado nas vistas de frente e costas (conforto visual do usuário) e
 * não espelhado nas laterais, onde o espelhamento inverteria o lado que a pessoa deve mostrar.
 * O frame capturado para análise é sempre o cru da câmera, nunca espelhado, para manter
 * esquerda/direita anatômicas consistentes com os cálculos de domínio
 * (ver docs/POSTURAL_ASSESSMENT.md).
 */
export function CameraCapture({ view, onCaptured }: CameraCaptureProps) {
  const definition = getPosturalViewDefinition(view)
  const { videoRef, status, start, stop } = useCameraStream()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    void start()
    return () => stop()
  }, [start, stop])

  function handleCapture(): void {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return

    setIsCapturing(true)
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setIsCapturing(false)
      return
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        setIsCapturing(false)
        if (blob) onCaptured(blob)
      },
      'image/jpeg',
      0.92,
    )
  }

  if (status === 'denied') {
    return (
      <CameraPermissionState
        status="denied"
        onRequestAccess={() => void start()}
        onUseUploadInstead={() => fileInputRef.current?.click()}
      />
    )
  }

  if (status === 'unavailable') {
    return (
      <CameraPermissionState
        status="unavailable"
        onUseUploadInstead={() => fileInputRef.current?.click()}
      />
    )
  }

  const isMirrored = definition.silhouette === 'facing'

  return (
    <div className="flex flex-col gap-4">
      {status === 'requesting' && <CameraPermissionState status="requesting" />}

      <p className="text-center text-sm text-text-secondary">
        <span className="font-bold text-text-primary">{definition.label}</span> —{' '}
        {definition.positioning}
      </p>

      <div className="relative aspect-3/4 w-full max-w-sm self-center overflow-hidden rounded-lg border border-border bg-surface-high">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`h-full w-full object-cover ${isMirrored ? '-scale-x-100' : ''}`}
        />
        <SilhouetteGuide kind={definition.silhouette} />
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-col items-center gap-2">
        <Button onClick={handleCapture} disabled={status !== 'active' || isCapturing}>
          {isCapturing ? 'Capturando…' : 'Capturar'}
        </Button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="font-mono text-xs uppercase tracking-wider text-text-secondary underline hover:text-action-primary"
        >
          Ou enviar foto da galeria
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onCaptured(file)
          }}
        />
      </div>
    </div>
  )
}
