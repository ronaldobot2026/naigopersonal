import type { HTMLAttributes } from 'react'

type BadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'informative'

type BadgeProps = {
  tone?: BadgeTone
} & HTMLAttributes<HTMLSpanElement>

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-high text-text-secondary',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  error: 'bg-error-container text-error',
  informative: 'bg-informative/20 text-informative',
}

export function Badge({ tone = 'neutral', className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}
