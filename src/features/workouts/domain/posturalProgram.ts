/**
 * Curadoria dos exercícios sugeridos na área de Correção Postural.
 *
 * São recortes do catálogo por região do corpo e equipamento — uma **sugestão de biblioteca**,
 * nunca uma prescrição automática a partir das métricas da Avaliação Postural. A indicação
 * continua sendo do profissional (ver docs/POSTURAL_ASSESSMENT.md).
 */
import type { Exercise } from './exercise.types'

export type PosturalCategoryId = 'mobilidade' | 'alongamento' | 'fortalecimento'

export interface PosturalCategory {
  id: PosturalCategoryId
  label: string
  description: string
}

export const POSTURAL_CATEGORIES: readonly PosturalCategory[] = [
  {
    id: 'mobilidade',
    label: 'Mobilidade',
    description: 'Movimentos de amplitude para quadril, coluna e ombros, sem carga externa.',
  },
  {
    id: 'alongamento',
    label: 'Alongamento',
    description: 'Alongamentos da cadeia posterior, peitoral e flexores do quadril.',
  },
  {
    id: 'fortalecimento',
    label: 'Fortalecimento',
    description: 'Core, dorsais e glúteos — a musculatura que sustenta o alinhamento.',
  },
] as const

/** Regiões relevantes para postura, já nos rótulos pt-BR de `exerciseTaxonomy.ts`. */
const POSTURAL_BODY_PARTS = new Set(['Costas', 'Core', 'Ombros', 'Pescoço', 'Coxas'])

/** Equipamentos compatíveis com prescrição domiciliar. */
const LOW_EQUIPMENT = new Set(['Peso corporal', 'Elástico', 'Faixa elástica', 'Rolo', 'Bola suíça'])

const STRENGTH_TARGETS = new Set([
  'Abdômen',
  'Coluna',
  'Glúteos',
  'Dorsais',
  'Dorsal superior',
  'Trapézio',
])

/** Um alongamento é identificado pelo nome original — "stretch" é o termo do dataset. */
function isStretch(exercise: Exercise): boolean {
  return exercise.originalName.includes('stretch')
}

export function selectPosturalExercises(
  exercises: Exercise[],
  category: PosturalCategoryId,
): Exercise[] {
  if (category === 'alongamento') {
    return exercises.filter(isStretch)
  }

  if (category === 'fortalecimento') {
    return exercises.filter(
      (exercise) =>
        !isStretch(exercise) &&
        STRENGTH_TARGETS.has(exercise.target) &&
        LOW_EQUIPMENT.has(exercise.equipment),
    )
  }

  return exercises.filter(
    (exercise) =>
      !isStretch(exercise) &&
      POSTURAL_BODY_PARTS.has(exercise.bodyPart) &&
      LOW_EQUIPMENT.has(exercise.equipment),
  )
}
