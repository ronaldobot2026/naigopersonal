import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { assessmentPhotoRepository } from '../../repositories/assessmentPhotoRepository'
import type { VisualRecordEntry, VisualRecordView } from '@/types/domain'

type VisualRecordStepProps = {
  assessmentId: string
  studentId: string
  value: VisualRecordEntry[]
  onChange: (value: VisualRecordEntry[]) => void
  /**
   * Garante que a avaliação já tenha linha em `physical_assessments` antes do upload:
   * `assessment_photos.assessment_id` é FK e o rascunho novo só é gravado na primeira edição
   * (criação preguiçosa em `usePhysicalAssessmentDraft`).
   */
  onBeforeUpload: () => Promise<void>
}

const VIEWS: { view: VisualRecordView; label: string }[] = [
  { view: 'front', label: 'Vista frontal' },
  { view: 'left_side', label: 'Lateral esquerda' },
  { view: 'right_side', label: 'Lateral direita' },
  { view: 'back', label: 'Vista posterior' },
]

export function VisualRecordStep({ assessmentId, studentId, value, onChange, onBeforeUpload }: VisualRecordStepProps) {
  // Ref de blobs locais: imune a stale closure no useEffect
  const localBlobs = useRef<Partial<Record<VisualRecordView, string>>>({})
  const [previews, setPreviews] = useState<Partial<Record<VisualRecordView, string>>>({})
  const [uploadingView, setUploadingView] = useState<VisualRecordView | null>(null)
  const [removingView, setRemovingView] = useState<VisualRecordView | null>(null)
  const [errorByView, setErrorByView] = useState<Partial<Record<VisualRecordView, string>>>({})

  useEffect(() => {
    let cancelled = false

    async function loadPreviews(): Promise<void> {
      const urls: Partial<Record<VisualRecordView, string>> = {}
      for (const entry of value) {
        if (!entry.imageStorageKey) continue
        // Blob local existe: usa direto, sem mixed-content
        const blob = localBlobs.current[entry.view]
        if (blob) {
          urls[entry.view] = blob
          continue
        }
        const url = await assessmentPhotoRepository.getSignedUrl(entry.imageStorageKey)
        if (url) urls[entry.view] = url
      }
      if (!cancelled) setPreviews(urls)
    }

    void loadPreviews()

    return () => {
      cancelled = true
    }
  }, [value])

  async function handleFileChange(view: VisualRecordView, file: File | undefined): Promise<void> {
    if (!file) return
    setUploadingView(view)
    setErrorByView((current) => ({ ...current, [view]: undefined }))

    // Revoga blob anterior, cria novo
    const old = localBlobs.current[view]
    if (old) URL.revokeObjectURL(old)
    const blobUrl = URL.createObjectURL(file)
    localBlobs.current[view] = blobUrl
    // Exibe imediatamente, antes do upload terminar
    setPreviews((prev) => ({ ...prev, [view]: blobUrl }))

    try {
      await onBeforeUpload()
      const storagePath = await assessmentPhotoRepository.upload(studentId, assessmentId, view, file)
      const nextRecords = value.filter((entry) => entry.view !== view)
      nextRecords.push({ view, imageStorageKey: storagePath })
      onChange(nextRecords)
    } catch {
      // Desfaz preview em caso de erro
      URL.revokeObjectURL(blobUrl)
      delete localBlobs.current[view]
      setPreviews((prev) => {
        const next = { ...prev }
        delete next[view]
        return next
      })
      setErrorByView((current) => ({ ...current, [view]: 'Falha ao enviar a foto. Tente novamente.' }))
    } finally {
      setUploadingView(null)
    }
  }

  async function handleRemovePhoto(view: VisualRecordView): Promise<void> {
    const entry = value.find((e) => e.view === view)
    if (!entry) return
    setRemovingView(view)
    try {
      if (entry.imageStorageKey) {
        await assessmentPhotoRepository.remove(entry.imageStorageKey)
      }
    } catch {
      // Ignora erro de storage — remove da lista de qualquer forma
    } finally {
      const blob = localBlobs.current[view]
      if (blob) {
        URL.revokeObjectURL(blob)
        delete localBlobs.current[view]
      }
      onChange(value.filter((e) => e.view !== view))
      setPreviews((prev) => {
        const next = { ...prev }
        delete next[view]
        return next
      })
      setRemovingView(null)
    }
  }

  return (
    <Card>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {VIEWS.map(({ view, label }) => (
          <div key={view} className="flex flex-col gap-1">
            <div className="relative">
              <label className="group relative flex h-40 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-surface-elevated transition-colors hover:border-action-primary">
                {previews[view] ? (
                  <img
                    src={previews[view]}
                    alt={`Registro visual — ${label}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>
                    <Icon
                      name={uploadingView === view ? 'progress_activity' : 'add_a_photo'}
                      className={`mb-1 text-text-secondary group-hover:text-action-primary ${uploadingView === view ? 'animate-spin' : ''}`}
                    />
                    <span className="font-mono text-[10px] text-text-secondary">
                      {uploadingView === view ? 'Enviando…' : label}
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingView !== null || removingView !== null}
                  className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  onChange={(event) => void handleFileChange(view, event.target.files?.[0])}
                />
              </label>
              {previews[view] && (
                <IconButton
                  icon={removingView === view ? 'progress_activity' : 'delete'}
                  label="Remover foto"
                  disabled={removingView !== null || uploadingView !== null}
                  onClick={() => void handleRemovePhoto(view)}
                  className="absolute right-1 top-1 bg-surface-elevated/80 text-error backdrop-blur-sm hover:bg-error/20"
                />
              )}
            </div>
            {errorByView[view] && <p className="text-xs text-error">{errorByView[view]}</p>}
          </div>
        ))}
      </div>
    </Card>
  )
}
