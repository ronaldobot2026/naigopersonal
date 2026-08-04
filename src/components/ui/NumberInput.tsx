import { useId, type InputHTMLAttributes } from 'react'

type NumberInputProps = {
  label: string
  error?: string
  unit?: string
  emphasis?: 'default' | 'stat'
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function NumberInput({
  label,
  error,
  unit,
  emphasis = 'default',
  id,
  className = '',
  ...rest
}: NumberInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = error ? `${inputId}-error` : undefined
  const valueSizeClass =
    emphasis === 'stat' ? 'font-display text-3xl font-extrabold' : 'font-body text-base'

  // `min-w-0` é obrigatório: como item de grid/flex, a largura intrínseca de um <input> (que
  // deriva do atributo `size`, 20 caracteres por padrão) impediria a coluna de encolher, e o
  // campo vazaria para fora do cartão em telas estreitas.
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
        {label}
        {unit ? ` (${unit})` : ''}
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={`w-full rounded-md border bg-surface px-3 py-2 text-text-primary transition-colors focus:border-action-primary focus:outline-none focus:ring-2 focus:ring-action-primary/20 ${valueSizeClass} ${error ? 'border-error' : 'border-border'} ${className}`}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
}
