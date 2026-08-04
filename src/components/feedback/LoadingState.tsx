type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'Carregando…' }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 p-8 text-center"
    >
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-action-primary"
        aria-hidden="true"
      />
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  )
}
