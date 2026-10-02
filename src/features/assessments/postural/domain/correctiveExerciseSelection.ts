/**
 * Seleção de exercícios corretivos para um achado postural — função pura e determinística.
 * Ver docs/CORRECTIVE_PRESCRIPTION.md, seção 3.
 *
 * O catálogo (`Exercise[]`) já vem traduzido para pt-BR pela camada existente
 * (`exerciseCatalogRepository` / `domain/exerciseCatalog.ts`); `finding.targetMuscles` usa o
 * vocabulário cru do dataset (inglês, ver `correctivePrescription.ts`), então a tradução acontece
 * aqui, na hora de casar achado com catálogo.
 */
import type { Exercise } from '@/features/workouts/domain/exercise.types'
import { translateBodyPart, translateEquipment, translateMuscle } from '@/features/workouts/domain/exerciseTaxonomy'
import { CORRECTIVE_TARGET_LINKS } from './correctivePrescription'
import type { PosturalFinding } from './correctivePrescription.types'

const DEFAULT_PER_FINDING = 3

/** `body weight` já traduzido — tratado como sempre disponível, independente do perfil do aluno. */
const BODY_WEIGHT_EQUIPMENT = translateEquipment('body weight')

export type CorrectiveSelectionFallback = 'none' | 'equipment_relaxed' | 'body_part' | 'empty'

export interface CorrectiveExerciseSelectionOptions {
  /** Equipamentos disponíveis no local de treino do aluno (vocabulário traduzido do catálogo). */
  availableEquipment: string[]
  /** Quantos exercícios devolver no máximo. Padrão 3 (seção 3.2.5 da spec). */
  perFinding?: number
}

export interface CorrectiveExerciseSelectionResult {
  exercises: Exercise[]
  fallback: CorrectiveSelectionFallback
  /** Motivo em pt-BR para o treinador, presente sempre que o fallback relaxa algum critério. */
  notice?: string
}

function isBodyWeight(exercise: Exercise): boolean {
  return exercise.equipment === BODY_WEIGHT_EQUIPMENT
}

function isEquipmentAvailable(exercise: Exercise, available: ReadonlySet<string>): boolean {
  return isBodyWeight(exercise) || available.has(exercise.equipment)
}

function hasSynergy(exercise: Exercise, translatedTargets: ReadonlySet<string>): boolean {
  return exercise.secondaryMuscles.some((muscle) => translatedTargets.has(muscle))
}

/**
 * Padrão de movimento — verificado contra `originalName` (inglês) pelo mesmo motivo do passo 0 (a
 * tradução pt-BR pode não preservar a palavra-chave). `patterns` vem de `movementPatterns` na
 * tabela de vínculos (seção 2.4 da spec) — é conhecimento POR ACHADO, nunca uma lista global.
 *
 * Existe porque `sinergia` (via `secondaryMuscles`) sozinha NÃO distingue, por exemplo, remada
 * alta/encolhimento de isolamentos de deltoide (elevação frontal/lateral) para "ombro elevado":
 * ambos os grupos costumam listar o mesmo músculo secundário (trapézio) e as elevações de
 * isolamento em geral têm menos `steps`, então venciam o desempate — confirmado rodando contra o
 * catálogo real de 1324 exercícios.
 *
 * Uma tentativa anterior usou uma lista global (`row`/`shrug`/`pull`) aplicada a todo achado — e
 * reprovou na validação de 21/09 contra o catálogo real: `pull` casa com `rack pull`/`snatch
 * pull`/`leg pull` (exercícios de costas e perna) e passou a dominar achados de joelho/pelve; e
 * `shoulder_elevation`/`shoulder_depression` (correções opostas) devolviam a mesma lista. Daí o
 * padrão vir por achado, nunca de uma constante global.
 */
function matchesMovementPattern(exercise: Exercise, patterns: readonly string[]): boolean {
  const original = exercise.originalName.toLowerCase()
  return patterns.some((pattern) => original.includes(pattern))
}

/**
 * Passo 0 da seção 3.2: exclui alongamento e salto/impacto ANTES de qualquer outro filtro.
 * Checa `originalName` (inglês) porque a tradução pt-BR pode não conter essas palavras — ex.:
 * "rear deltoid stretch" traduzido pode perder o radical "stretch" que identifica o alongamento.
 * Alongamento é outra etapa do protocolo (não substitui o corretivo) e salto é contraindicado
 * para achado de joelho (impacto em articulação já desalinhada).
 */
function isStrengtheningExercise(exercise: Exercise): boolean {
  const original = exercise.originalName.toLowerCase()
  return !original.includes('stretch') && !original.includes('jump')
}

/**
 * Ordena por prioridade (seção 3.2.3, ATUALIZADA): padrão de movimento do achado primeiro (ver
 * `matchesMovementPattern`), depois sinergia via `secondaryMuscles`, depois menos passos. Peso
 * corporal SAIU da prioridade — é critério de disponibilidade (filtrado antes), não de qualidade
 * corretiva; colocá-lo primeiro fazia o motor preferir alongamentos de peso corporal a remadas
 * altas com barra/halteres para o mesmo achado (ver seção 3.2, passo 0). Desempate final por `id`
 * — garante uma ordem total e portanto determinismo mesmo quando dois exercícios empatam no resto.
 *
 * Regra de segurança (seção 2.4 da spec): se NENHUM candidato casa `movementPatterns`, o critério
 * (a) não precisa de tratamento especial — `patternRank` dá empate (0) para todo par nesse caso, e
 * a ordenação cai naturalmente para sinergia/steps. Nunca zera o resultado.
 */
