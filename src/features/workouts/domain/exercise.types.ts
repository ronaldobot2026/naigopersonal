/**
 * Modelo de domínio do catálogo de exercícios.
 *
 * A origem é o dataset público https://github.com/hasaneyldrm/exercises-dataset (texto sob
 * licença MIT). O arquivo cru fica em `public/data/exercises.json`, gerado por
 * `scripts/build-exercises.mjs`; a tradução para pt-BR acontece no mapeamento
 * (`exerciseCatalog.ts`), não no arquivo.
 */

/** Registro exatamente como sai de `public/data/exercises.json`. */
export interface RawExercise {
  id: string
  name: string
  bodyPart: string
  equipment: string
  target: string
  muscleGroup: string
  secondaryMuscles: string[]
  steps: string[]
  mediaId: string
  image: string
  gif: string
}

export interface RawExerciseCatalog {
  source: string
  sourceLanguage: string
  mediaAttribution: string
  generatedAt: string
  exercises: RawExercise[]
}

/** Exercício já traduzido e pronto para a UI. */
export interface Exercise {
  id: string
  /** Nome exibido — pt-BR quando o movimento foi reconhecido, senão o original em inglês. */
  name: string
  /** Nome original em inglês, preservado para busca e rastreabilidade. */
  originalName: string
  isNameTranslated: boolean
  bodyPart: string
  equipment: string
  target: string
  muscleGroup: string
  secondaryMuscles: string[]
  /**
   * Passos de execução. Ficam em pt-BR quando **todos** os passos do exercício têm tradução;
   * caso contrário permanecem no idioma de origem (inglês). Misturar os dois idiomas dentro do
   * mesmo exercício seria pior que manter tudo em inglês — daí a regra ser tudo ou nada.
   */
  steps: string[]
  /** `'pt-BR'` ou o idioma de origem do dataset. A UI sinaliza quando não é português. */
  stepsLanguage: string
  /** URL absoluta da imagem 180×180 servida por CDN. */
  imageUrl: string
  /** URL absoluta do GIF de animação 180×180 servido por CDN. */
  gifUrl: string
  /** Texto de busca pré-normalizado (pt-BR + inglês + músculos), sem acentos e em minúsculas. */
  searchText: string
}

/** Mapa passo em inglês → passo em pt-BR (`public/data/instructions.pt-BR.json`). */
export type InstructionTranslations = Record<string, string>

export interface ExerciseCatalog {
  exercises: Exercise[]
  /** Quantos exercícios têm os passos de execução em português. */
  translatedStepsCount: number
  /** Atribuição obrigatória da mídia (© Gym visual) — deve aparecer onde a mídia é exibida. */
  mediaAttribution: string
  source: string
  stepsLanguage: string
}

export interface ExerciseFilters {
  search: string
  bodyPart: string | null
  equipment: string | null
  target: string | null
}

export const EMPTY_EXERCISE_FILTERS: ExerciseFilters = {
  search: '',
  bodyPart: null,
  equipment: null,
  target: null,
}
