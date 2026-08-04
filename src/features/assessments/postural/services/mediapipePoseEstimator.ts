import type { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { RawLandmark } from '../domain/landmarks'

export interface PoseDetectionResult {
  detected: boolean
  /** Array bruto de 33 landmarks (ou vazio se nada foi detectado) — ver domain/landmarks.ts. */
  landmarks: RawLandmark[]
}

/**
 * Implementação concreta de PoseEstimator usando @mediapipe/tasks-vision (BlazePose,
 * variante "lite"). Carrega o runtime WASM e o modelo (~poucos MB) sob demanda (lazy),
 * apenas quando `initialize()` é chamado pela primeira vez.
 *
 * O pacote @mediapipe/tasks-vision em si é importado dinamicamente (`import()`), gerando um
 * chunk separado do bundle principal — só é baixado quando o treinador abre a aba de Avaliação
 * Postural (ver web/performance.md: bibliotecas pesadas devem ser carregadas dinamicamente).
 * O WASM e o arquivo do modelo, por sua vez, vêm dos CDNs oficiais do MediaPipe/Google — são
 * artefatos binários de ML, não fazem parte do bundle da aplicação (ver docs/DECISIONS.md).
 * O modo de execução é fixo em "IMAGE": processamos um frame já capturado por vez, não um
 * stream de vídeo contínuo (ver docs/POSTURAL_ASSESSMENT.md sobre este recorte do MVP).
 */
const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'

type VisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>

export class MediapipePoseEstimator {
  private landmarker: PoseLandmarker | null = null
  private initPromise: Promise<void> | null = null

  async initialize(): Promise<void> {
    if (this.landmarker) return
    if (!this.initPromise) {
      this.initPromise = this.load().catch((error: unknown) => {
        this.initPromise = null
        throw error
      })
    }
    await this.initPromise
  }

  private async load(): Promise<void> {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL)
    try {
      this.landmarker = await this.createLandmarker(PoseLandmarker, vision, 'GPU')
    } catch {
      // Nem todo navegador/dispositivo expõe aceleração de GPU via WebGL — recua para CPU.
      this.landmarker = await this.createLandmarker(PoseLandmarker, vision, 'CPU')
    }
  }

  private createLandmarker(
    poseLandmarkerClass: typeof PoseLandmarker,
    vision: VisionFileset,
    delegate: 'GPU' | 'CPU',
  ): Promise<PoseLandmarker> {
    return poseLandmarkerClass.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_ASSET_URL, delegate },
      runningMode: 'IMAGE',
      numPoses: 1,
    })
  }

  async detect(image: ImageBitmap): Promise<PoseDetectionResult> {
    if (!this.landmarker) {
      throw new Error('PoseEstimator não inicializado. Chame initialize() antes de detect().')
    }
    const result = this.landmarker.detect(image)
    const landmarks = result.landmarks[0] ?? []
    return { detected: landmarks.length > 0, landmarks }
  }

  dispose(): void {
    this.landmarker?.close()
    this.landmarker = null
    this.initPromise = null
  }
}
