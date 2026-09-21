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
 * Ordena por prioridade (seção 3.2.3): peso corporal primeiro, depois sinergia via
 * `secondaryMuscles`, depois menos passos. Desempate final por `id` — garante uma ordem total e
 * portanto determinismo mesmo quando dois exercícios empatam em tudo o mais.
 */
function compareByPriority(a: Exercise, b: Exercise, translatedTargets: ReadonlySet<string>): number {
  const bodyWeightRank = (isBodyWeight(a) ? 0 : 1) - (isBodyWeight(b) ? 0 : 1)
  if (bodyWeightRank !== 0) return bodyWeightRank

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
  perFinding: number,
): Exercise[] {
  return diversifyByMuscleGroup(
    [...candidates].sort((a, b) => compareByPriority(a, b, translatedTargets)),
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

  const byTarget = catalog.filter((exercise) => translatedTargets.has(exercise.target))
  const byTargetAndEquipment = byTarget.filter((exercise) => isEquipmentAvailable(exercise, availableEquipment))

  if (byTargetAndEquipment.length > 0) {
    return { exercises: selectFrom(byTargetAndEquipment, translatedTargets, perFinding), fallback: 'none' }
  }

  // Fallback 1: relaxa equipamento — mantém o filtro por `target`, aceita qualquer equipamento.
  if (byTarget.length > 0) {
    return {
      exercises: selectFrom(byTarget, translatedTargets, perFinding),
      fallback: 'equipment_relaxed',
      notice:
        'Nenhum exercício para este achado está disponível com o equipamento informado. Sugestão inclui equipamentos fora do perfil do aluno — revise antes de publicar.',
    }
  }

  // Fallback 2: relaxa para `bodyPart` em vez de `target`, ainda preferindo equipamento disponível.
  const byBodyPart = catalog.filter((exercise) => translatedBodyParts.has(exercise.bodyPart))
  const byBodyPartAndEquipment = byBodyPart.filter((exercise) => isEquipmentAvailable(exercise, availableEquipment))
  const bodyPartCandidates = byBodyPartAndEquipment.length > 0 ? byBodyPartAndEquipment : byBodyPart

  if (bodyPartCandidates.length > 0) {
    return {
      exercises: selectFrom(bodyPartCandidates, translatedTargets, perFinding),
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
