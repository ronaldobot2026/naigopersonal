type ExerciseAttributionProps = {
  attribution: string
  source: string
  className?: string
}

/**
 * Atribuição obrigatória do catálogo. O NOTICE.md do dataset exige que o aviso de copyright da
 * mídia (© Gym visual) acompanhe qualquer uso das imagens/GIFs — este componente deve aparecer
 * em toda tela que exibe mídia de exercício.
 */
export function ExerciseAttribution({
  attribution,
  source,
  className = '',
}: ExerciseAttributionProps) {
  return (
    <p className={`text-xs text-text-secondary ${className}`}>
      {attribution} · dados de{' '}
      <a
        href={source}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-action-primary"
      >
        exercises-dataset
      </a>
    </p>
  )
}
