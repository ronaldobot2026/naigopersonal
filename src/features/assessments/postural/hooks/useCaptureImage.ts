import { useEffect, useState } from 'react'
import { loadPhoto } from '@/lib/storage/photoStorage'
import type { PosturalCapture } from '../domain/posturalAssessment.types'

export interface CaptureImage {
  url: string
  width: number
  height: number
}

/**
 * Carrega a imagem de uma captura a partir do IndexedDB e devolve uma Object URL com as
 * dimensões reais do arquivo (necessárias para posicionar o overlay de skeleton).
 *
 * A URL é revogada ao trocar de captura e ao desmontar. A dependência inclui `capture.id`
 * porque recapturar a mesma vista reaproveita a mesma chave de armazenamento — sem isso, a
 * imagem antiga continuaria na tela.
 */
export function useCaptureImage(capture: PosturalCapture | undefined): CaptureImage | undefined {
  const captureId = capture?.id
  const reference = capture?.imageReference
  const [image, setImage] = useState<CaptureImage | undefined>()

  useEffect(() => {
    setImage(undefined)

    const storageKey = reference
    if (!storageKey) return

    let cancelled = false
    let objectUrl: string | undefined

    async function load(key: string): Promise<void> {
      const blob = await loadPhoto(key)
      if (!blob || cancelled) return

      const bitmap = await createImageBitmap(blob)
      if (cancelled) {
        bitmap.close()
        return
      }

      objectUrl = URL.createObjectURL(blob)
      setImage({ url: objectUrl, width: bitmap.width, height: bitmap.height })
      bitmap.close()
    }

    void load(storageKey)

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [reference, captureId])

  return image
}
