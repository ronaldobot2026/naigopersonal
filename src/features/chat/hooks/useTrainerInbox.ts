import { useCallback, useEffect, useRef, useState } from 'react'
import { studentRepository } from '@/features/students/repositories/studentRepository'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import {
  applyIncomingMessage,
  buildInbox,
  markInboxRead,
  totalUnread,
  type InboxEntry,
} from '../domain/inbox'
import { chatRepository } from '../repositories/chatRepository'

export interface UseTrainerInboxResult {
  status: 'loading' | 'ready' | 'error'
  /** Conversas do personal, da mexida mais recente para a mais antiga. */
  entries: InboxEntry[]
  /** Soma das não lidas — o número que vai para o badge da navegação. */
  totalUnread: number
  /** Id do personal logado: é com ele que a tela decide o lado da bolha. */
  selfId: string | null
  errorMessage: string | undefined
  /** Relê a lista no banco. */
  refresh: () => void
  /** Zera as não lidas de uma conversa em memória — a tela abriu e já está marcando como lida. */
  markRead: (conversationId: string) => void
}

/**
 * A caixa de entrada do personal: conversas de todos os alunos dele, com a última mensagem, as
 * não lidas e atualização por Realtime.
 *
 * Três decisões que não são acidentais:
 *
 * 1. A assinatura é de TODAS as mensagens acessíveis (`subscribeToAllMessages`), não de uma
 *    conversa: o personal tem N conversas e precisa ver chegar mensagem de qualquer aluno. Quando
 *    o evento é de uma conversa que não está na lista — um aluno que acabou de abrir conversa —,
 *    `applyIncomingMessage` devolve `null` e aí a lista é RELIDA, porque o nome do aluno e a linha
 *    de `conversations` ainda não estão em memória.
 * 2. O evento atualiza a lista em memória em vez de recontar no banco: a mensagem já veio na carga
 *    do evento, e recontar por mensagem seria um round-trip por mensagem.
 * 3. Os nomes vêm de `studentRepository.findAll()` numa consulta só, e não um `profiles` por
 *    conversa.
 */
export function useTrainerInbox(): UseTrainerInboxResult {
  const { userId } = useAuthUser()
  const [entries, setEntries] = useState<InboxEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>()
  const [revision, setRevision] = useState(0)

  /** Lista corrente para o callback do Realtime decidir sem depender do estado capturado. */
  const entriesRef = useRef<InboxEntry[]>([])
  const update = useCallback((next: InboxEntry[]) => {
    entriesRef.current = next
    setEntries(next)
  }, [])

  const refresh = useCallback(() => {
    setRevision((current) => current + 1)
  }, [])

  const markRead = useCallback(
    (conversationId: string) => {
      update(markInboxRead(entriesRef.current, conversationId))
    },
    [update],
  )

  useEffect(() => {
    if (!userId) {
      update([])
      setStatus('loading')
      return
    }

    let cancelled = false
    setStatus('loading')

    // Assinar ANTES da primeira carga: assinar depois abriria a janela em que a mensagem chegada
    // durante o carregamento se perderia até o próximo reload.
    const unsubscribe = chatRepository.subscribeToAllMessages((message) => {
      if (cancelled) return
      const next = applyIncomingMessage(entriesRef.current, message, userId)
      // Conversa desconhecida: aluno abriu conversa agora. Só uma releitura traz o nome dele.
      if (next === null) refresh()
      else update(next)
    })

    Promise.all([
      chatRepository.listConversationsForCurrentTrainer(),
      studentRepository.findAll(),
    ])
      .then(([summaries, students]) => {
        if (cancelled) return
        const names = new Map(students.map((student) => [student.id, student.name]))
        update(buildInbox(summaries, names))
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(
          error instanceof Error ? error.message : 'Não foi possível carregar as conversas.',
        )
        setStatus('error')
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
    // `refresh`/`update` são estáveis (useCallback sem deps mutáveis).
  }, [userId, revision, refresh, update])

  return {
    status,
    entries,
    totalUnread: totalUnread(entries),
    selfId: userId,
    errorMessage,
    refresh,
    markRead,
  }
}
