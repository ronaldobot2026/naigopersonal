import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Exercise } from '@/features/workouts/domain/exercise.types'
import type { FindingSuggestion } from '../domain/correctivePlan'
import type { PosturalFinding } from '../domain/correctivePrescription.types'
import { CorrectiveFindingsStep } from '../components/CorrectiveFindingsStep'

function buildExercise(id: string, target: string): Exercise {
  return {
    id,
    name: `Exercício ${id}`,
    originalName: `exercise ${id}`,
    isNameTranslated: true,
    bodyPart: 'Ombros',
    muscleGroup: 'Ombros',
    secondaryMuscles: [],
    steps: ['Passo único.'],
    stepsLanguage: 'pt-BR',
    imageUrl: `https://cdn.example/${id}.jpg`,
    gifUrl: `https://cdn.example/${id}.gif`,
    searchText: id,
    target,
    equipment: 'Peso corporal',
  }
}

function buildSuggestion(
  kind: PosturalFinding['kind'],
  exerciseIds: string[],
): FindingSuggestion {
  const finding: PosturalFinding = {
    id: `finding:${kind}`,
    kind,
    side: 'bilateral',
    sourceMetricId: `test.${kind}`,
    view: 'front',
    measuredValue: 4.2,
    thresholdValue: 3,
    evidence: `evidência de ${kind}`,
    targetMuscles: ['traps'],
    rationale: `justificativa de ${kind}`,
  }

  return {
    finding,
    selection: {
      exercises: exerciseIds.map((id) => buildExercise(id, 'Trapézio')),
      fallback: 'none',
    },
  }
}

describe('CorrectiveFindingsStep', () => {
  it('lista cada achado com evidência, justificativa e exercícios sugeridos', () => {
    const suggestions = [buildSuggestion('shoulder_elevation', ['0001', '0002'])]

    render(
      <CorrectiveFindingsStep suggestions={suggestions} status="ready" onBack={() => {}} />,
    )

    expect(screen.getByText('Ombro elevado')).toBeInTheDocument()
    expect(screen.getByText('evidência de shoulder_elevation')).toBeInTheDocument()
    expect(screen.getByText('justificativa de shoulder_elevation')).toBeInTheDocument()
    expect(screen.getByText('Exercício 0001')).toBeInTheDocument()
    expect(screen.getByText('Exercício 0002')).toBeInTheDocument()
  })

  it('mostra mensagem neutra quando não há achados', () => {
    render(<CorrectiveFindingsStep suggestions={[]} status="ready" onBack={() => {}} />)

    expect(screen.getByText(/nenhuma alteração relevante/i)).toBeInTheDocument()
  })

  it('mostra o motivo quando um achado não teve exercício aplicável no catálogo', () => {
    const suggestion = buildSuggestion('head_forward', [])
    suggestion.selection.fallback = 'empty'
    suggestion.selection.notice = 'Nenhum exercício do catálogo atende a este achado.'

    render(<CorrectiveFindingsStep suggestions={[suggestion]} status="ready" onBack={() => {}} />)

    expect(screen.getByText('Cabeça anteriorizada')).toBeInTheDocument()
    expect(screen.getByText(/nenhum exercício do catálogo atende/i)).toBeInTheDocument()
  })

  it('declara explicitamente que nada ali é diagnóstico médico', () => {
    render(<CorrectiveFindingsStep suggestions={[]} status="ready" onBack={() => {}} />)

    expect(screen.getByText(/não é diagnóstico/i)).toBeInTheDocument()
  })

  it('chama onBack ao voltar para o checklist', () => {
    const onBack = vi.fn()
    render(<CorrectiveFindingsStep suggestions={[]} status="ready" onBack={onBack} />)

    screen.getByRole('button', { name: /voltar/i }).click()
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
