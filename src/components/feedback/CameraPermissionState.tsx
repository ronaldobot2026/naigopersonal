import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

type CameraPermissionStatus = 'requesting' | 'denied' | 'unavailable'

type CameraPermissionStateProps = {
  status: CameraPermissionStatus
  onRequestAccess?: () => void
  onUseUploadInstead?: () => void
}

const COPY: Record<CameraPermissionStatus, { title: string; description: string }> = {
  requesting: {
    title: 'Solicitando acesso à câmera…',
    description: 'Autorize o uso da câmera no seu navegador para continuar a captura.',
  },
  denied: {
    title: 'Acesso à câmera negado',
    description: 'Libere o acesso nas configurações do navegador ou envie uma foto da galeria.',
  },
  unavailable: {
    title: 'Câmera indisponível neste dispositivo',
    description: 'Envie uma foto da galeria para continuar a avaliação postural.',
  },
}

export function CameraPermissionState({
  status,
  onRequestAccess,
  onUseUploadInstead,
}: CameraPermissionStateProps) {
  const copy = COPY[status]
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center"
    >
      <Icon name="videocam_off" className="text-4xl text-text-secondary" />
      <p className="font-display text-lg font-bold text-text-primary">{copy.title}</p>
      <p className="max-w-sm text-sm text-text-secondary">{copy.description}</p>
      <div className="flex gap-3">
        {status === 'requesting' && onRequestAccess && (
          <Button onClick={onRequestAccess}>Permitir câmera</Button>
        )}
        {onUseUploadInstead && (
          <Button variant="secondary" onClick={onUseUploadInstead}>
            Enviar foto
          </Button>
        )}
      </div>
    </div>
  )
}
