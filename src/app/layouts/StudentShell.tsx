import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { RoleShell } from '@/app/layouts/RoleShell'
import { ROUTES } from '@/app/router/routes'
import type { NavItem } from '@/components/navigation/BottomNavigation'
import { useStudentUnreadCount } from '@/features/chat/hooks/useStudentUnreadCount'

const STUDENT_NAV_ITEMS: NavItem[] = [
  { to: ROUTES.student.home, icon: 'person', label: 'Ficha' },
  { to: ROUTES.student.workouts, icon: 'fitness_center', label: 'Treino' },
  { to: ROUTES.student.nutrition, icon: 'restaurant', label: 'Alimentação' },
  { to: ROUTES.student.posturalCorrection, icon: 'accessibility_new', label: 'Correção' },
  { to: ROUTES.student.myAssessments, icon: 'assignment', label: 'Avaliação' },
  { to: ROUTES.student.chat, icon: 'chat', label: 'Chat' },
]

/**
 * Shell do aluno = `RoleShell` + contador de não lidas na aba Chat.
 *
 * O badge mora aqui, e não na tela do chat, porque é o único aviso de mensagem nova que existe
 * hoje (não há push): ele precisa subir com o aluno em qualquer tela.
 *
 * Com a conversa ABERTA o badge fica em zero por decisão, não por falta de dado — a tela está
 * marcando como lida enquanto ele lê, e um contador piscando sobre a aba da própria tela que ele
 * está vendo é só ruído. Ao SAIR da conversa o contador é reconsultado no banco, que é quando o
 * `markRead` já rodou.
 */
export function StudentShell() {
  const { pathname } = useLocation()
  const { count, refresh } = useStudentUnreadCount()

  const wasInChat = useRef(false)
  const isInChat = pathname === ROUTES.student.chat

  useEffect(() => {
    if (wasInChat.current && !isInChat) refresh()
    wasInChat.current = isInChat
  }, [isInChat, refresh])

  const navItems = STUDENT_NAV_ITEMS.map((item) =>
    item.to === ROUTES.student.chat ? { ...item, badgeCount: isInChat ? 0 : count } : item,
  )

  return <RoleShell navItems={navItems} sidebarSubtitle="ÁREA DO ALUNO" switchTo="trainer" />
}
