import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { formatBadgeCount } from './navBadge'

export interface NavItem {
  to: string
  icon: string
  label: string
  /** Não lidas da aba. `0`/ausente não desenha nada — badge vazio é ruído. */
  badgeCount?: number
}

type BottomNavigationProps = {
  items: NavItem[]
}

export function BottomNavigation({ items }: BottomNavigationProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="glass-chrome safe-area-bottom scroll-edge-bottom fixed bottom-0 left-0 z-40 flex w-full items-center justify-around px-2 py-3 md:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to.endsWith('inicio') || item.to.endsWith('dashboard')}
          aria-label={
            item.badgeCount !== undefined && item.badgeCount > 0
              ? `${item.label}, ${item.badgeCount} não lidas`
              : undefined
          }
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-1 transition-[color,transform] duration-200 ease-out-quint active:scale-95 ${
              isActive ? 'text-action-primary' : 'text-text-secondary'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {/* O ponto marca o item ativo sem depender só de cor. */}
              <span className="relative">
                <Icon name={item.icon} filled={isActive} />
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-action-primary"
                  />
                )}
                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span
                    // O número também vai no aria-label do NavLink: quem usa leitor de tela não
                    // vê a bolinha.
                    aria-hidden="true"
                    className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-mono text-[10px] font-bold leading-none text-white"
                  >
                    {formatBadgeCount(item.badgeCount)}
                  </span>
                )}
              </span>
              <span className="truncate text-[11px] font-medium">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
