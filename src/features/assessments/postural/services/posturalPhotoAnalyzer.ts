import { generateId } from '@/lib/generateId'
import { savePhoto } from '@/lib/storage/photoStorage'
import { toDomainLandmarks } from '../domain/landmarks'
import { computeMetricsForView } from '../domain/metrics'
import type { PhotoAnalyzer } from '../domain/posturalBatchAnalysis'
import type { PosturalCapture } from '../domain/posturalAssessment.types'
import { evaluateCaptureQuality } from '../domain/qualityGate'
import type { PoseDetectionResult } from './mediapipePoseEstimator'

interface PosturalPhotoAnalyzerDeps {
  assessmentId: string
  detect: (image: ImageBitmap) => Promise<PoseDetectionResult>
}

/**
 * Análise real de uma foto: modelo de pose → quality gate → métricas da vista, e a imagem vai para
 * o IndexedDB (nunca Base64 no jsonb). Mesmo pipeline que a captura unitária usava; só mudou quem
 * chama (o lote em `analyzePosturalPhotos`).
 */
export function createPosturalPhotoAnalyzer({
  assessmentId,
  detect,
}: PosturalPhotoAnalyzerDeps): PhotoAnalyzer {
  return async (view, photo) => {
    const bitmap = await createImageBitmap(photo)
    let result: PoseDetectionResult
    try {
      result = await detect(bitmap)
    } finally {
      bitmap.close()
    }

    const landmarks = toDomainLandmarks(result.landmarks)
    const quality = evaluateCaptureQuality(landmarks, view)
    const metrics = computeMetricsForView(landmarks, quality, view)

    const storageKey = `${assessmentId}.postural.${view}`
    await savePhoto(storageKey, photo)

    const capture: PosturalCapture = {
      id: generateId(),
      view,
      imageReference: storageKey,
      createdAt: new Date().toISOString(),
      quality,
      landmarks: result.landmarks,
    }

    return { capture, metrics }
  }
}
