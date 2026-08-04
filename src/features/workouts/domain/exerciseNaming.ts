/**
 * Tradução dos nomes de exercício do dataset (inglês) para pt-BR, por regras.
 *
 * Estratégia: reconhecer o movimento principal, extrair equipamento e modificadores e remontar
 * na ordem natural do português — `movimento + termos remanescentes + modificadores + equipamento`
 * ("incline dumbbell bench press" → "Supino inclinado com halteres").
 *
 * Duas regras de segurança, ambas para evitar nomes enganosos:
 *
 * 1. **Só traduz quando reconhece o movimento.** Sem movimento identificado, devolve o nome
 *    original em inglês — um nome estrangeiro é melhor que uma tradução errada.
 * 2. **Nunca descarta termo desconhecido.** Se "superman", "pistol" ou "zottman" não estão no
 *    dicionário, eles seguem no nome traduzido. Descartá-los faria "superman push-up" e
 *    "chest tap push-up" colapsarem no mesmo "Flexão de braço", tornando-os indistinguíveis
 *    na biblioteca.
 */
import {
  BODY_NOUNS_IN_NAME,
  EQUIPMENT_IN_NAME,
  MODIFIERS,
  MOVEMENTS,
  type MovementTerm,
} from './exerciseNameDictionary'

export interface TranslatedName {
  /** Nome exibido: em pt-BR quando reconhecido, senão o original em inglês. */
  value: string
  isTranslated: boolean
}

/** Preposições e artigos que não agregam significado depois da remontagem em português. */
const STOPWORDS = new Set(['with', 'on', 'to', 'the', 'and', 'of', 'a', 'in', 'at', 'for', 'from'])

/** Artefatos de catálogo do dataset — variações de versão e de modelo da foto. */
const NOISE = new Set(['v', 'v.', 'male', 'female', 'pov', 'version', 'exercise'])

/** Normaliza artefatos de codificação do dataset e uniformiza separadores. */
function normalize(name: string): string {
  return name.toLowerCase().replace(/в°/g, '°').replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Remove ruído de catálogo: marcadores de versão, gênero do modelo e numeração solta. */
function stripNoise(text: string): string {
  return text
    .split(' ')
    .filter((token) => token.length > 0 && !NOISE.has(token) && !/^\d+$/.test(token))
    .join(' ')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function phrasePattern(phrase: string): RegExp {
  return new RegExp(`(^|\\s)${escapeRegExp(phrase)}(\\s|$)`)
}

/** Remove a primeira ocorrência de `phrase` e devolve o texto restante, ou `null` se não houver. */
function extractPhrase(text: string, phrase: string): string | null {
  const pattern = phrasePattern(phrase)
  return pattern.test(text) ? text.replace(pattern, ' ').replace(/\s+/g, ' ').trim() : null
}

interface MovementMatch {
  term: MovementTerm
  rest: string
}

/**
 * Escolhe o movimento pela expressão que **termina** mais à direita — em inglês o núcleo de um
 * composto fica no fim ("biceps curl to shoulder press" tem "shoulder press" como núcleo).
 * Comparar pelo fim, e não pelo início, é o que faz "bench press" vencer "press": as duas
 * terminam no mesmo ponto, e o empate fica com a expressão mais longa.
 */
function matchMovement(text: string): MovementMatch | null {
  let best: { phrase: string; term: MovementTerm; end: number } | null = null

  for (const [phrase, term] of MOVEMENTS) {
    const match = phrasePattern(phrase).exec(text)
    if (!match) continue

    const end = match.index + match[0].length
    const isBetter =
      best === null || end > best.end || (end === best.end && phrase.length > best.phrase.length)
    if (isBetter) best = { phrase, term, end }
  }

  if (!best) return null
  return { term: best.term, rest: extractPhrase(text, best.phrase) ?? text }
}

interface EquipmentMatch {
  suffix: string | null
  rest: string
}

/**
 * Extrai o equipamento. Quando o nome cita mais de um (ex.: "cable ... with rope"), o primeiro
 * do dicionário vira o complemento e os demais são removidos — são acessórios, não o aparelho.
 */
function matchEquipment(text: string, movementPt: string): EquipmentMatch {
  let suffix: string | null = null
  let remaining = text

  for (const [phrase, candidate] of EQUIPMENT_IN_NAME) {
    const rest = extractPhrase(remaining, phrase)
    if (rest === null) continue
    remaining = rest
    // "sled leg press" já diz "leg press" no movimento — não repetir "no leg press".
    const isRedundant = movementPt.includes(candidate.replace(/^(com|no|na) /, ''))
    if (suffix === null && !isRedundant) suffix = candidate
  }

  return { suffix, rest: remaining }
}

interface ModifierMatch {
  modifiers: string[]
  rest: string
}

/** Coleta todos os modificadores presentes, preservando a ordem do dicionário. */
function matchModifiers(text: string, gender: 'm' | 'f'): ModifierMatch {
  const modifiers: string[] = []
  let remaining = text

  for (const [phrase, forms] of MODIFIERS) {
    const rest = extractPhrase(remaining, phrase)
    if (rest === null) continue
    remaining = rest
    const form = forms[gender]
    if (!modifiers.includes(form)) modifiers.push(form)
  }

  return { modifiers, rest: remaining }
}

interface NounMatch {
  nouns: string[]
  rest: string
}

/**
 * Traduz substantivos anatômicos soltos ("front shoulder raise" → "elevação de ombro frontal").
 * Ignora os que o movimento já expressa, para não gerar "extensão de tríceps de tríceps".
 */
function matchBodyNouns(text: string, movementPt: string): NounMatch {
  const nouns: string[] = []
  let remaining = text

  for (const [phrase, translation] of BODY_NOUNS_IN_NAME) {
    const rest = extractPhrase(remaining, phrase)
    if (rest === null) continue
    remaining = rest
    if (!movementPt.includes(translation) && !nouns.includes(translation)) {
      nouns.push(translation)
    }
  }

  return { nouns, rest: remaining }
}

/** Primeira letra maiúscula, preservando o restante (siglas e nomes próprios). */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Traduz o nome de um exercício para pt-BR quando o movimento é reconhecido.
 * Determinística e sem efeitos colaterais — a mesma entrada sempre produz a mesma saída.
 */
export function translateExerciseName(englishName: string): TranslatedName {
  const normalized = stripNoise(normalize(englishName))
  const movement = matchMovement(normalized)

  if (!movement) {
    return { value: englishName, isTranslated: false }
  }

  const equipment = matchEquipment(movement.rest, movement.term.pt)
  const { modifiers, rest } = matchModifiers(equipment.rest, movement.term.gender)
  const { nouns, rest: leftoverText } = matchBodyNouns(rest, movement.term.pt)
  const leftovers = leftoverText
    .split(' ')
    .filter((token) => token.length > 0 && !STOPWORDS.has(token))

  const parts = [movement.term.pt, ...nouns, ...leftovers, ...modifiers]
  if (equipment.suffix) parts.push(equipment.suffix)

  return { value: capitalize(parts.join(' ')), isTranslated: true }
}
