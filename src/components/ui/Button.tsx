import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

type ButtonProps = {
  variant?: ButtonVariant
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-action-primary text-action-primary-foreground shadow-glass-sm hover:shadow-glass hover:brightness-105',
  secondary: 'glass border border-border/70 text-text-primary hover:bg-surface-high/70',
  ghost: 'text-text-primary hover:bg-surface-high/60',
}

/**
 * O feedback de pressão acontece no pointer-down (`active:`), não no clique:
 * esperar o release para reagir faz o botão parecer morto. 110ms é curto o
 * bastante para o toque e a resposta serem lidos como o mesmo evento.
 */
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 font-body text-sm font-medium transition-[transform,box-shadow,background-color,filter] duration-[110ms] ease-out-quint active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
