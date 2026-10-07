/**
 * Histórico de carga por exercício — a leitura do log (`workoutLog.types.ts`) que faz o aluno
 * progredir: "na última vez você fez 32 kg × 10".
 *
 * Tudo aqui é função pura sobre `SetLog`/`LastWeightEntry`. Nada nesta camada toca a ficha
 * (`workout.types.ts`) de propósito: o histórico é montado SÓ com o que está denormalizado no log
 * (`exerciseId`, `exerciseName`, `weightKg`, `reps`, `completedAt`), e é isso que o mantém de pé
 * depois de a ficha ser editada ou apagada.
 */

import type { LastWeightEntry, SetLog } from './workoutLog.types'

/** Quantas sessões o painel do exercício mostra por padrão. Rolagem, não dump da tabela. */
export const DEFAULT_HISTORY_SESSIONS = 6

const MS_PER_DAY = 86_400_000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Diferença em dias de CALENDÁRIO (não em múltiplos de 24h): treinar às 23h e olhar a tela às 7h
 * do dia seguinte é "ontem", e não "0 dias atrás".
 */
export function calendarDaysAgo(iso: string, now: Date = new Date()): number | null {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  return Math.round((startOfDay(now) - startOfDay(then)) / MS_PER_DAY)
}

/** Número para texto em pt-BR: `32.5` → `'32,5'`, `32` → `'32'` (sem `,0` pendurado). */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
}

/** `32.5` → `'32,5 kg'`. `null` (série sem carga, ex.: peso do corpo) → `'sem carga'`. */
export function formatWeight(weightKg: number | null): string {
  return weightKg === null ? 'sem carga' : `${formatNumber(weightKg)} kg`
}

/** Data curta `dd/mm`, usada quando "N dias atrás" já perdeu o significado. */
export function formatShortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

/**
 * Quando foi, em linguagem de academia: `hoje`, `ontem`, `3 dias atrás`, `2 semanas atrás`.
 *
 * Acima de 4 semanas vira data (`12/08`): "41 dias atrás" não diz nada a quem está decidindo a
 * carga da próxima série, e a data permite reconhecer o ciclo de treino.
 */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const days = calendarDaysAgo(iso, now)
  if (days === null) return ''
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `${days} dias atrás`
  if (days < 28) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? '1 semana atrás' : `${weeks} semanas atrás`
  }
  return formatShortDate(iso)
}

/**
 * A linha de referência do executor: `última: 32 kg × 10, 3 dias atrás`.
 *
 * `null` quando o aluno nunca concluiu uma série do exercício — a tela não mostra "última: —",
 * que só ocuparia espaço e sugeriria que algo falhou.
 */
export function describeLastWeight(
  entry: LastWeightEntry | null,
  now: Date = new Date(),
): string | null {
  if (!entry) return null

  const load =
    entry.weightKg === null && entry.reps === null
      ? 'série feita'
      : entry.reps === null
        ? formatWeight(entry.weightKg)
        : `${formatWeight(entry.weightKg)} × ${formatNumber(entry.reps)}`

  const when = formatRelativeDay(entry.completedAt, now)
  return when ? `última: ${load}, ${when}` : `última: ${load}`
}

/** Uma série já concluída, como o painel de histórico a mostra. */
export interface HistorySetSummary {
  setIndex: number
  reps: number | null
  weightKg: number | null
}

/** Uma sessão passada daquele exercício — uma linha do painel de evolução de carga. */
export interface ExerciseHistorySession {
  /** Sessão de origem (`workout_logs.id`). É a chave de agrupamento e a key do React. */
  logId: string
  /** Conclusão da série mais recente da sessão. Nunca `null`: só série concluída entra aqui. */
  completedAt: string
  /** Rótulo do exercício no dia do treino — pode diferir do nome atual no catálogo. */
  exerciseName: string
  sets: HistorySetSummary[]
  /** Maior carga da sessão, o número que mostra progressão de relance. `null` = sem carga. */
  topWeightKg: number | null
  /** Soma das repetições concluídas — volume bruto, para comparar sessões de carga igual. */
  totalReps: number
}

/**
 * Agrupa séries concluídas em sessões, da mais recente para a mais antiga.
 *
 * Agrupa por `workoutLogId`, e não por dia: duas sessões no mesmo dia (manhã e noite) são dois
 * treinos, e somá-las inventaria um volume que não aconteceu.
 *
 * Séries sem `completedAt` são descartadas — é a série que o aluno está digitando AGORA, e ela
 * apareceria como "histórico" antes de existir.
 */
export function groupHistorySessions(
  sets: SetLog[],
  maxSessions: number = DEFAULT_HISTORY_SESSIONS,
): ExerciseHistorySession[] {
  const byLog = new Map<string, ExerciseHistorySession>()

  for (const set of sets) {
    if (set.completedAt === null) continue

    const current = byLog.get(set.workoutLogId)
    if (!current) {
      byLog.set(set.workoutLogId, {
        logId: set.workoutLogId,
        completedAt: set.completedAt,
        exerciseName: set.exerciseName,
        sets: [{ setIndex: set.setIndex, reps: set.reps, weightKg: set.weightKg }],
        topWeightKg: set.weightKg,
        totalReps: set.reps ?? 0,
      })
      continue
    }

    current.sets.push({ setIndex: set.setIndex, reps: set.reps, weightKg: set.weightKg })
    current.totalReps += set.reps ?? 0
    if (
      set.weightKg !== null &&
      (current.topWeightKg === null || set.weightKg > current.topWeightKg)
    )
      current.topWeightKg = set.weightKg
    if (set.completedAt > current.completedAt) current.completedAt = set.completedAt
  }

  return [...byLog.values()]
    .map((session) => ({
      ...session,
      sets: [...session.sets].sort((a, b) => a.setIndex - b.setIndex),
    }))
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0))
    .slice(0, Math.max(0, maxSessions))
}

/** Resumo de uma sessão em uma linha: `32,5 kg × 10 · 32,5 kg × 8 · 30 kg × 8`. */
export function describeHistorySets(session: ExerciseHistorySession): string {
  return session.sets
    .map((set) =>
      set.reps === null
        ? formatWeight(set.weightKg)
        : `${formatWeight(set.weightKg)} × ${formatNumber(set.reps)}`,
    )
    .join(' · ')
}
