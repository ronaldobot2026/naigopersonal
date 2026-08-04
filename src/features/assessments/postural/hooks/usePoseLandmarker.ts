import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MediapipePoseEstimator,
  type PoseDetectionResult,
} from '../services/mediapipePoseEstimator'

export type PoseModelStatus = 'loading' | 'ready' | 'error'

interface UsePoseLandmarkerResult {
  status: PoseModelStatus
  detect: (image: ImageBitmap) => Promise<PoseDetectionResult>
}

/** Carrega o modelo de pose de forma lazy assim que o componente que usa este hook é montado. */
export function usePoseLandmarker(): UsePoseLandmarkerResult {
  const estimatorRef = useRef<MediapipePoseEstimator | null>(null)
  const [status, setStatus] = useState<PoseModelStatus>('loading')

  useEffect(() => {
    const estimator = new MediapipePoseEstimator()
    estimatorRef.current = estimator
    setStatus('loading')

    estimator
      .initialize()
      .then(() => setStatus('ready'))
      .catch(() => setStatus('error'))

    return () => {
      estimator.dispose()
    }
  }, [])

  const detect = useCallback(async (image: ImageBitmap): Promise<PoseDetectionResult> => {
    if (!estimatorRef.current) {
      throw new Error('Modelo de pose não inicializado.')
    }
    return estimatorRef.current.detect(image)
  }, [])

  return { status, detect }
}
