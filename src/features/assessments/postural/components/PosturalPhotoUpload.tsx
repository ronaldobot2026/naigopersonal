import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { PosturalView } from '../domain/posturalAssessment.types'
import { POSTURAL_VIEWS, getPosturalViewDefinition } from '../domain/posturalViews'
import type { PoseModelStatus } from '../hooks/usePoseLandmarker'

export type PhotoSlotStatus = 'empty' | 'selected' | 'analyzing' | 'done' | 'low_quality' | 'error'

export interface PhotoSlot {
  view: PosturalView
  status: PhotoSlotStatus
  /** Miniatura da foto escolhida (Object URL), quando houver. */
  previewUrl?: string
  /** Motivos de recusa (quality gate) ou erro de processamento. */
  messages?: string[]
}

type PosturalPhotoUploadProps = {
  slots: PhotoSlot[]
  modelStatus: PoseModelStatus
  analyzingView: PosturalView | null
  onSelectPhotos: (files: File[]) => void
  onSelectPhoto: (view: PosturalView, file: File) => void
  onRemovePhoto: (view: PosturalView) => void
  onUseCamera: (view: PosturalView) => void
}

const STATUS_LABEL: Record<PhotoSlotStatus, string> = {
  empty: 'Aguardando foto',
  selected: 'Foto escolhida',
  analyzing: 'Analisando…',
  done: 'Analisada',
  low_quality: 'Enviar outra',
  error: 'Enviar outra',
}

const STATUS_TONE: Record<PhotoSlotStatus, 'neutral' | 'informative' | 'success' | 'warning' | 'error'> =
  {
    empty: 'neutral',
    selected: 'informative',
    analyzing: 'informative',
    done: 'success',
    low_quality: 'warning',
    error: 'error',
  }

/**
 * Envio das quatro fotos da avaliação postural numa única tela (docs/POSTURAL_ASSESSMENT.md).
 * O caminho principal é a galeria — em lote ou por vista —; a câmera fica como opção por vista.
 * Não existe botão "analisar": o fluxo dispara a análise sozinho quando as quatro vistas estão
 * cobertas (ver `isReadyForAutomaticAnalysis`). Componente apresentacional.
 */
export function PosturalPhotoUpload({
  slots,
  modelStatus,
  analyzingView,
  onSelectPhotos,
  onSelectPhoto,
  onRemovePhoto,
  onUseCamera,
}: PosturalPhotoUploadProps) {
  const isAnalyzing = analyzingView !== null
  const analyzedCount = slots.filter(
    (slot) => slot.status === 'done' || slot.status === 'low_quality',
  ).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-lg text-text-primary">Fotos da avaliação postural</h3>
        <p className="text-sm text-text-secondary">
          Envie as quatro fotos — frente, lateral esquerda, lateral direita e costas. A análise
          começa sozinha assim que todas estiverem aqui.
        </p>
      </div>

      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-md bg-action-primary px-6 py-3 text-sm font-medium text-action-primary-foreground shadow-glass-sm ${isAnalyzing ? 'pointer-events-none opacity-50' : ''}`}
      >
        <Icon name="photo_library" />
        Selecionar as 4 fotos da galeria
        <input
          type="file"
          accept="image/*"
          multiple
          aria-label="Selecionar as 4 fotos da galeria"
          disabled={isAnalyzing}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (files.length > 0) onSelectPhotos(files)
          }}
        />
      </label>
      <p className="text-center text-xs text-text-secondary">
        Em lote, as fotos entram na ordem frente → lateral esquerda → lateral direita → costas.
        Confira as miniaturas; dá para trocar qualquer uma.
      </p>

      {modelStatus === 'loading' && <LoadingState label="Carregando modelo de pose…" />}
      {modelStatus === 'error' && (
        <ErrorState
          title="Não foi possível carregar o modelo de pose"
          description="Verifique sua conexão com a internet e recarregue a página."
        />
      )}

      {isAnalyzing && (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <p className="text-sm text-text-primary">
            Analisando {getPosturalViewDefinition(analyzingView).label.toLowerCase()}… ({analyzedCount}{' '}
            de {POSTURAL_VIEWS.length})
          </p>
          <ProgressBar
            value={(analyzedCount / POSTURAL_VIEWS.length) * 100}
            label={`Análise postural — ${analyzedCount} de ${POSTURAL_VIEWS.length}`}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {slots.map((slot) => {
          const definition = getPosturalViewDefinition(slot.view)
          const hasPhoto = slot.status !== 'empty'
          return (
            <Card key={slot.view} tone="glass" className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-text-primary">{definition.label}</p>
                <Badge tone={STATUS_TONE[slot.status]}>{STATUS_LABEL[slot.status]}</Badge>
              </div>

              <div className="relative flex aspect-3/4 w-full items-center justify-center overflow-hidden rounded-md border border-border bg-surface-high">
                {slot.previewUrl ? (
                  <img
                    src={slot.previewUrl}
                    alt={`Foto enviada — ${definition.label.toLowerCase()}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Icon
                    name={slot.status === 'done' ? 'check_circle' : 'add_photo_alternate'}
                    className={slot.status === 'done' ? 'text-success' : 'text-text-secondary'}
                  />
                )}
                {slot.previewUrl && !isAnalyzing && (
                  <IconButton
                    icon="delete"
                    label="Remover foto"
                    onClick={() => onRemovePhoto(slot.view)}
                    className="absolute right-1 top-1 bg-surface-elevated/80 text-error backdrop-blur-sm hover:bg-error/20"
                  />
                )}
              </div>

              <p className="text-xs text-text-secondary">{definition.positioning}</p>

              {slot.messages && slot.messages.length > 0 && (
                <ul className="list-disc space-y-1 pl-4 text-xs text-warning">
                  {slot.messages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-between gap-2">
                <label
                  className={`cursor-pointer font-mono text-xs uppercase tracking-wider text-action-primary underline ${isAnalyzing ? 'pointer-events-none opacity-50' : ''}`}
                >
                  {hasPhoto ? 'Trocar foto' : 'Escolher foto'}
                  <input
                    type="file"
                    accept="image/*"
                    aria-label={`Foto da ${definition.label.toLowerCase()}`}
                    disabled={isAnalyzing}
                    className="sr-only"
                    onChange={(event) => {
                      const selected = event.target.files?.[0]
                      event.target.value = ''
                      if (selected) onSelectPhoto(slot.view, selected)
                    }}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Câmera — ${definition.label}`}
                  disabled={isAnalyzing}
                  onClick={() => onUseCamera(slot.view)}
                  className="flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-text-secondary hover:text-action-primary disabled:opacity-50"
                >
                  <Icon name="photo_camera" />
                  Câmera
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
