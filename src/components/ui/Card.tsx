import type { HTMLAttributes } from 'react'
import { usePointerSpotlight } from '@/hooks/usePointerSpotlight'

type CardTone = 'surface' | 'elevated' | 'high' | 'glass' | 'glass-high'

type CardProps = {
  tone?: CardTone
  /** Ativa o realce que segue o ponteiro. Use em cartões clicáveis, não em blocos de texto. */
  interactive?: boolean
} & HTMLAttributes<HTMLDivElement>

const TONE_CLASSES: Record<CardTone, string> = {
  surface: 'bg-surface shadow-glass-sm',
  elevated: 'bg-surface-elevated shadow-glass',
  high: 'bg-surface-high',
  glass: 'glass',
  'glass-high': 'glass-high',
}

/**
 * Superfície base. Os tons `glass` são translúcidos e só fazem sentido sobre conteúdo
 * ou sobre a camada atmosférica — empilhar vidro sobre vidro derruba a legibilidade
 * (ver globals.css).
 */
export function Card({
  tone = 'surface',
  interactive = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  const spotlight = usePointerSpotlight()

  return (
    <div
      ref={interactive ? spotlight.ref : undefined}
      onPointerMove={interactive ? spotlight.onPointerMove : undefined}
      className={`rounded-lg border border-border p-gutter ${TONE_CLASSES[tone]} ${interactive ? 'spotlight' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
