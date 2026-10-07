import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkoutPlan } from '../domain/workout.types'
import type { SetLog, WorkoutLog } from '../domain/workoutLog.types'

const listSessions = vi.fn<(studentId: string, range?: unknown) => Promise<WorkoutLog[]>>()
const listSetsForSessions = vi.fn<(ids: string[]) => Promise<SetLog[]>>()
const findPublished = vi.fn<(studentId: string) => Promise<WorkoutPlan | null>>()

vi.mock('../repositories/workoutLogRepository', () => ({
  workoutLogRepository: {
    listSessions: (studentId: string, range?: unknown) => listSessions(studentId, range),
    listSetsForSessions: (ids: string[]) => listSetsForSessions(ids),
  },
}))

vi.mock('../repositories/workoutPlanRepository', () => ({
  workoutPlanRepository: {
    findPublished: (studentId: string) => findPublished(studentId),
  },
}))

vi.mock('../hooks/useExerciseCatalog', () => ({
  useExerciseCatalog: () => ({
    status: 'ready',
    catalog: {
      exercises: [
        { id: '0025', name: 'Supino reto com barra' },
        { id: '0027', name: 'Crucifixo na máquina' },
      ],
    },
    errorMessage: undefined,
  }),
}))

import { StudentAdherenceCard } from '../components/StudentAdherenceCard'

const HOJE = new Date()
const iso = (hora: number, minuto = 0) => {
  const date = new Date(HOJE)
  date.setHours(hora, minuto, 0, 0)
  return date.toISOString()
}

const PLANO = {
  id: 'ficha-1',
  studentId: 'aluno-1',
  studentName: 'Ana Souza',
  objective: 'Hipertrofia',
  weeklyFrequency: 3,
  notes: '',
  divisions: [
    {
      id: 'A' as const,
      label: 'Superior',
      entries: [
        { exerciseId: '0025', sets: 2, reps: '8-12', loadKg: 50 },
        { exerciseId: '0027', sets: 2, reps: '12' },
      ],
    },
  ],
  createdAt: iso(8),
  updatedAt: iso(8),
} satisfies WorkoutPlan

const SESSAO: WorkoutLog = {
  id: 'log-1',
  studentId: 'aluno-1',
  workoutPlanId: 'ficha-1',
  divisionKey: 'A',
  startedAt: iso(18, 0),
  completedAt: iso(18, 47),
  notes: '',
  createdAt: iso(18, 0),
  updatedAt: iso(18, 47),
}

const serie = (setIndex: number, weightKg: number | null): SetLog => ({
  id: `set-${setIndex}`,
  workoutLogId: 'log-1',
  studentId: 'aluno-1',
  exerciseId: '0025',
  exerciseName: 'Supino reto com barra',
  setIndex,
  reps: 10,
  weightKg,
  rpe: null,
  done: true,
  completedAt: iso(18, 20),
  createdAt: iso(18, 20),
  updatedAt: iso(18, 20),
})

function renderizar() {
  return render(<StudentAdherenceCard studentId="aluno-1" studentName="Ana Souza" />)
}

describe('StudentAdherenceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findPublished.mockResolvedValue(PLANO)
    listSessions.mockResolvedValue([SESSAO])
    listSetsForSessions.mockResolvedValue([serie(1, 45), serie(2, 55)])
  })

  it('mostra o que o aluno treinou: séries feitas sobre prescritas, volume e duração real', async () => {
    renderizar()

    const item = await screen.findByRole('button', { name: /Treino A · Superior/ })
    expect(item).toHaveTextContent('2 de 4 séries')
    expect(item).toHaveTextContent('1.000 kg')
    expect(item).toHaveTextContent('47 min')
  })

  it('conta a semana a partir das sessões concluídas, contra a frequência da ficha', async () => {
    renderizar()

    // O número fica num `<span>` próprio (destaque), então o texto do `<p>` é só o resto.
    const linha = await screen.findByText(/de 3 treinos prescritos/)
    expect(linha).toHaveTextContent('1 de 3 treinos prescritos')
  })

  it('abre o detalhe da sessão com a carga usada comparada ao prescrito', async () => {
    renderizar()

    const item = await screen.findByRole('button', { name: /Treino A · Superior/ })
    expect(item).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(item)
    expect(item).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByText(/Prescrito: 2 × 8-12 · 50 kg/)).toBeInTheDocument()
    expect(screen.getByText(/abaixo do prescrito/)).toBeInTheDocument()
    expect(screen.getByText(/acima do prescrito/)).toBeInTheDocument()

    // Exercício prescrito que o aluno não tocou aparece como não registrado, com o nome do catálogo.
    expect(screen.getByText('Crucifixo na máquina')).toBeInTheDocument()
    expect(screen.getByText('Não registrado nesta sessão')).toBeInTheDocument()
  })

  it('não oferece nenhum controle de edição — o personal só lê a execução do aluno', async () => {
    const { container } = renderizar()

    const item = await screen.findByRole('button', { name: /Treino A · Superior/ })
    await userEvent.click(item)

    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(0)
    // O único botão da tela é o que expande o detalhe.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('aluno que nunca treinou vê estado vazio, sem número inventado', async () => {
    listSessions.mockResolvedValue([])
    listSetsForSessions.mockResolvedValue([])

    const { container } = renderizar()

    expect(await screen.findByText(/Nenhum treino registrado ainda/)).toBeInTheDocument()
    expect(screen.getByText(/Nenhum treino concluído nesta semana/)).toBeInTheDocument()
    expect(within(container).queryByText(/0 de/)).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/0 kg/)
  })

  it('sem ficha publicada, explica que não há o que registrar em vez de culpar o aluno', async () => {
    findPublished.mockResolvedValue(null)
    listSessions.mockResolvedValue([])
    listSetsForSessions.mockResolvedValue([])

    renderizar()

    expect(await screen.findByText(/Publique uma ficha/)).toBeInTheDocument()
  })

  it('não consulta séries quando o aluno não tem sessão nenhuma', async () => {
    listSessions.mockResolvedValue([])
    listSetsForSessions.mockResolvedValue([])

    renderizar()
    await screen.findByText(/Nenhum treino registrado ainda/)

    expect(listSetsForSessions).toHaveBeenCalledWith([])
  })
})
