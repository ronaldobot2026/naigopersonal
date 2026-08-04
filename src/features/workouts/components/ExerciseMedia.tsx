import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import type { Exercise } from '../domain/exercise.types'

type ExerciseMediaProps = {
  exercise: Exercise
  /** Mostra o GIF animado em vez do quadro estático. */
  animated?: boolean
  className?: string
}

/**
 * Miniatura do exercício servida pelo CDN do dataset.
 *
 * A mídia é © Gym visual, distribuída apenas em 180×180 e sujeita aos termos do autor — por isso
 * as dimensões são fixas (evita upscale) e a atribuição acompanha toda tela que exibe mídia
 * (ver `ExerciseAttribution`). Se o CDN falhar, cai para um ícone em vez de deixar a área quebrada.
 */
export function ExerciseMedia({ exercise, animated = false, className = '' }: ExerciseMediaProps) {
  const [hasFailed, setHasFailed] = useState(false)

  if (hasFailed) {
    return (
      <div
        className={`flex aspect-square w-full items-center justify-center bg-surface-high ${className}`}
      >
        <Icon name="fitness_center" className="text-3xl text-text-secondary" />
      </div>
    )
  }

  return (
    <img
      src={animated ? exercise.gifUrl : exercise.imageUrl}
      alt={`Demonstração do exercício ${exercise.name}`}
      width={180}
      height={180}
      loading="lazy"
      onError={() => setHasFailed(true)}
      className={`aspect-square w-full bg-white object-contain ${className}`}
    />
  )
}
