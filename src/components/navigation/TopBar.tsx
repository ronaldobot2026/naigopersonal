import type { ReactNode } from 'react'

type TopBarProps = {
  title: string
  actions?: ReactNode
}

/**
 * Chrome translúcido sobre o conteúdo que rola por baixo.
 *
 * Sem borda de 1px: a separação vem do `scroll-edge-top`, um degradê curto que
 * aparece só onde a barra realmente cobre o conteúdo.
 */
export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="glass-chrome scroll-edge-top sticky top-0 z-40 flex h-16 items-center justify-between px-margin-mobile md:px-margin-desktop">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined icon-filled text-action-primary">
          fitness_center
        </span>
        <h1 className="font-display text-lg font-semibold text-text-primary">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-4">{actions}</div>}
    </header>
  )
}
