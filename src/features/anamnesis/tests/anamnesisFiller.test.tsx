import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Anamnesis } from '../domain/anamnesis.types'

vi.mock('../repositories/indexedDbAnamnesisRepository', () => ({
  indexedDbAnamnesisRepository: {
    saveAnswers: vi.fn(async (a: Anamnesis, answers: Anamnesis['answers']) => ({ ...a, answers })),
    complete: vi.fn(async (a: Anamnesis, answers: Anamnesis['answers']) => ({
      ...a,
      answers,
      status: 'completed',
    })),
  },
}))

import { AnamnesisFiller } from '../components/AnamnesisFiller'
import { indexedDbAnamnesisRepository } from '../repositories/indexedDbAnamnesisRepository'

const PARQ: Anamnesis = {
  id: 'a1',
  studentId: 's1',
  trainerId: 't1',
  templateId: 'parq',
  filledBy: 'student',
  status: 'pending_student',
  answers: {},
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
}

function renderizar(anamnesis: Anamnesis) {
  return render(
    <MemoryRouter>
      <AnamnesisFiller anamnesis={anamnesis} backTo="/voltar" />
    </MemoryRouter>,
  )
}

describe('AnamnesisFiller', () => {
  beforeEach(() => vi.clearAllMocks())

  it('não conclui com perguntas em branco e aponta quantas faltam', async () => {
    const user = userEvent.setup()
    renderizar(PARQ)

    await user.click(screen.getByRole('button', { name: /concluir anamnese/i }))

    expect(await screen.findByText(/faltam 7 pergunta/i)).toBeInTheDocument()
    expect(indexedDbAnamnesisRepository.complete).not.toHaveBeenCalled()
  })

  it('salva a cada resposta e conclui quando tudo está respondido', async () => {
    const user = userEvent.setup()
    renderizar(PARQ)

    const grupos = screen.getAllByRole('radiogroup')
    expect(grupos).toHaveLength(7)
    for (const grupo of grupos) {
      await user.click(grupo.querySelector('[role="radio"]:nth-child(2)') as HTMLElement) // Não
    }
    expect(indexedDbAnamnesisRepository.saveAnswers).toHaveBeenCalledTimes(7)

    await user.click(screen.getByRole('button', { name: /concluir anamnese/i }))

    await waitFor(() => expect(indexedDbAnamnesisRepository.complete).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/anamnese concluída/i)).toBeInTheDocument()
    expect(screen.getByText(/nenhuma restrição apontada/i)).toBeInTheDocument()
  })

  it('PAR-Q concluída com "Sim" alerta liberação médica e fica somente leitura', async () => {
    renderizar({
      ...PARQ,
      status: 'completed',
      answers: Object.fromEntries(
        Array.from({ length: 7 }, (_, i) => [`parq-${i + 1}`, { choice: i === 1 ? 'yes' : 'no' }]),
      ) as Anamnesis['answers'],
    })

    expect(screen.getByText(/1 resposta\(s\) "sim"/i)).toBeInTheDocument()
    expect(screen.getAllByRole('radio').every((r) => r.hasAttribute('disabled'))).toBe(true)
    expect(screen.queryByRole('button', { name: /concluir anamnese/i })).not.toBeInTheDocument()
  })
})
