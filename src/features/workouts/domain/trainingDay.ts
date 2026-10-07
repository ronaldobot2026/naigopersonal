/**
 * O "treino de hoje" do aluno — a leitura HONESTA do histórico de execução
 * (`workout_logs`) que a home (`/aluno/inicio`) mostra no card do topo.
 *
 * Tudo aqui é função pura sobre uma lista de sessões já carregada, e toda pergunta tem uma
 * resposta vazia explícita: "sem histórico" nunca vira zero disfarçado de número, e "o personal
 * não definiu a frequência" nunca vira uma meta inventada. O mock de 78,4 kg na home existiu
 * exatamente porque a tela preferiu um número bonito a um estado vazio.
 *
 * Fuso: o aluno treina no horário dele, então "hoje" e "esta semana" são calculados no fuso
 * LOCAL do dispositivo, nunca em UTC — às 21h de Camboriú um corte em UTC já estaria no dia
 * seguinte e o treino de hoje apareceria como "a fazer".
 */

import { isSessionInProgress, type WorkoutLog } from './workoutLog.types'

/** Estado do dia. Derivado das sessões; não existe coluna de status no banco. */
export type TrainingDayState = 'todo' | 'in_progress' | 'completed_today'

export interface TrainingDayStatus {
  state: TrainingDayState
  /**
   * A sessão que justifica o estado: a aberta em `in_progress`, a concluída hoje em
   * `completed_today`. `null` em `todo` — não há nada a referenciar.
   */
  session: WorkoutLog | null
}

/** Meia-noite local do dia da data informada. */
export function startOfLocalDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

/** Mesma data no calendário local (não "menos de 24h atrás"). */
export function isSameLocalDay(a: string | Date, b: string | Date): boolean {
  return startOfLocalDay(new Date(a)).getTime() === startOfLocalDay(new Date(b)).getTime()
}

/**
 * Segunda-feira 00:00 local da semana da data informada. Semana de treino começa na segunda,
 * não no domingo: é assim que o aluno conta ("fiz 3 dessa semana") e é como as fichas A/B/C são
 * distribuídas.
 */
export function startOfTrainingWeek(date: Date): Date {
  const start = startOfLocalDay(date)
  // getDay(): 0 = domingo. Domingo pertence à semana que começou na segunda anterior (−6 dias).
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)
  return start
}

/**
 * Estado do dia a partir das sessões do aluno.
 *
 * Precedência: **sessão aberta** > **sessão concluída hoje** > **a fazer**. Uma sessão aberta
 * ganha mesmo se foi aberta ontem — ela existe, está sem `completed_at` e esconder isso faria o
 * aluno começar uma segunda sessão em cima da primeira. A tela mostra desde quando.
 */
export function resolveTrainingDay(logs: WorkoutLog[], now: Date = new Date()): TrainingDayStatus {
  const open = logs
    .filter(isSessionInProgress)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  if (open) return { state: 'in_progress', session: open }

  const completedToday = logs
    .filter((log) => log.completedAt !== null && isSameLocalDay(log.completedAt, now))
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]
  if (completedToday) return { state: 'completed_today', session: completedToday }

  return { state: 'todo', session: null }
}

export interface WeekProgress {
  /** Sessões CONCLUÍDAS nesta semana. Em andamento não conta — o aluno não terminou. */
  completed: number
  /** `weekly_frequency` da ficha; `null` quando o personal não preencheu (nunca chutar 3). */
  target: number | null
  /** Segunda-feira da semana contada, em ISO — para a tela dizer qual janela é esta. */
  weekStart: string
  /** `false` = aluno zerado nesta semana: a tela mostra estado vazio, não "0 de 3". */
  hasHistory: boolean
}

/**
 * Quantos treinos o aluno concluiu nesta semana, contra a frequência prescrita.
 *
 * Conta por `completedAt` (quando ele terminou), não por `startedAt`: um treino começado no
 * domingo às 23h e concluído na segunda conta para a semana em que ele de fato acabou — é o que o
 * aluno vê no espelho.
 */
