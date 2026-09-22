import { useCallback, useState } from 'react'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { savePhoto } from '@/lib/storage/photoStorage'
import { toDomainLandmarks } from '../domain/landmarks'
import { computeMetricsForView } from '../domain/metrics'
import {
  POSTURAL_PROCESSING_VERSION,
  type PosturalAssessment,
  type PosturalCapture,
  type PosturalMetric,
  type PosturalView,
} from '../domain/posturalAssessment.types'
import {
  getCaptureForView,
  getMetricsForView,
  replaceMetrics,
  upsertViewCapture,
} from '../domain/posturalSession'
import { evaluateCaptureQuality } from '../domain/qualityGate'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { CameraCapture } from './CameraCapture'
import { CaptureInstructions } from './CaptureInstructions'
import { CaptureReview } from './CaptureReview'
import { ConsentStep } from './ConsentStep'
import { CorrectiveFindingsStep } from './CorrectiveFindingsStep'
import { ViewChecklist } from './ViewChecklist'
import { useCorrectivePrescription } from '../hooks/useCorrectivePrescription'

/**
 * Estados de UI mapeados a partir da lista completa exigida (idle, requesting_permission,
 * permission_denied, loading_model, model_ready, positioning, detecting, low_quality,
 * capturing, processing, success, error, camera_unavailable) — ver docs/POSTURAL_ASSESSMENT.md
 * para a tabela de correspondência. Alguns estados são consolidados porque este MVP processa
 * uma captura de cada vez (modo IMAGE), não um stream contínuo (modo VIDEO).
 *
 * O protocolo exige quatro capturas (frente, lateral esquerda, lateral direita e costas):
 * `checklist` é o hub que mostra o progresso e escolhe qual vista capturar; as demais fases
 * operam sempre sobre a vista ativa (`activeView`).
 */
type Phase = 'consent' | 'checklist' | 'instructions' | 'capture' | 'processing' | 'review' | 'findings'

type PosturalAssessmentFlowProps = {
  assessmentId: string
  posturalAssessment: PosturalAssessment | undefined
  onChange: (assessment: PosturalAssessment) => void
}

export function PosturalAssessmentFlow({
  assessmentId,
  posturalAssessment,
  onChange,
}: PosturalAssessmentFlowProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    posturalAssessment?.consentAccepted ? 'checklist' : 'consent',
  )
  const [activeView, setActiveView] = useState<PosturalView>('front')
  const [processingError, setProcessingError] = useState<string | null>(null)

  const { status: modelStatus, detect } = usePoseLandmarker()
  const activeCapture = getCaptureForView(posturalAssessment, activeView)
  const { status: correctiveStatus, suggestions, errorMessage: correctiveError } =
    useCorrectivePrescription(posturalAssessment)

  const handleConsentAccept = useCallback(() => {
    onChange({
      consentAccepted: true,
      captures: posturalAssessment?.captures ?? [],
      metrics: posturalAssessment?.metrics ?? [],
      processingVersion: POSTURAL_PROCESSING_VERSION,
      trainerSummary: posturalAssessment?.trainerSummary,
    })
    setPhase('checklist')
  }, [onChange, posturalAssessment])

  const handleSelectView = useCallback(
    (view: PosturalView) => {
      setActiveView(view)
      setProcessingError(null)
      setPhase(getCaptureForView(posturalAssessment, view) ? 'review' : 'instructions')
    },
    [posturalAssessment],
  )

  const handleCaptured = useCallback(
    async (blob: Blob) => {
      setPhase('processing')
      setProcessingError(null)
      try {
        const bitmap = await createImageBitmap(blob)
        const result = await detect(bitmap)
        bitmap.close()

        const landmarks = toDomainLandmarks(result.landmarks)
        const quality = evaluateCaptureQuality(landmarks, activeView)
        const metrics = computeMetricsForView(landmarks, quality, activeView)

        const storageKey = `${assessmentId}.postural.${activeView}`
        await savePhoto(storageKey, blob)

        const capture: PosturalCapture = {
          id: crypto.randomUUID(),
          view: activeView,
          imageReference: storageKey,
          createdAt: new Date().toISOString(),
          quality,
          landmarks: result.landmarks,
        }

        onChange(upsertViewCapture(posturalAssessment, capture, metrics))
        setPhase('review')
      } catch {
        setProcessingError(
          'Não foi possível processar a imagem. Tente novamente com melhor iluminação e enquadramento.',
        )
        setPhase('capture')
      }
    },
    [activeView, assessmentId, detect, onChange, posturalAssessment],
  )

  const handleMetricsChange = useCallback(
    (metrics: PosturalMetric[]) => {
      if (!posturalAssessment) return
      onChange(replaceMetrics(posturalAssessment, metrics))
    },
    [onChange, posturalAssessment],
  )

  if (phase === 'consent') {
    return <ConsentStep onAccept={handleConsentAccept} />
  }

  if (phase === 'checklist') {
    return (
      <ViewChecklist
        assessment={posturalAssessment}
        onSelectView={handleSelectView}
        onViewFindings={() => setPhase('findings')}
      />
    )
  }

  if (phase === 'instructions') {
    return (
      <CaptureInstructions
        view={activeView}
        onContinue={() => setPhase('capture')}
        onBack={() => setPhase('checklist')}
      />
    )
  }

  if (phase === 'capture') {
    return (
      <div className="flex flex-col gap-4">
        {modelStatus === 'loading' && <LoadingState label="Carregando modelo de pose…" />}
        {modelStatus === 'error' && (
          <ErrorState
            title="Não foi possível carregar o modelo de pose"
            description="Verifique sua conexão com a internet e tente novamente."
          />
        )}
        {processingError && (
          <ErrorState title="Falha ao processar a captura" description={processingError} />
        )}
        <CameraCapture view={activeView} onCaptured={(blob) => void handleCaptured(blob)} />
      </div>
    )
  }

  if (phase === 'processing') {
    return <LoadingState label="Processando pose…" />
  }

  if (phase === 'review' && activeCapture) {
    return (
      <CaptureReview
        capture={activeCapture}
        metrics={getMetricsForView(posturalAssessment, activeView)}
        onMetricsChange={handleMetricsChange}
        onRetake={() => setPhase('capture')}
        onBack={() => setPhase('checklist')}
      />
    )
  }

  if (phase === 'findings') {
    return (
      <CorrectiveFindingsStep
        suggestions={suggestions}
        status={correctiveStatus}
        errorMessage={correctiveError}
        onBack={() => setPhase('checklist')}
      />
    )
  }

  return <LoadingState />
}
