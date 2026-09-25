import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  analyzePosturalPhotos,
  assignPhotosToViews,
  isReadyForAutomaticAnalysis,
  type PendingPhotos,
} from '../domain/posturalBatchAnalysis'
import {
  POSTURAL_PROCESSING_VERSION,
  type PosturalAssessment,
  type PosturalView,
} from '../domain/posturalAssessment.types'
import { getCaptureForView, isPosturalAssessmentComplete } from '../domain/posturalSession'
import { POSTURAL_VIEWS } from '../domain/posturalViews'
import { useCorrectivePrescription } from '../hooks/useCorrectivePrescription'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { usePublishCorrectivePlan } from '../hooks/usePublishCorrectivePlan'
import { createPosturalPhotoAnalyzer } from '../services/posturalPhotoAnalyzer'
import { CameraCapture } from './CameraCapture'
import { ConsentStep } from './ConsentStep'
import { CorrectiveFindingsStep } from './CorrectiveFindingsStep'
import { PosturalPhotoUpload, type PhotoSlot } from './PosturalPhotoUpload'
import { PosturalViewMeasurements } from './PosturalViewMeasurements'

/**
 * Fluxo da avaliação postural em três telas (docs/POSTURAL_ASSESSMENT.md):
 *
 * - `consent`: autorização de uso da imagem;
 * - `upload`: as quatro fotos numa tela só (galeria em lote ou por vista; câmera como opção em
 *   `camera`). Quando as quatro vistas estão cobertas, a análise roda sozinha, sem botão;
 * - `report`: relatório completo — pontos de atenção com o ângulo em destaque, exercícios
 *   sugeridos, medições por vista (foto + skeleton + todas as métricas) e publicação do plano.
 *
 * Foto recusada no quality gate ou que falhou no processamento mantém o fluxo em `upload`,
 * mostrando o motivo naquela vista; trocar só ela reanalisa só ela.
 */
type Phase = 'consent' | 'upload' | 'camera' | 'report'

type PosturalAssessmentFlowProps = {
  assessmentId: string
  studentId: string
  /** Treinador autenticado (`auth.uid()`) — a RLS de `corrective_plans` exige que seja ele o autor. */
  evaluatorId: string
  posturalAssessment: PosturalAssessment | undefined
  onChange: (assessment: PosturalAssessment) => void
}

function initialPhase(assessment: PosturalAssessment | undefined): Phase {
  if (!assessment?.consentAccepted) return 'consent'
  return isPosturalAssessmentComplete(assessment) ? 'report' : 'upload'
}

/** Miniaturas das fotos ainda não analisadas; as Object URLs são revogadas quando o lote muda. */
function usePreviewUrls(photos: PendingPhotos): Partial<Record<PosturalView, string>> {
  const urls = useMemo(() => {
    const next: Partial<Record<PosturalView, string>> = {}
    for (const view of POSTURAL_VIEWS) {
      const photo = photos[view]
      if (photo) next[view] = URL.createObjectURL(photo)
    }
    return next
  }, [photos])

  useEffect(
    () => () => {
      for (const url of Object.values(urls)) URL.revokeObjectURL(url)
    },
    [urls],
  )

  return urls
}

