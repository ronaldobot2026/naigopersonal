import { useCallback, useEffect, useState } from 'react'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import { chatRepository } from '../repositories/chatRepository'

export interface UseTrainerUnreadCountResult {
  /** Mensagens que o personal recebeu de QUALQUER aluno e ainda não leu. `0` enquanto não se sabe. */
  count: number
  /** Reconta no banco. O shell chama ao SAIR da caixa de entrada, quando o `markRead` já rodou. */
  refresh: () => void
}

/**
 * Contador global de não lidas do PERSONAL, para o badge da navegação.
 *
 * Mesmo motivo do badge do aluno (`useStudentUnreadCount`): enquanto não existe push, este é o
 * único aviso de mensagem nova — então precisa subir com o personal em qualquer tela, e por isso
 * mora no shell e não na caixa de entrada.
 *
 * A diferença em relação ao do aluno é o escopo: o personal tem uma conversa por aluno, então a
 * contagem é global (`unreadCountForCurrentUser`, restrita pela RLS) e a assinatura é de todas as
 * mensagens acessíveis — não de uma conversa. Como no do aluno, o evento incrementa em memória em
 * vez de recontar no banco; `refresh` existe para o caminho oposto (ele leu as mensagens e o
 * contador precisa voltar à verdade do banco).
 */
export function useTrainerUnreadCount(): UseTrainerUnreadCountResult {
  const { userId } = useAuthUser()
  const [count, setCount] = useState(0)
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => {
    setRevision((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!userId) {
      setCount(0)
      return
    }

    let cancelled = false

    const unsubscribe = chatRepository.subscribeToAllMessages((message) => {
      if (cancelled || message.senderId === userId) return
      setCount((current) => current + 1)
    })

    chatRepository
      .unreadCountForCurrentUser()
      .then((unread) => {
        if (!cancelled) setCount(unread)
      })
      .catch((error: unknown) => {
        // Badge é aviso, não função crítica: falhar aqui não derruba a navegação do personal.
        console.error(error)
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [userId, revision])

  return { count, refresh }
}
