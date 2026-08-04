import { useId, type SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string
  label: string
}

type SelectProps = {
  label: string
  options: SelectOption[]
  error?: string
} & SelectHTMLAttributes<HTMLSelectElement>

export function Select({ label, options, error, id, className = '', ...rest }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const errorId = error ? `${selectId}-error` : undefined

  // `min-w-0` permite encolher em grids: opções longas ("Estabilizadores do tornozelo") dão ao
  // <select> uma largura intrínseca grande, que vazaria a coluna sem isto. Ver NumberInput.tsx.
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={`w-full rounded-md border border-border bg-surface px-3 py-2 text-text-primary focus:border-action-primary focus:outline-none focus:ring-2 focus:ring-action-primary/20 ${className}`}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
}