function compareByPriority(
  a: Exercise,
  b: Exercise,
  translatedTargets: ReadonlySet<string>,
  movementPatterns: readonly string[],
): number {
  const patternRank =
    (matchesMovementPattern(a, movementPatterns) ? 0 : 1) - (matchesMovementPattern(b, movementPatterns) ? 0 : 1)
  if (patternRank !== 0) return patternRank

  const synergyRank =
    (hasSynergy(a, translatedTargets) ? 0 : 1) - (hasSynergy(b, translatedTargets) ? 0 : 1)
  if (synergyRank !== 0) return synergyRank

  const stepsRank = a.steps.length - b.steps.length
  if (stepsRank !== 0) return stepsRank

  return a.id.localeCompare(b.id)
}

/**
 * Corta em `limit` evitando repetir `muscleGroup`, mas completa com repetições se não houver
 * `muscleGroup` alternativo suficiente (seção 3.2.4 e 3.2.5 da spec).
 */
function diversifyByMuscleGroup(sortedByPriority: Exercise[], limit: number): Exercise[] {
  const picked: Exercise[] = []
  const pickedIds = new Set<string>()
  const usedMuscleGroups = new Set<string>()

  for (const exercise of sortedByPriority) {
    if (picked.length >= limit) break
    if (usedMuscleGroups.has(exercise.muscleGroup)) continue
    picked.push(exercise)
    pickedIds.add(exercise.id)
    usedMuscleGroups.add(exercise.muscleGroup)
  }

  if (picked.length < limit) {
    for (const exercise of sortedByPriority) {
      if (picked.length >= limit) break
      if (pickedIds.has(exercise.id)) continue
      picked.push(exercise)
      pickedIds.add(exercise.id)
    }
  }

  return picked
}

function selectFrom(
  candidates: Exercise[],
  translatedTargets: ReadonlySet<string>,
  movementPatterns: readonly string[],
  perFinding: number,
): Exercise[] {
  return diversifyByMuscleGroup(
    [...candidates].sort((a, b) => compareByPriority(a, b, translatedTargets, movementPatterns)),
    perFinding,
  )
}

/**
 * Seleciona até `perFinding` exercícios do catálogo para um achado postural. Determinística:
 * mesma entrada (achado + catálogo + equipamento) sempre devolve a mesma saída, sem
 * `Math.random()` — o treinador precisa poder reconferir a sugestão (seção 3.4 da spec).
 *
 * Nunca inventa exercício fora do catálogo: no pior caso (nenhum candidato em nenhum nível de
 * fallback), devolve lista vazia com o motivo em `notice`.
 */
export function selectCorrectiveExercises(
  finding: PosturalFinding,
  catalog: Exercise[],
  options: CorrectiveExerciseSelectionOptions,
): CorrectiveExerciseSelectionResult {
  const perFinding = options.perFinding ?? DEFAULT_PER_FINDING
  const availableEquipment = new Set(options.availableEquipment)
  const translatedTargets = new Set(finding.targetMuscles.map(translateMuscle))
  const translatedBodyParts = new Set(finding.targetMuscles.map(translateBodyPart))
  // Padrão de movimento é conhecimento do achado (tabela 2.4), nunca uma constante global.
  const movementPatterns = CORRECTIVE_TARGET_LINKS[finding.kind].movementPatterns

  // Passo 0 (seção 3.2): fora alongamento/salto antes de qualquer outro filtro, inclusive fallback.
  const strengtheningCatalog = catalog.filter(isStrengtheningExercise)

  const byTarget = strengtheningCatalog.filter((exercise) => translatedTargets.has(exercise.target))
  const byTargetAndEquipment = byTarget.filter((exercise) => isEquipmentAvailable(exercise, availableEquipment))

  if (byTargetAndEquipment.length > 0) {
    return {
      exercises: selectFrom(byTargetAndEquipment, translatedTargets, movementPatterns, perFinding),
      fallback: 'none',
    }
  }

  // Fallback 1: relaxa equipamento — mantém o filtro por `target`, aceita qualquer equipamento.
  if (byTarget.length > 0) {
    return {
      exercises: selectFrom(byTarget, translatedTargets, movementPatterns, perFinding),
      fallback: 'equipment_relaxed',
      notice:
        'Nenhum exercício para este achado está disponível com o equipamento informado. Sugestão inclui equipamentos fora do perfil do aluno — revise antes de publicar.',
    }
  }

  // Fallback 2: relaxa para `bodyPart` em vez de `target`, ainda preferindo equipamento disponível.
  const byBodyPart = strengtheningCatalog.filter((exercise) => translatedBodyParts.has(exercise.bodyPart))
  const byBodyPartAndEquipment = byBodyPart.filter((exercise) => isEquipmentAvailable(exercise, availableEquipment))
  const bodyPartCandidates = byBodyPartAndEquipment.length > 0 ? byBodyPartAndEquipment : byBodyPart

  if (bodyPartCandidates.length > 0) {
    return {
      exercises: selectFrom(bodyPartCandidates, translatedTargets, movementPatterns, perFinding),
      fallback: 'body_part',
      notice:
        'Nenhum exercício do catálogo tem os grupos musculares-alvo deste achado. Sugestão baseada na região do corpo relacionada — revise antes de publicar.',
    }
  }

  // Fallback 3: nada aplicável no catálogo — nunca inventar exercício fora dele.
  return {
    exercises: [],
    fallback: 'empty',
    notice: 'Nenhum exercício do catálogo atende a este achado. Adicione manualmente um exercício adequado.',
  }
}
