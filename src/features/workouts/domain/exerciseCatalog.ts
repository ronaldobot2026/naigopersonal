/**
 * Mapeamento do dataset cru para o modelo de domínio, incluindo tradução pt-BR e busca.
 *
 * Funções puras — nenhuma faz I/O. O carregamento fica em
 * `repositories/exerciseCatalogRepository.ts`, o que permite testar todo o mapeamento sem rede.
 */
import type {
  Exercise,
  ExerciseCatalog,
  ExerciseFilters,
  InstructionTranslations,
  RawExercise,
  RawExerciseCatalog,
} from './exercise.types'
import { translateExerciseName } from './exerciseNaming'
import { findAliasesForName } from './exerciseSearchAliases'
import { translateBodyPart, translateEquipment, translateMuscle } from './exerciseTaxonomy'

/**
 * CDN da mídia. As imagens e GIFs são © Gym visual e o dataset os distribui apenas em 180×180,
 * exigindo atribuição visível em toda tela que os exiba (ver NOTICE.md do dataset e
 * docs/EXERCISE_CATALOG.md). Servimos por jsDelivr em vez de copiar os arquivos para o projeto.
 */
const MEDIA_CDN_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main'

function buildMediaUrl(path: string): string {
  return `${MEDIA_CDN_BASE}/${path}`
}

/** Minúsculas sem acento — deixa "abdômen" e "abdomen" casarem na busca. */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

/** Idioma marcado nos passos já traduzidos. */
export const TRANSLATED_STEPS_LANGUAGE = 'pt-BR'

/**
 * Traduz os passos, tudo ou nada.
 *
 * Se um único passo não tiver tradução, o exercício inteiro fica em inglês. Um exercício com
 * metade das instruções em português e metade em inglês é pior de ler do que um exercício
 * inteiramente em inglês, e esconde do usuário que a tradução está incompleta.
 */
function translateSteps(
  steps: string[],
  translations: InstructionTranslations,
): { steps: string[]; language: string } | null {
  const translated: string[] = []

  for (const step of steps) {
    const match = translations[step]
    if (!match) return null
    translated.push(match)
  }

  return { steps: translated, language: TRANSLATED_STEPS_LANGUAGE }
}

function toExercise(
  raw: RawExercise,
  sourceLanguage: string,
  translations: InstructionTranslations,
): Exercise {
  const translatedName = translateExerciseName(raw.name)
  const bodyPart = translateBodyPart(raw.bodyPart)
  const equipment = translateEquipment(raw.equipment)
  const target = translateMuscle(raw.target)
  const muscleGroup = translateMuscle(raw.muscleGroup)
  const secondaryMuscles = raw.secondaryMuscles.map(translateMuscle)

  // Os apelidos de academia entram só no texto de busca, nunca no nome exibido: quem procura
  // "stiff" precisa encontrar `straight leg deadlift`, mas o cartão continua mostrando o nome
  // traduzido do exercício. Ver exerciseSearchAliases.ts.
  const searchText = normalizeForSearch(
    [
      translatedName.value,
      raw.name,
      bodyPart,
      equipment,
      target,
      muscleGroup,
      ...secondaryMuscles,
      ...findAliasesForName(raw.name),
    ].join(' '),
  )

  const localizedSteps = translateSteps(raw.steps, translations)

  return {
    id: raw.id,
    name: translatedName.value,
    originalName: raw.name,
    isNameTranslated: translatedName.isTranslated,
    bodyPart,
    equipment,
    target,
    muscleGroup,
    secondaryMuscles,
    steps: localizedSteps?.steps ?? raw.steps,
    stepsLanguage: localizedSteps?.language ?? sourceLanguage,
    imageUrl: buildMediaUrl(raw.image),
    gifUrl: buildMediaUrl(raw.gif),
    searchText,
  }
}

/** Converte o catálogo cru em domínio, já ordenado alfabeticamente pelo nome exibido. */
export function toExerciseCatalog(
  raw: RawExerciseCatalog,
  translations: InstructionTranslations = {},
): ExerciseCatalog {
  const exercises = raw.exercises
    .map((item) => toExercise(item, raw.sourceLanguage, translations))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return {
    exercises,
    translatedStepsCount: exercises.filter(
      (exercise) => exercise.stepsLanguage === TRANSLATED_STEPS_LANGUAGE,
    ).length,
    mediaAttribution: raw.mediaAttribution,
    source: raw.source,
    stepsLanguage: raw.sourceLanguage,
  }
}

/** Valores distintos de um campo, ordenados — alimenta os seletores de filtro. */
export function collectFacet(exercises: Exercise[], field: keyof Exercise): string[] {
  const values = new Set<string>()
  for (const exercise of exercises) {
    const value = exercise[field]
    if (typeof value === 'string' && value.length > 0) values.add(value)
  }
  return [...values].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Aplica busca textual e filtros. Todos os termos da busca precisam aparecer (AND), o que torna
 * "rosca halteres" mais útil que a busca por frase exata.
 */
export function filterExercises(exercises: Exercise[], filters: ExerciseFilters): Exercise[] {
  const terms = normalizeForSearch(filters.search).split(/\s+/).filter(Boolean)

  return exercises.filter((exercise) => {
    if (filters.bodyPart && exercise.bodyPart !== filters.bodyPart) return false
    if (filters.equipment && exercise.equipment !== filters.equipment) return false
    if (filters.target && exercise.target !== filters.target) return false
    return terms.every((term) => exercise.searchText.includes(term))
  })
}
