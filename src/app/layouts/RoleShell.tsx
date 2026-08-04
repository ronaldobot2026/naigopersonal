import { Outlet, useNavigate } from 'react-router-dom'
import { BottomNavigation, type NavItem } from '@/components/navigation/BottomNavigation'
import { Sidebar } from '@/components/navigation/Sidebar'
import { TopBar } from '@/components/navigation/TopBar'
import { IconButton } from '@/components/ui/IconButton'
import { useRole } from '@/app/providers/useRole'
import { ROUTES } from '@/app/router/routes'
import type { Role } from '@/types/domain'

type RoleShellProps = {
  navItems: NavItem[]
  sidebarSubtitle: string
  switchTo: Role
}

/** Shell com navegação (Sidebar no desktop, BottomNavigation no mobile) para as áreas Aluno e Personal. */
export function RoleShell({ navItems, sidebarSubtitle, switchTo }: RoleShellProps) {
  const { setRole } = useRole()
  const navigate = useNavigate()

  function handleSwitchRole(): void {
    setRole(switchTo)
    navigate(ROUTES.login)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar items={navItems} title="WINDSON WOOD" subtitle={sidebarSubtitle} />
      {/*
        A TopBar fica DENTRO do contêiner de rolagem, como `sticky`. Fora dele o
        conteúdo pararia acima da barra e o `backdrop-filter` não teria nada para
        desfocar — o material só existe quando o conteúdo passa por baixo dele.
      */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <TopBar
            title="Windson Wood Personal"
            actions={
              <IconButton
                icon="switch_account"
                label="Trocar papel (mock)"
                onClick={handleSwitchRole}
              />
            }
          />
          <Outlet />
        </main>
      </div>
      <BottomNavigation items={navItems} />
    </div>
  )
}
