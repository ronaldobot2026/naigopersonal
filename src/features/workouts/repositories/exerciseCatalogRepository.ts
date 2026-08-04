/**
 * Carrega o catálogo de exercícios (~1 MB) sob demanda.
 *
 * O arquivo NÃO entra no bundle JS: fica em `public/data/exercises.json` e é buscado na primeira
 * vez que alguma tela precisa dele. A promessa em andamento é memoizada, então várias telas
 * montando ao mesmo tempo compartilham uma única requisição.
 */
import { toExerciseCatalog } from '../domain/exerciseCatalog'
import type {
  ExerciseCatalog,
  InstructionTranslations,
  RawExerciseCatalog,
} from '../domain/exercise.types'

const CATALOG_URL = '/data/exercises.json'
const TRANSLATIONS_URL = '/data/instructions.pt-BR.json'

let cachedRequest: Promise<ExerciseCatalog> | null = null

/**
 * As traduções são opcionais: se o arquivo faltar ou vier corrompido, o catálogo carrega mesmo
 * assim com os passos no idioma de origem. Uma tradução ausente não pode derrubar a biblioteca
 * inteira de exercícios.
 */
async function fetchTranslations(): Promise<InstructionTranslations> {
  try {
    const response = await fetch(TRANSLATIONS_URL)
    if (!response.ok) return {}
    const data: unknown = await response.json()
    return typeof data === 'object' && data !== null ? (data as InstructionTranslations) : {}
  } catch {
    return {}
  }
}

async function fetchCatalog(): Promise<ExerciseCatalog> {
  // Em paralelo: os dois arquivos são independentes e somam ~1 MB.
  const [response, translations] = await Promise.all([fetch(CATALOG_URL), fetchTranslations()])

  if (!response.ok) {
    throw new Error(`Falha ao carregar o catálogo de exercícios (HTTP ${response.status}).`)
  }

  const raw = (await response.json()) as RawExerciseCatalog
  if (!Array.isArray(raw?.exercises) || raw.exercises.length === 0) {
    throw new Error('Catálogo de exercícios vazio ou em formato inesperado.')
  }

  return toExerciseCatalog(raw, translations)
}

export function loadExerciseCatalog(): Promise<ExerciseCatalog> {
  if (!cachedRequest) {
    // Uma falha não pode envenenar o cache — sem isso, um erro de rede transitório impediria
    // qualquer nova tentativa durante toda a sessão.
    cachedRequest = fetchCatalog().catch((error: unknown) => {
      cachedRequest = null
      throw error
    })
  }
  return cachedRequest
}

/** Usado apenas em testes, para isolar o cache entre casos. */
export function resetExerciseCatalogCache(): void {
  cachedRequest = null
}
