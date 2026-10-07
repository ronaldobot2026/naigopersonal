import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import {
  buildSessionDetail,
  formatDuration,
  type AdherenceSession,
  type LoadComparison,
} from '../domain/adherence'
import { formatNumber, formatRelativeDay, formatWeight } from '../domain/workoutHistory'
import { useExerciseCatalog } from '../hooks/useExerciseCatalog'
import { useStudentAdherence } from '../hooks/useStudentAdherence'
import type { WorkoutExerciseEntry } from '../domain/workout.types'
import type { SetLog } from '../domain/workoutLog.types'

interface StudentAdherenceCardProps {
  studentId: string
  /** Primeiro nome do aluno, para a tela falar dele e não de "o aluno". */
  studentName: string
}

/** `07/10 às 19:32` — o dia e a hora em que o aluno começou o treino, no fuso dele. */
function formatSessionStart(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${day}/${month} às ${time}`
}

/** Volume com separador pt-BR. `0 kg` é um número honesto (séries sem carga), não campo vazio. */
function formatVolume(volumeKg: number): string {
  return `${volumeKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
}

/** Prescrição em uma linha, só com o que o personal preencheu. */
function describePrescription(entry: WorkoutExerciseEntry): string {
  const parts = [`${entry.sets} × ${entry.reps}`]
  if (entry.loadKg) parts.push(`${formatNumber(entry.loadKg)} kg`)
  if (entry.rir !== null && entry.rir !== undefined) parts.push(`RIR ${entry.rir}`)
  return parts.join(' · ')
}

/**
 * Destaque da carga. Só `below`/`above` recebem cor: `match` não precisa de alarde e `unknown`
 * (sem carga prescrita ou sem carga registrada) não pode PARECER desvio.
 */
const COMPARISON_CLASS: Record<LoadComparison, string> = {
  below: 'text-warning',
  above: 'text-action-primary',
  match: 'text-text-primary',
  unknown: 'text-text-primary',
}

const COMPARISON_MARK: Record<LoadComparison, string> = {
  below: '↓ abaixo do prescrito',
  above: '↑ acima do prescrito',
  match: '',
  unknown: '',
}

/** Uma série registrada: `2ª · 8 reps · 50 kg ↑ acima do prescrito`. */
function SetRow({
  setIndex,
  reps,
  weightKg,
  done,
  comparison,
}: {
  setIndex: number
  reps: number | null
  weightKg: number | null
  done: boolean
  comparison: LoadComparison
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="font-mono text-xs text-text-secondary">{setIndex}ª</span>
      <span className={COMPARISON_CLASS[comparison]}>
        {reps === null ? 'reps não informadas' : `${formatNumber(reps)} reps`} ·{' '}
        {formatWeight(weightKg)}
      </span>
      {COMPARISON_MARK[comparison] && (
        <span className={`text-xs ${COMPARISON_CLASS[comparison]}`}>
          {COMPARISON_MARK[comparison]}
        </span>
      )}
      {/* Série registrada e NÃO marcada como feita é informação: ele digitou e não concluiu. */}
      {!done && <span className="text-xs text-text-secondary">(não marcada como feita)</span>}
    </li>
  )
}

/**
 * Drill-down de uma sessão: exercício por exercício, o que o aluno fez contra o prescrito.
 *
 * Nenhum campo editável aqui, de propósito — pela RLS da F10-1 o personal só LÊ a execução do
 * aluno (`is_my_student` dá `select`, não há policy de escrita), então a tela não oferece um botão
 * que tomaria erro do banco.
 */
function SessionDetail({
  sets,
  entries,
  exerciseName,
}: {
  sets: SetLog[]
  entries: WorkoutExerciseEntry[]
  exerciseName: (exerciseId: string) => string
}) {
  const detail = buildSessionDetail({ sets, entries, exerciseName })

  if (detail.length === 0)
    return (
      <p className="text-sm text-text-secondary">
        Esta sessão não tem série registrada, e a divisão não está mais na ficha publicada.
      </p>
    )

  return (
    <ul className="flex flex-col gap-3">
      {detail.map((exercise) => (
        <li key={exercise.exerciseId} className="border-l-2 border-border pl-3">
          <p className="font-bold text-text-primary">{exercise.exerciseName}</p>
          <p className="text-xs text-text-secondary">
            {exercise.prescription
              ? `Prescrito: ${describePrescription(exercise.prescription)}`
              : 'Fora da ficha publicada atual'}
          </p>
          {exercise.rows.length === 0 ? (
            <p className="mt-1 text-sm text-text-secondary">Não registrado nesta sessão</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-0.5">
              {exercise.rows.map((row) => (
                <SetRow key={row.setIndex} {...row} />
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Uma sessão na lista, clicável para abrir o detalhe. */
function SessionItem({
  session,
  sets,
  entries,
  exerciseName,
}: {
  session: AdherenceSession
  sets: SetLog[]
  entries: WorkoutExerciseEntry[]
  exerciseName: (exerciseId: string) => string
}) {
  const [open, setOpen] = useState(false)
  const title = session.divisionLabel
    ? `Treino ${session.divisionKey} · ${session.divisionLabel}`
    : `Treino ${session.divisionKey}`

  return (
    <li className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-bold text-text-primary">{title}</p>
          <p className="text-xs text-text-secondary">
            {formatSessionStart(session.startedAt)} · {formatRelativeDay(session.startedAt)}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {/*
              Séries FEITAS sobre as prescritas. Prescrito ausente (divisão fora da ficha) mostra
              só o que foi feito — "4 de 0" não quer dizer nada.
            */}
            {session.setsPrescribed === null
              ? `${session.setsDone} ${session.setsDone === 1 ? 'série feita' : 'séries feitas'}`
              : `${session.setsDone} de ${session.setsPrescribed} séries`}{' '}
            · {formatVolume(session.volumeKg)} · {formatDuration(session.durationMinutes)}
          </p>
        </div>
        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          className="shrink-0 text-xl text-text-secondary"
        />
      </button>
      {open && (
        <div className="border-t border-border p-3">
          <SessionDetail sets={sets} entries={entries} exerciseName={exerciseName} />
        </div>
      )}
    </li>
  )
}

/**
 * Bloco de ADERÊNCIA na tela do aluno (`/personal/alunos/:id`): o que ele treinou, quando e com
 * que carga — com drill-down série por série comparado ao prescrito.
 *
 * Fecha o loop da execução: sem isto o personal prescreve no escuro. É SOMENTE LEITURA (a RLS da
 * F10-1 não dá escrita ao personal), e nenhum número aqui é estimado: sem sessão registrada a
 * tela diz que não há nada, em vez de desenhar zeros que parecem medição.
 */
export function StudentAdherenceCard({ studentId, studentName }: StudentAdherenceCardProps) {
  const { status, sessions, sets, divisions, week, hasPlan, errorMessage } =
    useStudentAdherence(studentId)
  const { catalog } = useExerciseCatalog()
  const exerciseName = (exerciseId: string) =>
    catalog?.exercises.find((item) => item.id === exerciseId)?.name ?? exerciseId

  const firstName = studentName.trim().split(/\s+/)[0] || 'o aluno'
  const divisionEntries = (divisionKey: string) =>
    divisions.find((division) => division.id === divisionKey)?.entries ?? []

  return (
    <Card className="mb-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
            Aderência
          </p>
          <h2 className="font-display text-lg font-bold text-text-primary">Treinos registrados</h2>
        </div>
        <Icon name="history" className="text-2xl text-action-primary" />
      </div>

      {status === 'loading' && (
        <p role="status" className="text-sm text-text-secondary">
          Carregando os treinos de {firstName}…
        </p>
      )}

      {status === 'error' && (
        <p role="status" className="text-sm text-error">
          {errorMessage ?? 'Não foi possível carregar os treinos deste aluno.'}
        </p>
      )}

      {status === 'ready' && (
        <>
          {/*
            Semana corrente pela mesma função que a home do aluno usa (`summarizeWeek`), para que
            personal e aluno nunca vejam contagens diferentes. Sem sessão na semana, estado vazio —
            nunca "0 de 3" com cara de progresso.
          */}
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
              Esta semana
            </p>
            {week.hasHistory ? (
              <p className="mt-0.5 text-sm text-text-primary">
                <span className="font-display text-lg font-bold">{week.completed}</span>
                {week.target === null
                  ? ` ${week.completed === 1 ? 'treino concluído' : 'treinos concluídos'}`
                  : ` de ${week.target} treinos prescritos`}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-text-secondary">
                Nenhum treino concluído nesta semana
                {week.target === null ? '.' : ` · a ficha prevê ${week.target} por semana.`}
              </p>
            )}
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Nenhum treino registrado ainda.{' '}
              {hasPlan
                ? `Quando ${firstName} executar um treino da ficha, as séries e as cargas aparecem aqui.`
                : 'Publique uma ficha para que ele possa registrar os treinos.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.map((session) => (
                <SessionItem
                  key={session.logId}
                  session={session}
                  sets={sets.filter((set) => set.workoutLogId === session.logId)}
                  entries={divisionEntries(session.divisionKey)}
                  exerciseName={exerciseName}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}
