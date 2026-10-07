import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import { chatRepository } from '../repositories/chatRepository'

export interface UseStudentUnreadCountResult {
  /** Mensagens que o aluno recebeu do personal e ainda não leu. `0` enquanto não se sabe. */
  count: number
  /** Reconta no banco. A tela chama ao SAIR da conversa, quando o `markRead` já rodou. */
  refresh: () => void
}

/**
 * Contador de não lidas do ALUNO, para o badge da navegação.
 *
 * Enquanto não existe push, este badge é o único aviso de mensagem nova que o aluno tem — então
 * ele precisa subir sozinho, com o aluno em qualquer tela. Daí a assinatura de Realtime viver
 * aqui, no shell, e não na tela do chat.
 *
 * Duas decisões que não são acidentais:
 *
 * 1. A conversa é LIDA, nunca criada (`findConversationForCurrentStudent`): o badge roda em toda
 *    tela do aluno, e criar a conversa só porque o app abriu encheria `conversations` de linhas
 *    sem nenhuma mensagem.
 * 2. O evento do Realtime incrementa em memória em vez de recontar no banco: a mensagem que
 *    acabou de chegar já veio na carga do evento, e recontar a cada chegada seria um round-trip
 *    por mensagem. O `refresh` existe para o caminho oposto (as mensagens foram lidas na tela do
 *    chat e o contador precisa voltar à verdade do banco).
 */
export function useStudentUnreadCount(): UseStudentUnreadCountResult {
  const { userId } = useAuthUser()
  const [count, setCount] = useState(0)
  const [revision, setRevision] = useState(0)

  /** Conversa já resolvida: o `refresh` não precisa redescobri-la a cada recontagem. */
  const conversationId = useRef<string | null>(null)

  const refresh = useCallback(() => {
    setRevision((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!userId) {
      conversationId.current = null
      setCount(0)
      return
    }

    let cancelled = false
    let unsubscribe: (() => void) | undefined

    async function load(): Promise<void> {
      const id =
        conversationId.current ?? (await chatRepository.findConversationForCurrentStudent())?.id
      if (cancelled) return

      // Sem conversa ainda não há o que contar nem o que assinar: nenhuma mensagem existe.
      if (!id) {
        setCount(0)
        return
      }
      conversationId.current = id

      unsubscribe = chatRepository.subscribeToMessages(id, (message) => {
        if (cancelled || message.senderId === userId) return
        setCount((current) => current + 1)
      })

      const unread = await chatRepository.unreadCount(id)
      if (cancelled) return
      setCount(unread)
    }

    load().catch((error: unknown) => {
      // Badge é aviso, não função crítica: falhar aqui não pode derrubar a navegação do aluno.
      console.error(error)
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [userId, revision])

  return { count, refresh }
}
