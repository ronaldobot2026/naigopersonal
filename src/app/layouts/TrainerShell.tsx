import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { RoleShell } from '@/app/layouts/RoleShell'
import { ROUTES } from '@/app/router/routes'
import type { NavItem } from '@/components/navigation/BottomNavigation'
import { useTrainerUnreadCount } from '@/features/chat/hooks/useTrainerUnreadCount'

const TRAINER_NAV_ITEMS: NavItem[] = [
  { to: ROUTES.trainer.dashboard, icon: 'dashboard', label: 'Dashboard' },
  { to: ROUTES.trainer.students, icon: 'group', label: 'Alunos' },
  { to: ROUTES.trainer.library, icon: 'menu_book', label: 'Biblioteca' },
  { to: ROUTES.trainer.chat, icon: 'chat', label: 'Chat' },
]

/**
 * Shell do personal = `RoleShell` + contador global de não lidas na aba Chat.
 *
 * Mesmo motivo do shell do aluno: sem push, o badge é o único aviso de mensagem nova — e ele
 * precisa subir com o personal montando treino, lendo avaliação ou em qualquer outra tela. A
 * diferença é o escopo: aqui o número soma as conversas de TODOS os alunos dele.
 *
 * Com a caixa de entrada aberta o badge fica em zero por decisão, não por falta de dado: a tela
 * está marcando como lida enquanto ele lê. Ao SAIR, o contador é reconsultado no banco, que é
 * quando o `markRead` já rodou.
 */
export function TrainerShell() {
  const { pathname } = useLocation()
  const { count, refresh } = useTrainerUnreadCount()

  const wasInChat = useRef(false)
  const isInChat = pathname === ROUTES.trainer.chat

  useEffect(() => {
    if (wasInChat.current && !isInChat) refresh()
    wasInChat.current = isInChat
  }, [isInChat, refresh])

  const navItems = TRAINER_NAV_ITEMS.map((item) =>
    item.to === ROUTES.trainer.chat ? { ...item, badgeCount: isInChat ? 0 : count } : item,
  )

  return (
    <RoleShell navItems={navItems} sidebarSubtitle="ELITE TRAINING SYSTEM" switchTo="student" />
  )
}
