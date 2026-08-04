import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { loadPhotoObjectUrl, savePhoto } from '@/lib/storage/photoStorage'
import type { VisualRecordEntry, VisualRecordView } from '@/types/domain'

type VisualRecordStepProps = {
  assessmentId: string
  value: VisualRecordEntry[]
  onChange: (value: VisualRecordEntry[]) => void
}

const VIEWS: { view: VisualRecordView; label: string }[] = [
  { view: 'front', label: 'Vista frontal' },
  { view: 'left_side', label: 'Lateral esquerda' },
  { view: 'right_side', label: 'Lateral direita' },
  { view: 'back', label: 'Vista posterior' },
]

export function VisualRecordStep({ assessmentId, value, onChange }: VisualRecordStepProps) {
  const [previews, setPreviews] = useState<Partial<Record<VisualRecordView, string>>>({})

  useEffect(() => {
    let cancelled = false
    const urls: Partial<Record<VisualRecordView, string>> = {}

    async function loadPreviews(): Promise<void> {
      for (const entry of value) {
        if (!entry.imageStorageKey) continue
        const url = await loadPhotoObjectUrl(entry.imageStorageKey)
        if (url) urls[entry.view] = url
      }
      if (!cancelled) setPreviews(urls)
    }

    void loadPreviews()

    return () => {
      cancelled = true
      Object.values(urls).forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [value])

  async function handleFileChange(view: VisualRecordView, file: File | undefined): Promise<void> {
    if (!file) return
    const storageKey = `${assessmentId}.visual.${view}`
    await savePhoto(storageKey, file)

    const nextRecords = value.filter((entry) => entry.view !== view)
    nextRecords.push({ view, imageStorageKey: storageKey })
    onChange(nextRecords)
  }

  return (
    <Card>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {VIEWS.map(({ view, label }) => (
          <label
            key={view}
            className="group relative flex h-40 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-surface-elevated transition-colors hover:border-action-primary"
          >
            {previews[view] ? (
              <img
                src={previews[view]}
                alt={`Registro visual — ${label}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                <Icon
                  name="add_a_photo"
                  className="mb-1 text-text-secondary group-hover:text-action-primary"
                />
                <span className="font-mono text-[10px] text-text-secondary">{label}</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => void handleFileChange(view, event.target.files?.[0])}
            />
          </label>
        ))}
      </div>
    </Card>
  )
}
