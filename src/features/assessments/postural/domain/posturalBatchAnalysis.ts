/**
 * Envio em lote das quatro fotos posturais: quais fotos vão para quais vistas, quando a análise
 * automática dispara e como o lote é processado.
 *
 * A análise de uma foto (decodificar, rodar o modelo de pose, quality gate, métricas, guardar a
 * imagem) é injetada como `PhotoAnalyzer`. Isso mantém esta orquestração pura de efeitos próprios
 * e testável sem MediaPipe. A implementação real fica em `services/posturalPhotoAnalyzer.ts`.
 */
import type {
  PosturalAssessment,
  PosturalCapture,
  PosturalMetric,
  PosturalView,
} from './posturalAssessment.types'
import { createEmptyPosturalAssessment, getCaptureForView, upsertViewCapture } from './posturalSession'
import { POSTURAL_VIEWS } from './posturalViews'

/** Fotos escolhidas pelo treinador e ainda não analisadas, por vista. */
export type PendingPhotos = Partial<Record<PosturalView, Blob>>

export type PhotoAnalyzer = (
  view: PosturalView,
  photo: Blob,
) => Promise<{ capture: PosturalCapture; metrics: PosturalMetric[] }>

export interface BatchAnalysisOutcome {
  assessment: PosturalAssessment
  /** Vistas cuja foto não pôde nem ser processada (arquivo inválido, falha do modelo). */
  errors: Partial<Record<PosturalView, string>>
}

const PROCESSING_ERROR_MESSAGE =
  'Não foi possível processar esta imagem. Envie outra foto com melhor iluminação e enquadramento.'

function hasApprovedCapture(assessment: PosturalAssessment | undefined, view: PosturalView): boolean {
  return getCaptureForView(assessment, view)?.quality.passed === true
}

/**
 * Um lote com quatro fotos (ou mais) cobre o protocolo inteiro: preenche as quatro vistas na ordem
 * canônica, substituindo o que houver — é o "refazer tudo". Com menos de quatro, as fotos
 * preenchem só as vistas em aberto (sem captura aprovada e sem foto já escolhida), na mesma ordem.
 */
export function assignPhotosToViews(
  files: Blob[],
  assessment: PosturalAssessment | undefined,
  pending: PendingPhotos,
): PendingPhotos {
  const targets =
    files.length >= POSTURAL_VIEWS.length
      ? POSTURAL_VIEWS
      : POSTURAL_VIEWS.filter((view) => !pending[view] && !hasApprovedCapture(assessment, view))

  const assigned: PendingPhotos = {}
  targets.forEach((view, index) => {
    const file = files[index]
    if (file) assigned[view] = file
  })
  return assigned
}

/**
 * A análise dispara sozinha quando as quatro vistas estão cobertas — cada uma por uma foto nova
 * ou por uma captura já aprovada — e existe ao menos uma foto nova para analisar.
 */
export function isReadyForAutomaticAnalysis(
  assessment: PosturalAssessment | undefined,
  pending: PendingPhotos,
): boolean {
  const hasNewPhoto = POSTURAL_VIEWS.some((view) => pending[view])
  const allCovered = POSTURAL_VIEWS.every(
    (view) => pending[view] !== undefined || hasApprovedCapture(assessment, view),
  )
  return hasNewPhoto && allCovered
}

/**
 * Analisa as fotos em sequência (o modelo de pose é uma instância única em modo IMAGE) e compõe o
 * resultado sobre `base`, preservando as vistas que não receberam foto nova. Uma foto que falha
 * no processamento vira erro daquela vista e não interrompe as demais. Reprovar no quality gate
 * não é erro: a captura é gravada com `quality.passed = false` e a UI pede outra foto.
 */
export async function analyzePosturalPhotos(
  base: PosturalAssessment | undefined,
  photos: PendingPhotos,
  analyze: PhotoAnalyzer,
  onViewStart?: (view: PosturalView) => void,
): Promise<BatchAnalysisOutcome> {
  // Enviar as fotos só é possível depois do consentimento, então a base vazia já nasce com ele.
  let assessment = base ?? { ...createEmptyPosturalAssessment(), consentAccepted: true }
  const errors: BatchAnalysisOutcome['errors'] = {}

  for (const view of POSTURAL_VIEWS) {
    const photo = photos[view]
    if (!photo) continue

    onViewStart?.(view)
    try {
      const { capture, metrics } = await analyze(view, photo)
      assessment = upsertViewCapture(assessment, capture, metrics)
    } catch {
      errors[view] = PROCESSING_ERROR_MESSAGE
    }
  }

  return { assessment, errors }
}