export function summarizeWeek(input: {
  logs: WorkoutLog[]
  weeklyFrequency: number | null
  now?: Date
}): WeekProgress {
  const now = input.now ?? new Date()
  const weekStart = startOfTrainingWeek(now)
  const completed = input.logs.filter(
    (log) => log.completedAt !== null && new Date(log.completedAt).getTime() >= weekStart.getTime(),
  ).length

  return {
    completed,
    target: input.weeklyFrequency,
    weekStart: weekStart.toISOString(),
    hasHistory: completed > 0,
  }
}

export interface DivisionSuggestion {
  /** A divisão a sugerir hoje; `null` só quando a ficha não tem nenhuma divisão com exercício. */
  divisionKey: string | null
  /** Divisões já concluídas nesta semana, na ordem do ciclo. */
  doneThisWeek: string[]
  /** Divisões do ciclo ainda não feitas nesta semana, na ordem do ciclo. */
  pending: string[]
  /** `true` = todas as divisões já foram feitas nesta semana; o ciclo reinicia. */
  cycleComplete: boolean
}

/**
 * Qual divisão sugerir hoje.
 *
 * **A regra**, por escrito: o ciclo é a ordem das divisões da ficha (A → B → C …) e a janela é a
 * SEMANA corrente. Sugerimos a primeira divisão ainda não concluída nesta semana, varrendo o
 * ciclo circularmente a partir da divisão SEGUINTE à última que o aluno concluiu. Se ele não
 * treinou nesta semana, a sugestão é a primeira do ciclo. Se todas já foram feitas, o ciclo
 * reinicia na seguinte à última concluída e `cycleComplete` fica `true`.
 *
 * Por que a semana, e não "desde a última vez que fechou o ciclo": é a janela que o aluno
 * enxerga, é a mesma de `summarizeWeek` (então o card não se contradiz) e não depende de
 * histórico longo — um aluno novo recebe uma sugestão correta na primeira semana.
 *
 * O **empate não é escondido**: quando sobra mais de uma divisão pendente, `pending` traz todas
 * na ordem do ciclo e a tela as oferece como escolha. A sugestão é um atalho, não uma trava — o
 * aluno pode abrir qualquer divisão da ficha.
 */
export function suggestDivision(input: {
  /** Divisões da ficha na ordem exibida (as sessões de `toStudentSessions`). */
  divisionKeys: string[]
  logs: WorkoutLog[]
  now?: Date
}): DivisionSuggestion {
  const { divisionKeys } = input
  if (divisionKeys.length === 0) {
    return { divisionKey: null, doneThisWeek: [], pending: [], cycleComplete: false }
  }

  const now = input.now ?? new Date()
  const weekStart = startOfTrainingWeek(now)
  const completedThisWeek = input.logs
    .filter(
      (log) =>
        log.completedAt !== null && new Date(log.completedAt).getTime() >= weekStart.getTime(),
    )
    .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))

  const doneKeys = new Set(completedThisWeek.map((log) => log.divisionKey))
  const doneThisWeek = divisionKeys.filter((key) => doneKeys.has(key))
  const pending = divisionKeys.filter((key) => !doneKeys.has(key))

  const lastKey = completedThisWeek[completedThisWeek.length - 1]?.divisionKey
  const lastIndex = lastKey === undefined ? -1 : divisionKeys.indexOf(lastKey)
  // Divisão fora da ficha atual (o personal republicou a ficha no meio da semana): o ciclo
  // recomeça do início em vez de apontar para um índice que não existe mais.
  const startIndex = lastIndex < 0 ? 0 : (lastIndex + 1) % divisionKeys.length

  const cycleComplete = pending.length === 0
  const pool = cycleComplete ? divisionKeys : pending
  const rotated = divisionKeys
    .map((_, offset) => divisionKeys[(startIndex + offset) % divisionKeys.length])
    .find((key) => pool.includes(key))

  return {
    divisionKey: rotated ?? divisionKeys[0],
    doneThisWeek,
    pending,
    cycleComplete,
  }
}
