import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import type { NavItem } from './BottomNavigation'

type SidebarProps = {
  items: NavItem[]
  title: string
  subtitle?: string
}

export function Sidebar({ items, title, subtitle }: SidebarProps) {
  return (
    <aside className="glass-chrome hidden h-screen w-72 flex-col gap-1 border-r border-border/60 p-margin-mobile md:flex">
      <div className="mb-8 p-4">
        <p className="font-display text-lg font-bold tracking-tight text-action-primary">{title}</p>
        {subtitle && <p className="font-mono text-[10px] text-text-secondary">{subtitle}</p>}
      </div>
      <nav className="flex flex-col gap-1.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition-[background-color,color,transform] duration-200 ease-out-quint active:scale-[0.98] ${
                isActive
                  ? 'glass text-action-primary'
                  : 'text-text-primary hover:bg-surface-high/60'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Marcador vertical: o item ativo se ancora à borda da sidebar. */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-action-primary"
                  />
                )}
                <Icon name={item.icon} filled={isActive} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
