import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStreamStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable'

interface UseCameraStreamResult {
  videoRef: React.RefObject<HTMLVideoElement | null>
  status: CameraStreamStatus
  start: () => Promise<void>
  stop: () => void
}

/** Gerencia o ciclo de vida do stream de câmera — sempre encerra o stream ao desmontar. */
export function useCameraStream(): UseCameraStreamResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStreamStatus>('idle')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      return
    }

    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('active')
    } catch {
      setStatus('denied')
    }
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { videoRef, status, start, stop }
}
