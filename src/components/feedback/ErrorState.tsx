import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

type ErrorStateProps = {
  title: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-error/40 bg-error-container/10 p-8 text-center"
    >
      <Icon name="error" className="text-4xl text-error" />
      <p className="font-display text-lg font-bold text-text-primary">{title}</p>
      {description && <p className="max-w-sm text-sm text-text-secondary">{description}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
