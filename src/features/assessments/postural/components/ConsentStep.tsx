import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type ConsentStepProps = {
  onAccept: () => void
}

export function ConsentStep({ onAccept }: ConsentStepProps) {
  const [checked, setChecked] = useState(false)

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="font-display text-lg text-text-primary">
        Consentimento para captura de imagem
      </h3>
      <p className="text-sm text-text-secondary">
        Esta etapa usa a câmera (ou uma foto enviada por você) para estimar pontos do corpo e
        calcular indicadores visuais de postura. O processamento acontece localmente no navegador —
        nenhuma imagem é enviada automaticamente para servidores externos.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
        <li>Você pode cancelar a qualquer momento.</li>
        <li>As capturas podem ser excluídas depois de salvas.</li>
        <li>Esta análise é visual e não constitui diagnóstico médico.</li>
      </ul>
      <label className="flex items-start gap-3 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-1 h-4 w-4 accent-action-primary"
        />
        Entendo a finalidade da captura e autorizo o uso da câmera para esta avaliação.
      </label>
      <Button onClick={onAccept} disabled={!checked} className="self-end">
        Continuar
      </Button>
    </Card>
  )
}
