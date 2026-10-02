import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
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

/** Render com os props obrigatórios já preenchidos — cada teste sobrescreve só o que importa. */
function renderStep(props: Partial<ComponentProps<typeof CorrectiveFindingsStep>> = {}) {
  return render(
    <CorrectiveFindingsStep
      suggestions={[]}
      status="ready"
      onRetakePhotos={() => {}}
      onPublish={() => {}}
      publishStatus="idle"
      {...props}
    />,
  )
}

describe('CorrectiveFindingsStep', () => {
  it('lista cada achado com evidência, justificativa e exercícios sugeridos', () => {
    const suggestions = [buildSuggestion('shoulder_elevation', ['0001', '0002'])]

    renderStep({ suggestions })

    expect(screen.getByText('Ombro elevado')).toBeInTheDocument()
    expect(screen.getByText('evidência de shoulder_elevation')).toBeInTheDocument()
    expect(screen.getByText('justificativa de shoulder_elevation')).toBeInTheDocument()
    expect(screen.getByText('Exercício 0001')).toBeInTheDocument()
    expect(screen.getByText('Exercício 0002')).toBeInTheDocument()
  })

  it('mostra mensagem neutra quando não há achados', () => {
    renderStep()

    expect(screen.getByText(/nenhuma alteração relevante/i)).toBeInTheDocument()
  })

  it('mostra o motivo quando um achado não teve exercício aplicável no catálogo', () => {
    const suggestion = buildSuggestion('head_forward', [])
    suggestion.selection.fallback = 'empty'
    suggestion.selection.notice = 'Nenhum exercício do catálogo atende a este achado.'

    renderStep({ suggestions: [suggestion] })

    expect(screen.getByText('Cabeça anteriorizada')).toBeInTheDocument()
    expect(screen.getByText(/nenhum exercício do catálogo atende/i)).toBeInTheDocument()
  })

  it('declara explicitamente que nada ali é diagnóstico médico', () => {
    renderStep()

    expect(screen.getByText(/não é diagnóstico/i)).toBeInTheDocument()
  })

  it('chama onRetakePhotos ao pedir para refazer as fotos', () => {
    const onRetakePhotos = vi.fn()
    renderStep({ onRetakePhotos })

    screen.getByRole('button', { name: /refazer fotos/i }).click()
    expect(onRetakePhotos).toHaveBeenCalledTimes(1)
  })

  describe('relatório', () => {
    it('destaca o ângulo medido de cada ponto de atenção, junto do nome e da vista', () => {
      const suggestion = buildSuggestion('head_forward', ['0001'])
      suggestion.finding.measuredValue = 26.63
      suggestion.finding.view = 'left_side'
      renderStep({ suggestions: [suggestion] })

      const card = screen.getByRole('article', { name: 'Cabeça anteriorizada' })
      expect(card).toHaveTextContent('26,6°')
      expect(card).toHaveTextContent(/lateral esquerda/i)
    })

    it('resume quantos pontos de atenção foram encontrados', () => {
      renderStep({
        suggestions: [buildSuggestion('head_forward', ['0001']), buildSuggestion('knee_hyperextension', ['0002'])],
      })

      expect(screen.getByText(/2 pontos de atenção/i)).toBeInTheDocument()
    })

    it('mostra a prescrição padrão de cada exercício sugerido', () => {
      renderStep({
        suggestions: [buildSuggestion('shoulder_elevation', ['0001']), buildSuggestion('knee_hyperextension', ['0002'])],
      })

      expect(screen.getByRole('article', { name: 'Ombro elevado' })).toHaveTextContent('3 × 12-15')
      expect(screen.getByRole('article', { name: 'Hiperextensão do joelho' })).toHaveTextContent('3 × 10-12')
    })

    it('inclui as medições completas por vista quando fornecidas', () => {
      renderStep({ measurements: <p>medições por vista aqui</p> })

      expect(screen.getByRole('heading', { name: /medições por vista/i })).toBeInTheDocument()
      expect(screen.getByText('medições por vista aqui')).toBeInTheDocument()
    })
  })

  describe('publicação do plano corretivo', () => {
    it('chama onPublish ao clicar em "Publicar plano corretivo"', () => {
      const onPublish = vi.fn()
      renderStep({ suggestions: [buildSuggestion('shoulder_elevation', ['0001'])], onPublish })

      screen.getByRole('button', { name: /publicar plano corretivo/i }).click()
      expect(onPublish).toHaveBeenCalledTimes(1)
    })

    it('desabilita a publicação quando não há nenhum exercício sugerido', () => {
      const suggestion = buildSuggestion('head_forward', [])
      renderStep({ suggestions: [suggestion] })

      expect(screen.getByRole('button', { name: /publicar plano corretivo/i })).toBeDisabled()
    })

    it('não oferece publicação enquanto as sugestões ainda carregam', () => {
      renderStep({ status: 'loading' })

      expect(screen.queryByRole('button', { name: /publicar plano corretivo/i })).not.toBeInTheDocument()
    })

    it('mostra "Publicando…" e bloqueia novo clique enquanto salva', () => {
      renderStep({
        suggestions: [buildSuggestion('shoulder_elevation', ['0001'])],
        publishStatus: 'saving',
      })

      expect(screen.getByRole('button', { name: /publicando/i })).toBeDisabled()
    })

    it('só confirma a publicação quando o status é success', () => {
      const suggestions = [buildSuggestion('shoulder_elevation', ['0001'])]
      const { rerender } = renderStep({ suggestions })
      expect(screen.queryByText(/plano corretivo publicado/i)).not.toBeInTheDocument()

      rerender(
        <CorrectiveFindingsStep
          suggestions={suggestions}
          status="ready"
          onRetakePhotos={() => {}}
          onPublish={() => {}}
          publishStatus="success"
        />,
      )
      expect(screen.getByText(/plano corretivo publicado/i)).toBeInTheDocument()
    })

    it('mostra o erro real da publicação e mantém o botão disponível para tentar de novo', () => {
      renderStep({
        suggestions: [buildSuggestion('shoulder_elevation', ['0001'])],
        publishStatus: 'error',
        publishErrorMessage: 'permission denied for table corrective_plans',
      })

      expect(screen.getByText(/não foi possível publicar/i)).toBeInTheDocument()
      expect(screen.getByText('permission denied for table corrective_plans')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /publicar plano corretivo/i })).toBeEnabled()
    })
  })
})