export function PosturalAssessmentFlow({
  assessmentId,
  studentId,
  evaluatorId,
  posturalAssessment,
  onChange,
}: PosturalAssessmentFlowProps) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(posturalAssessment))
  const [cameraView, setCameraView] = useState<PosturalView>('front')
  const [pending, setPending] = useState<PendingPhotos>({})
  const [analyzingView, setAnalyzingView] = useState<PosturalView | null>(null)
  const [errors, setErrors] = useState<Partial<Record<PosturalView, string>>>({})
  const analyzingRef = useRef(false)
  const mountedRef = useRef(true)

  const { status: modelStatus, detect } = usePoseLandmarker()
  const analyzer = useMemo(
    () => createPosturalPhotoAnalyzer({ assessmentId, detect }),
    [assessmentId, detect],
  )
  const previewUrls = usePreviewUrls(pending)
  const { status: correctiveStatus, suggestions, errorMessage: correctiveError } =
    useCorrectivePrescription(posturalAssessment)
  const {
    status: publishStatus,
    errorMessage: publishError,
    publish,
    reset: resetPublish,
  } = usePublishCorrectivePlan()

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Análise automática: dispara assim que as quatro vistas estão cobertas e o modelo carregou.
  useEffect(() => {
    if (phase !== 'upload' || modelStatus !== 'ready' || analyzingRef.current) return
    if (!isReadyForAutomaticAnalysis(posturalAssessment, pending)) return

    analyzingRef.current = true
    void analyzePosturalPhotos(posturalAssessment, pending, analyzer, setAnalyzingView).then(
      ({ assessment, errors: batchErrors }) => {
        analyzingRef.current = false
        if (!mountedRef.current) return
        setAnalyzingView(null)
        setPending({})
        setErrors(batchErrors)
        onChange(assessment)
        if (isPosturalAssessmentComplete(assessment)) {
          // Relatório novo parte de "não publicado": as sugestões podem ter mudado.
          resetPublish()
          setPhase('report')
        }
      },
    )
  }, [analyzer, modelStatus, onChange, pending, phase, posturalAssessment, resetPublish])

  const selectPhotos = useCallback((assigned: PendingPhotos) => {
    setPending((current) => ({ ...current, ...assigned }))
    setErrors((current) => {
      const next = { ...current }
      for (const view of Object.keys(assigned) as PosturalView[]) delete next[view]
      return next
    })
  }, [])

  const handleConsentAccept = useCallback(() => {
    const accepted: PosturalAssessment = {
      consentAccepted: true,
      captures: posturalAssessment?.captures ?? [],
      metrics: posturalAssessment?.metrics ?? [],
      processingVersion: POSTURAL_PROCESSING_VERSION,
      trainerSummary: posturalAssessment?.trainerSummary,
    }
    onChange(accepted)
    setPhase(initialPhase(accepted))
  }, [onChange, posturalAssessment])

  const handlePublish = useCallback(() => {
    void publish({ suggestions, assessmentId, studentId, evaluatorId })
  }, [assessmentId, evaluatorId, publish, studentId, suggestions])

  if (phase === 'consent') {
    return <ConsentStep onAccept={handleConsentAccept} />
  }

  if (phase === 'camera') {
    return (
      <div className="flex flex-col gap-4">
        <CameraCapture
          view={cameraView}
          onCaptured={(blob) => {
            selectPhotos({ [cameraView]: blob })
            setPhase('upload')
          }}
        />
        <Button variant="secondary" onClick={() => setPhase('upload')} className="self-center">
          Voltar às fotos
        </Button>
      </div>
    )
  }

  if (phase === 'report' && posturalAssessment) {
    return (
      <CorrectiveFindingsStep
        suggestions={suggestions}
        status={correctiveStatus}
        errorMessage={correctiveError}
        onRetakePhotos={() => setPhase('upload')}
        onPublish={handlePublish}
        publishStatus={publishStatus}
        publishErrorMessage={publishError}
        measurements={
          <PosturalViewMeasurements assessment={posturalAssessment} onMetricsChange={onChange} />
        }
      />
    )
  }

  const analyzingIndex = analyzingView ? POSTURAL_VIEWS.indexOf(analyzingView) : -1
  const slots: PhotoSlot[] = POSTURAL_VIEWS.map((view, index) => {
    const capture = getCaptureForView(posturalAssessment, view)
    const previewUrl = previewUrls[view]
    if (view === analyzingView) return { view, status: 'analyzing', previewUrl }
    if (pending[view]) {
      // O lote roda na ordem canônica: as vistas antes da atual já foram analisadas.
      return { view, status: index < analyzingIndex ? 'done' : 'selected', previewUrl }
    }
    const error = errors[view]
    if (error) return { view, status: 'error', messages: [error] }
    if (capture?.quality.passed) return { view, status: 'done' }
    if (capture) return { view, status: 'low_quality', messages: capture.quality.reasons }
    return { view, status: 'empty' }
  })

  return (
    <PosturalPhotoUpload
      slots={slots}
      modelStatus={modelStatus}
      analyzingView={analyzingView}
      onSelectPhotos={(files) => selectPhotos(assignPhotosToViews(files, posturalAssessment, pending))}
      onSelectPhoto={(view, file) => selectPhotos({ [view]: file })}
      onRemovePhoto={(view) => setPending((current) => { const next = { ...current }; delete next[view]; return next })}
      onUseCamera={(view) => {
        setCameraView(view)
        setPhase('camera')
      }}
    />
  )
}
