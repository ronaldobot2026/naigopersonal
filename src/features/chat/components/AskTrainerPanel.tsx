import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { Icon } from '@/components/ui/Icon'
import type { ChatContextKind, ChatMessageContext } from '../domain/chatMessage.types'
import { chatRepository } from '../repositories/chatRepository'

export interface AskTrainerPanelProps {
  /** `exercise` durante o treino, `assessment` no detalhe da avaliação. */
  contextKind: Exclude<ChatContextKind, 'free'>
  /**
   * A que a mensagem se refere, do ponto de vista do BANCO: `messages.context_id` é `uuid`, então
   * aqui entra o id da execução (`workout_logs.id`) ou da avaliação — nunca o id do exercício do
   * catálogo, que é um código curto (`'0025'`) e seria recusado como `22P02`. Qual exercício era
   * fica no `label`.
   */
  contextId: string | null
  /** Rótulo legível já montado pelo chamador ("Treino A · Supino com barra"). */
  contextLabel: string
  /**
   * Roda ANTES do envio. Existe para a tela do treino descarregar o auto-save com debounce: o
   * aluno escreve "senti dor no ombro na 3ª série" logo depois de digitar a carga, e os 400ms da
   * janela ainda não passaram. Mesmo cuidado do "Concluir treino".
   */
  onBeforeSend?: () => Promise<void> | void
  className?: string
}

/**
 * "Falar com o personal" de dentro do treino ou da avaliação — a razão de este chat existir.
 *
 * Três decisões que não são óbvias:
 *
 * 1. **O contexto é congelado no clique de enviar**, copiado para um objeto local antes de
 *    qualquer `await`. As props vêm da ficha, que o personal pode republicar enquanto o aluno
 *    treina; o rótulo que vai ao banco é o que o aluno estava vendo, e a confirmação na tela
 *    mostra esse mesmo texto mesmo depois de a prop mudar.
 * 2. **Fala direto com o repositório**, sem montar `useChatConversation`: aqui não há thread para
 *    reconciliar nem Realtime para assinar, e abrir uma assinatura por exercício na tela do
 *    treino seria um canal por card.
 * 3. **A mensagem não desaparece no vazio**: depois do envio fica a confirmação com o rótulo e um
 *    atalho para a conversa. Sem isso o aluno manda, não vê nada acontecer e manda de novo.
 */
export function AskTrainerPanel({
  contextKind,
  contextId,
  contextLabel,
  onBeforeSend,
  className,
}: AskTrainerPanelProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sentLabel, setSentLabel] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>()

  async function handleSend(): Promise<void> {
    const text = draft.trim()
    if (!text || sending) return

    // Congelado AQUI, antes de qualquer await: é o rótulo que o aluno tinha na tela.
    const frozen: ChatMessageContext = { kind: contextKind, id: contextId, label: contextLabel }

    setSending(true)
    setErrorMessage(undefined)
    try {
      await onBeforeSend?.()
      const conversation = await chatRepository.ensureConversationForCurrentStudent()
      await chatRepository.sendMessage({
        conversationId: conversation.id,
        body: text,
        context: frozen,
      })
      setDraft('')
      setOpen(false)
      setSentLabel(frozen.label)
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível enviar a mensagem agora.',
      )
    } finally {
      setSending(false)
    }
  }

  if (sentLabel !== null && !open) {
    return (
      <div
        role="status"
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-action-primary/30 bg-action-primary/10 px-3 py-2 text-xs text-text-primary ${className ?? ''}`}
      >
        <Icon name="check_circle" filled className="text-base text-action-primary" />
        <span>Mensagem enviada ao personal</span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-text-secondary">
          {sentLabel}
        </span>
        <Link
          to={ROUTES.student.chat}
          className="underline hover:text-action-primary"
          onClick={(event) => event.stopPropagation()}
        >
          Abrir conversa
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-text-secondary underline hover:text-action-primary"
        >
          Falar de novo
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex min-h-11 items-center gap-1 self-start rounded-md px-1 text-xs text-text-secondary transition-colors hover:text-action-primary ${className ?? ''}`}
      >
        <Icon name="chat" className="text-base" />
        Falar com o personal
      </button>
    )
  }

  return (
    <div className={`flex flex-col gap-2 rounded-md border border-border p-3 ${className ?? ''}`}>
      <p className="font-mono text-[10px] uppercase tracking-wide text-text-secondary">
        {contextLabel}
      </p>
      {/*
        `text-base` (16px): abaixo disso o Safari do iOS dá zoom ao focar e o aluno perde o treino
        de vista. `autoFocus` porque o painel só existe depois de um toque deliberado.
      */}
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={2}
        autoFocus
        aria-label={`Mensagem para o personal — ${contextLabel}`}
        placeholder="O que você quer contar? Ex.: senti dor no ombro na 3ª série."
        className="w-full rounded-md border border-border bg-surface px-3 py-2 font-body text-base text-text-primary placeholder:text-text-secondary/50 focus:border-action-primary focus:outline-none"
      />

      {errorMessage && (
        <p role="alert" className="text-xs text-error">
          {errorMessage}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || draft.trim() === ''}
          className="min-h-11 rounded-md bg-action-primary px-4 text-sm font-bold text-action-primary-foreground active:scale-[0.97] disabled:opacity-50"
        >
          {sending ? 'Enviando…' : 'Enviar ao personal'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setErrorMessage(undefined)
          }}
          className="min-h-11 px-1 text-xs text-text-secondary underline hover:text-action-primary"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
