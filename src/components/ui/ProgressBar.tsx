type ProgressBarProps = {
  value: number
  label?: string
  className?: string
}

export function ProgressBar({ value, label, className = '' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-high ${className}`}
    >
      <div className="h-full bg-action-primary transition-all" style={{ width: `${clamped}%` }} />
    </div>
  )
}
