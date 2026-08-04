import type { ButtonHTMLAttributes } from 'react'
import { Icon } from './Icon'

type IconButtonProps = {
  icon: string
  label: string
  filled?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>

export function IconButton({
  icon,
  label,
  filled,
  className = '',
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-text-primary transition-[background-color,transform] duration-[110ms] ease-out-quint hover:bg-surface-high/70 active:scale-90 ${className}`}
      {...rest}
    >
      <Icon name={icon} filled={filled} />
    </button>
  )
}
