import CountUp from '../motion/CountUp'
import { Card } from './Card'
import { Icon } from './Icon'

type MetricCardTrend = {
  direction: 'up' | 'down'
  label: string
}

type MetricCardProps = {
  label: string
  /** Número anima com contagem; string é renderizada como está (use para "—" e afins). */
  value: number | string
  /** Sufixo colado ao número, ex.: "kg" ou "%". Ignorado quando `value` é string. */
  unit?: string
  trend?: MetricCardTrend
  className?: string
}

/**
 * Cartão de métrica usado em faixas de 3 colunas até em telas de 360px, onde cada cartão fica
 * com ~70px úteis. Por isso o valor é tipograficamente fluido e o cartão declara `min-w-0`:
 * sem isso, o tamanho intrínseco do texto impede o item do grid de encolher e o número vaza
 * para fora do cartão.
 */
export function MetricCard({ label, value, unit, trend, className = '' }: MetricCardProps) {
  return (
    <Card tone="glass" className={`flex min-w-0 flex-col justify-between gap-2 ${className}`}>
      <p className="text-xs font-medium text-text-secondary sm:text-sm">{label}</p>
      <p className="font-display text-lg font-bold tabular-nums text-text-primary sm:text-2xl md:text-4xl">
        {typeof value === 'number' ? (
          <>
            <CountUp to={value} duration={1.2} />
            {unit}
          </>
        ) : (
          value
        )}
      </p>
      {trend && (
        <span
          className={`flex items-center gap-1 text-xs font-medium sm:text-sm ${trend.direction === 'up' ? 'text-success' : 'text-error'}`}
        >
          <Icon
            name={trend.direction === 'up' ? 'arrow_drop_up' : 'arrow_drop_down'}
            filled
            className="text-sm"
          />
          {trend.label}
        </span>
      )}
    </Card>
  )
}
