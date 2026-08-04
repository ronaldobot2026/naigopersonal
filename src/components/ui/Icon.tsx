type IconProps = {
  name: string
  filled?: boolean
  className?: string
}

/** Wrapper semântico sobre o Material Symbols Outlined (ícones herdados do export Stitch). */
export function Icon({ name, filled = false, className = '' }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'icon-filled' : ''} ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}
