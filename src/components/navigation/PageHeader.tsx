import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      {eyebrow && (
        <span className="text-sm font-semibold uppercase tracking-wide text-action-primary">
          {eyebrow}
        </span>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-text-primary">
          {title}
        </h2>
        {actions}
      </div>
      {description && <p className="max-w-2xl text-text-secondary">{description}</p>}
    </div>
  )
}
