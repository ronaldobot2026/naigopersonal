import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Student } from '@/types/domain'

const ALUNO: Student = {
  id: 'aluno-1',
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
} as Student

vi.mock('../repositories/indexedDbStudentRepository', () => ({
  indexedDbStudentRepository: {
    findById: vi.fn(async () => ALUNO),
  },
}))

import { StudentDetailPage } from '../pages/StudentDetailPage'

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/personal/alunos/aluno-1']}>
      <Routes>
        <Route path="/personal/alunos/:studentId" element={<StudentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StudentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra a opcao de montar treino apontando para a ficha do aluno', async () => {
    renderizar()

    const link = await screen.findByRole('link', { name: /montar treino/i })
    expect(link).toHaveAttribute('href', '/personal/alunos/aluno-1/treino')
  })

  it('mantem os acessos as avaliacoes fisicas', async () => {
    renderizar()

    expect(await screen.findByRole('link', { name: /nova avaliação física/i })).toHaveAttribute(
      'href',
      '/personal/alunos/aluno-1/avaliacoes/nova',
    )
    expect(await screen.findByRole('link', { name: /histórico de avaliações/i })).toHaveAttribute(
      'href',
      '/personal/alunos/aluno-1/avaliacoes',
    )
  })
})
