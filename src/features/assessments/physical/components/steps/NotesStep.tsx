import { useState } from 'react'
import { Card } from '@/components/ui/Card'

type NotesStepProps = {
  value: string
  onChange: (value: string) => void
}

export function NotesStep({ value, onChange }: NotesStepProps) {
  const [draft, setDraft] = useState(value)

  return (
    <Card className="flex flex-col gap-2">
      <label
        htmlFor="general-notes"
        className="font-mono text-xs uppercase tracking-widest text-text-secondary"
      >
        Observações do treinador
      </label>
      <textarea
        id="general-notes"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onChange(draft)}
        rows={6}
        className="w-full rounded-md border border-border bg-surface-elevated p-3 text-text-primary focus:border-action-primary focus:outline-none"
        placeholder="Observações gerais sobre a avaliação, contexto do aluno, recomendações..."
      />
    </Card>
  )
}
