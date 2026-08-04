import { Outlet } from 'react-router-dom'

/** Shell mínimo para áreas sem navegação persistente (ex.: login). */
export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-text-primary">
      <Outlet />
    </div>
  )
}
