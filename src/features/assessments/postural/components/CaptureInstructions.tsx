import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { PosturalView } from '../domain/posturalAssessment.types'
import { getPosturalViewDefinition } from '../domain/posturalViews'

type CaptureInstructionsProps = {
  view: PosturalView
  onContinue: () => void
  onBack: () => void
}

export function CaptureInstructions({ view, onContinue, onBack }: CaptureInstructionsProps) {
  const definition = getPosturalViewDefinition(view)

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="font-display text-lg text-text-primary">
        Antes de capturar — {definition.label.toLowerCase()}
      </h3>
      <ul className="list-disc space-y-2 pl-5 text-sm text-text-secondary">
        {definition.instructions.map((instruction) => (
          <li key={instruction}>{instruction}</li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={onContinue}>Estou pronto</Button>
      </div>
    </Card>
  )
}
