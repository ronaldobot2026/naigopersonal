import { useCallback, useEffect, useState } from 'react'
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
 * 1. A conversa NUNCA é criada aqui, nem procurada: o badge roda em toda tela do aluno, e criar a
 *    conversa só porque o app abriu encheria `conversations` de linhas sem nenhuma mensagem. A
 *    contagem é global (`unreadCountForCurrentUser`) e a assinatura é de TODAS as mensagens
 *    acessíveis (`subscribeToAllMessages`), com a RLS de `messages` como autorização — o aluno só
 *    participa da conversa dele, então o escopo global já é o escopo dele.
 *
 *    Isto conserta um buraco achado no E2E da Fase 12 com aluno NOVO: a versão anterior resolvia
 *    a conversa no mount e, quando não existia nenhuma (aluno que nunca falou com o personal),
 *    não assinava nada. A conversa nascia depois, na primeira mensagem dele, e a resposta do
 *    personal não subia o badge até o aluno recarregar — exatamente no aluno que mais precisa do
 *    aviso. Sem filtro de `conversation_id` não há o que ficar desatualizado.
 * 2. O evento do Realtime incrementa em memória em vez de recontar no banco: a mensagem que
 *    acabou de chegar já veio na carga do evento, e recontar a cada chegada seria um round-trip
 *    por mensagem. O `refresh` existe para o caminho oposto (as mensagens foram lidas na tela do
 *    chat e o contador precisa voltar à verdade do banco).
 */
export function useStudentUnreadCount(): UseStudentUnreadCountResult {
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
        // Badge é aviso, não função crítica: falhar aqui não pode derrubar a navegação do aluno.
        console.error(error)
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [userId, revision])

  return { count, refresh }
}
