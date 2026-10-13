import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessageContext } from '../domain/chatMessage.types'

/** Só o que o painel manda ao repositório — o retorno não é usado pela tela. */
type SendArgs = { conversationId: string; body: string; context: ChatMessageContext }

const ensureConversationForCurrentStudent = vi.fn(async () => ({
  id: 'conversa-1',
  trainerId: 'personal-1',
  studentId: 'aluno-1',
  lastMessageAt: null,
  createdAt: '2026-10-07T12:00:00.000Z',
}))

const sendMessage = vi.fn(async (_input: SendArgs) => ({}))

vi.mock('../repositories/chatRepository', () => ({
  chatRepository: {
    ensureConversationForCurrentStudent: () => ensureConversationForCurrentStudent(),
    sendMessage: (input: SendArgs) => sendMessage(input),
  },
}))

import { AskTrainerPanel } from '../components/AskTrainerPanel'

function renderizar(props: Partial<Parameters<typeof AskTrainerPanel>[0]> = {}) {
  const utils = render(
    <MemoryRouter>
      <AskTrainerPanel
        contextKind="exercise"
        contextId="log-1"
        contextLabel="Treino A · Supino com barra"
        {...props}
      />
    </MemoryRouter>,
  )
  return {
    ...utils,
    rerenderCom: (label: string) =>
      utils.rerender(
        <MemoryRouter>
          <AskTrainerPanel
            contextKind="exercise"
            contextId="log-1"
            contextLabel={label}
            {...props}
          />
        </MemoryRouter>,
      ),
  }
}

async function enviar(texto: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Falar com o personal' }))
  await user.type(screen.getByRole('textbox'), texto)
  await user.click(screen.getByRole('button', { name: 'Enviar ao personal' }))
  return user
}

describe('AskTrainerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('envia com o contexto do exercicio e confirma com atalho para a conversa', async () => {
    renderizar()

    await enviar('senti dor no ombro na 3a serie')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(sendMessage).toHaveBeenCalledWith({
      conversationId: 'conversa-1',
      body: 'senti dor no ombro na 3a serie',
      context: { kind: 'exercise', id: 'log-1', label: 'Treino A · Supino com barra' },
    })

    // A mensagem nao pode sumir no vazio: confirmacao com o rotulo e link para a conversa.
    expect(await screen.findByText('Mensagem enviada ao personal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir conversa' })).toHaveAttribute(
      'href',
      '/aluno/chat',
    )
  })

  it('congela o context_label no envio: mudar a ficha depois nao reescreve a mensagem antiga', async () => {
    const { rerenderCom } = renderizar()

    await enviar('o movimento esta certo?')
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))

    // O personal republica a ficha e o exercicio desta linha passa a ser outro.
    rerenderCom('Treino A · Supino inclinado')

    // O que foi para o banco continua sendo o que o aluno estava vendo...
    expect(sendMessage.mock.calls[0][0]).toMatchObject({
      context: { label: 'Treino A · Supino com barra' },
    })
    // ...e a confirmacao na tela tambem, mesmo com a prop ja trocada.
    expect(screen.getByText('Treino A · Supino com barra')).toBeInTheDocument()
    expect(screen.queryByText('Treino A · Supino inclinado')).not.toBeInTheDocument()

    // A PROXIMA mensagem, sim, usa o rotulo novo.
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Falar de novo' }))
    await user.type(screen.getByRole('textbox'), 'e agora?')
    await user.click(screen.getByRole('button', { name: 'Enviar ao personal' }))

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2))
    expect(sendMessage.mock.calls[1][0]).toMatchObject({
      context: { label: 'Treino A · Supino inclinado' },
    })
  })

  it('descarrega o auto-save pendente ANTES de enviar, para nao perder a serie digitada', async () => {
    const ordem: string[] = []
    const onBeforeSend = vi.fn(async () => {
      ordem.push('flush')
    })
    sendMessage.mockImplementation(async () => {
      ordem.push('send')
      return {}
    })

    renderizar({ onBeforeSend })

    await enviar('trava?')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(onBeforeSend).toHaveBeenCalledTimes(1)
    expect(ordem).toEqual(['flush', 'send'])
  })

  it('mantem o texto na tela quando o envio falha', async () => {
    sendMessage.mockRejectedValueOnce(new Error('sem conexao'))

    renderizar()
    await enviar('mensagem que falha')

    expect(await screen.findByRole('alert')).toHaveTextContent('sem conexao')
    expect(screen.getByRole('textbox')).toHaveValue('mensagem que falha')
    expect(screen.queryByText('Mensagem enviada ao personal')).not.toBeInTheDocument()
  })
})
