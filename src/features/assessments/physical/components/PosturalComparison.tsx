import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { getPosturalViewDefinition } from '@/features/assessments/postural/domain/posturalViews'
import {
  comparePosturalAssessments,
  selectComparablePair,
  type PosturalComparisonDirection,
  type PosturalMetricComparison,
} from '@/features/assessments/postural/domain/posturalComparison'
import type { PhysicalAssessment } from '@/types/domain'

type PosturalComparisonProps = {
  assessments: readonly PhysicalAssessment[]
}

const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Mesma convenção de `measurementFormat.ts`: mostra o módulo, porque o sinal é lado, não gravidade. */
function formatValue(value: number | null, unit: PosturalMetricComparison['unit']): string {
  if (value === null) return '—'
  return unit === 'degree'
    ? `${decimal.format(Math.abs(value))}°`
    : `${decimal.format(Math.abs(value) * 100)}%`
}

/** O delta já é uma diferença de módulos: aqui o sinal importa (menos desvio / mais desvio). */
function formatDelta(delta: number | null, unit: PosturalMetricComparison['unit']): string {
  if (delta === null) return '—'
  const magnitude =
    unit === 'degree' ? `${decimal.format(Math.abs(delta))}°` : `${decimal.format(Math.abs(delta) * 100)}%`
  if (delta === 0) return magnitude
  return `${delta < 0 ? '−' : '+'}${magnitude}`
}

const DIRECTION_PRESENTATION: Record<
  PosturalComparisonDirection,
  { label: string; tone: 'success' | 'error' | 'neutral' | 'warning'; icon: string; className: string }
> = {
  improved: { label: 'Desvio menor', tone: 'success', icon: 'trending_down', className: 'text-success' },
  worsened: { label: 'Desvio maior', tone: 'error', icon: 'trending_up', className: 'text-error' },
  stable: { label: 'Sem variação relevante', tone: 'neutral', icon: 'trending_flat', className: 'text-text-secondary' },
  inconclusive: { label: 'Não conclusivo', tone: 'warning', icon: 'help', className: 'text-warning' },
}

function MetricRow({ metric }: { metric: PosturalMetricComparison }) {
  const presentation = DIRECTION_PRESENTATION[metric.direction]
  const viewLabel = getPosturalViewDefinition(metric.view).label

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-text-primary">{metric.label}</span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
            {viewLabel}
          </span>
        </div>
        <Badge tone={presentation.tone}>
          <Icon name={presentation.icon} className="text-sm" />
          {presentation.label}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-text-secondary">
        <span>
          Anterior <span className="text-text-primary">{formatValue(metric.previousValue, metric.unit)}</span>
        </span>
        <Icon name="arrow_forward" className="text-sm" />
        <span>
          Atual <span className="text-text-primary">{formatValue(metric.currentValue, metric.unit)}</span>
        </span>
        <span className={presentation.className}>Δ {formatDelta(metric.delta, metric.unit)}</span>
      </div>

      {metric.lowConfidence && (
        <p className="flex items-start gap-1 text-xs text-warning">
          <Icon name="warning" className="text-sm" />
          Confiança de detecção abaixo do mínimo em ao menos uma das coletas.
        </p>
      )}
      <p className="text-xs text-text-secondary">{metric.note}</p>
    </li>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <Card className="mt-6">
      <section aria-labelledby="comparacao-postural" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="comparacao-postural" className="font-bold text-text-primary">
            Comparação postural
          </h3>
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
            Uso profissional
          </span>
        </div>
        {children}
      </section>
    </Card>
  )
}

/**
 * Comparação entre as duas últimas avaliações CONCLUÍDAS, na visada do personal.
 *
 * O componente é só apresentação: todo o encadeamento e o cálculo por módulo ficam em
 * `postural/domain/posturalComparison.ts`. A linguagem é técnica e deliberadamente não
 * conclusiva — indicador visual não é diagnóstico.
 */
export function PosturalComparison({ assessments }: PosturalComparisonProps) {
  const { current, previous } = selectComparablePair(assessments)
  const result = comparePosturalAssessments(current, previous)

  if (result.kind === 'current_without_postural') return null

  if (result.kind === 'no_previous') {
    return (
      <Wrapper>
        <p className="text-sm text-text-secondary">
          Ainda não há uma segunda avaliação concluída para comparar. Rascunhos não entram na
          comparação.
        </p>
      </Wrapper>
    )
  }

  if (result.kind === 'previous_without_postural') {
    const data = new Date(result.previousCreatedAt).toLocaleDateString('pt-BR')
    return (
      <Wrapper>
        <p className="text-sm text-text-secondary">
          A avaliação anterior ({data}) não possui registro postural. Sem base para comparar as
          medições de joelho, pelve e cabeça.
        </p>
      </Wrapper>
    )
  }

  const atual = new Date(result.currentCreatedAt).toLocaleDateString('pt-BR')
  const anterior = new Date(result.previousCreatedAt).toLocaleDateString('pt-BR')

  return (
    <Wrapper>
      <p className="font-mono text-xs uppercase tracking-wider text-text-secondary">
        {anterior} → {atual}
      </p>
      {result.metrics.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Nenhuma medição de joelho, pelve ou cabeça em comum entre as duas avaliações.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {result.metrics.map((metric) => (
            <MetricRow key={metric.id} metric={metric} />
          ))}
        </ul>
      )}
      <p className="text-xs text-text-secondary">
        Valores exibidos em módulo: o sinal da medição codifica o lado, não a gravidade. Indicadores
        visuais automáticos, sujeitos a variação de enquadramento — requerem validação do
        profissional.
      </p>
    </Wrapper>
  )
}
