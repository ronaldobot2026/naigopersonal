import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUserState } from '@/lib/supabase/useAuthUser'
import type { PhysicalAssessment } from '@/types/domain'

const AVALIACAO_CONCLUIDA: PhysicalAssessment = {
  id: 'avaliacao-1',
  studentId: 'aluno-1',
  evaluatorId: 'personal-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  status: 'completed',
  biometrics: {} as PhysicalAssessment['biometrics'],
  anthropometry: {} as PhysicalAssessment['anthropometry'],
  visualRecords: [],
}

const findByStudentId = vi.fn(async () => [AVALIACAO_CONCLUIDA])

vi.mock('../repositories/physicalAssessmentRepository', () => ({
  physicalAssessmentRepository: {
    findByStudentId: (...args: unknown[]) =>
      (findByStudentId as (...args: unknown[]) => Promise<PhysicalAssessment[]>)(...args),
  },
}))

const useAuthUserMock = vi.fn<() => AuthUserState>(() => ({ userId: 'personal-1', status: 'authenticated' }))

vi.mock('@/lib/supabase/useAuthUser', () => ({
  useAuthUser: () => useAuthUserMock(),
}))

import { StudentAssessmentsPage } from '../pages/StudentAssessmentsPage'

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/personal/alunos/aluno-1/avaliacoes']}>
      <Routes>
        <Route path="/personal/alunos/:studentId/avaliacoes" element={<StudentAssessmentsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StudentAssessmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findByStudentId.mockResolvedValue([AVALIACAO_CONCLUIDA])
    useAuthUserMock.mockReturnValue({ userId: 'personal-1', status: 'authenticated' })
  })

  it('lista as avaliações do aluno quando a sessão está autenticada', async () => {
    renderizar()

    expect(await screen.findByText('Concluída')).toBeInTheDocument()
    expect(findByStudentId).toHaveBeenCalledWith('aluno-1')
  })

  it('mostra sessão expirada e não consulta o repositório quando não autenticado', async () => {
    useAuthUserMock.mockReturnValue({ userId: null, status: 'unauthenticated' })

    renderizar()

    expect(await screen.findByText('Sessão expirada')).toBeInTheDocument()
    expect(findByStudentId).not.toHaveBeenCalled()
  })
})
