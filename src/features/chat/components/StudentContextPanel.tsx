import { Link } from 'react-router-dom'
import {
  buildSessionHighlightPath,
  buildStudentDetailPath,
  buildViewAssessmentPath,
} from '@/app/router/routes'
import { Icon } from '@/components/ui/Icon'
import { physicalAssessmentRepository } from '@/features/assessments/physical/repositories/physicalAssessmentRepository'
import { formatDuration } from '@/features/workouts/domain/adherence'
import { useStudentAdherence } from '@/features/workouts/hooks/useStudentAdherence'
import { useAsyncData } from '@/hooks/useAsyncData'
import type { PhysicalAssessment } from '@/types/domain'

interface StudentContextPanelProps {
  studentId: string
  studentName: string
}

/** `07/10/2026` — data da coleta da avaliação. */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR')
}

/** Número com vírgula decimal pt-BR; `null` fica como ausência explícita, nunca como zero. */
function formatMeasure(value: number | null, unit: string): string | null {
  if (value === null) return null
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unit}`
}

/**
 * Os números do aluno ao lado da conversa (`/personal/chat`).
 *
 * Existe porque responder no escuro é o problema: o personal lê "senti dor na terceira série" e
 * precisa saber, na MESMA tela, se o aluno treinou essa semana e como ele estava na última
 * avaliação — sem trocar de rota e perder a conversa.
 *
 * A semana vem de `useStudentAdherence`, que conta por `summarizeWeek` — a mesma função da home
 * do aluno e do card de aderência. Nenhum cálculo é reimplementado aqui de propósito: dois lados
 * contando a mesma semana por caminhos diferentes acabam discordando, e aí o personal e o aluno
 * olham números diferentes na mesma conversa.
 *
 * Somente leitura, e sem número estimado: sem sessão na semana a tela diz que não há, em vez de
 * desenhar "0 de 3" com cara de progresso.
 */
export function StudentContextPanel({ studentId, studentName }: StudentContextPanelProps) {
  const { status, week, sessions, hasPlan, errorMessage } = useStudentAdherence(studentId)

  const assessments = useAsyncData<PhysicalAssessment | null>(async () => {
    const all = await physicalAssessmentRepository.findByStudentId(studentId)
    // Só avaliação CONCLUÍDA: rascunho tem campo pela metade e viraria número inventado na tela.
    const completed = all
      .filter((assessment) => assessment.status === 'completed')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return completed[0] ?? null
  }, [studentId])

  const firstName = studentName.trim().split(/\s+/)[0] || 'o aluno'
  const lastSession = sessions[0] ?? null
  const assessment = assessments.data ?? null
  const measures = assessment
    ? [
        formatMeasure(assessment.biometrics.weightKg, 'kg'),
        formatMeasure(assessment.biometrics.bodyFatPercent, '% de gordura'),
      ].filter((value): value is string => value !== null)
    : []

  return (
    <aside
      aria-label={`Contexto de ${studentName}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-gutter"
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
          Contexto do aluno
        </p>
        <h2 className="font-display text-base font-bold text-text-primary">{studentName}</h2>
      </div>

      <section className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
          Aderência desta semana
        </p>

        {status === 'loading' && (
          <p role="status" className="mt-0.5 text-sm text-text-secondary">
            Carregando os treinos de {firstName}…
          </p>
        )}

        {status === 'error' && (
          <p role="status" className="mt-0.5 text-sm text-error">
            {errorMessage ?? 'Não foi possível carregar a aderência deste aluno.'}
          </p>
        )}

        {status === 'ready' && (
          <>
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

            {lastSession ? (
              <p className="mt-2 text-xs text-text-secondary">
                Último treino:{' '}
                <Link
                  to={buildSessionHighlightPath(studentId, lastSession.logId)}
                  className="text-action-primary underline-offset-2 hover:underline"
                >
                  Treino {lastSession.divisionKey}
                  {lastSession.divisionLabel ? ` · ${lastSession.divisionLabel}` : ''}
                </Link>{' '}
                · {formatDate(lastSession.startedAt)} · {formatDuration(lastSession.durationMinutes)}
              </p>
            ) : (
              <p className="mt-2 text-xs text-text-secondary">
                {hasPlan
                  ? 'Nenhum treino registrado ainda.'
                  : 'Sem ficha publicada — ele ainda não tem o que registrar.'}
              </p>
            )}
          </>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
          Última avaliação
        </p>

        {assessments.status === 'loading' && (
          <p role="status" className="mt-0.5 text-sm text-text-secondary">
            Carregando avaliação…
          </p>
        )}

        {assessments.status === 'error' && (
          <p role="status" className="mt-0.5 text-sm text-error">
            {assessments.errorMessage ?? 'Não foi possível carregar a avaliação.'}
          </p>
        )}

        {assessments.status === 'ready' &&
          (assessment === null ? (
            <p className="mt-0.5 text-sm text-text-secondary">
              Nenhuma avaliação concluída para {firstName}.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-sm text-text-primary">{formatDate(assessment.createdAt)}</p>
              {measures.length > 0 ? (
                <p className="text-xs text-text-secondary">{measures.join(' · ')}</p>
              ) : (
                <p className="text-xs text-text-secondary">
                  Sem peso nem percentual de gordura registrados nela.
                </p>
              )}
              <Link
                to={buildViewAssessmentPath(studentId, assessment.id)}
                className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-action-primary"
              >
                <Icon name="assignment" className="text-sm" />
                Abrir avaliação
              </Link>
            </>
          ))}
      </section>

      <Link
        to={buildStudentDetailPath(studentId)}
        className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-elevated"
      >
        <Icon name="person" className="text-base" />
        Ficha completa
      </Link>
    </aside>
  )
}
