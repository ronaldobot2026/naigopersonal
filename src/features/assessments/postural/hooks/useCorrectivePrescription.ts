import { useMemo } from 'react'
import { useExerciseCatalog } from '@/features/workouts/hooks/useExerciseCatalog'
import { buildFindingSuggestions, type FindingSuggestion } from '../domain/correctivePlan'
import type { PosturalAssessment } from '../domain/posturalAssessment.types'

/**
 * Equipamentos assumidos como disponíveis enquanto o perfil do aluno ainda não expõe um campo de
 * local de treino/equipamento (docs/CORRECTIVE_PRESCRIPTION.md, seção 3.1 exige esse campo como
 * obrigatório — pendência de produto). É um conjunto caseiro conservador; o motor relaxa o
 * equipamento via fallback quando nada bate, e o treinador revisa antes de publicar.
 */
export const HOME_EQUIPMENT = ['Peso corporal', 'Halteres', 'Elástico', 'Barra']

interface UseCorrectivePrescriptionResult {
  status: 'loading' | 'ready' | 'error'
  suggestions: FindingSuggestion[]
  errorMessage: string | undefined
}

/**
 * Deriva os achados posturais (em "attention") e seleciona os exercícios corretivos sugeridos
 * para cada um, usando o catálogo de exercícios. Puro sobre `buildFindingSuggestions` — a
 * derivação em si não tem efeito colateral nem rede além do catálogo.
 */
export function useCorrectivePrescription(
  posturalAssessment: PosturalAssessment | undefined,
): UseCorrectivePrescriptionResult {
  const { status, catalog, errorMessage } = useExerciseCatalog()

  const suggestions = useMemo(() => {
    if (!posturalAssessment || !catalog) return []
    return buildFindingSuggestions(posturalAssessment.metrics, catalog.exercises, HOME_EQUIPMENT)
  }, [posturalAssessment, catalog])

  return { status, suggestions, errorMessage }
}
