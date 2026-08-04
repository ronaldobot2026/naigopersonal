import { useEffect, useState } from 'react'
import type { ExerciseCatalog } from '../domain/exercise.types'
import { loadExerciseCatalog } from '../repositories/exerciseCatalogRepository'

export type CatalogStatus = 'loading' | 'ready' | 'error'

interface UseExerciseCatalogResult {
  status: CatalogStatus
  catalog: ExerciseCatalog | undefined
  errorMessage: string | undefined
}

/**
 * Disponibiliza o catálogo de exercícios para a tela. A requisição é compartilhada entre todos
 * os consumidores pelo repositório, então montar este hook em várias telas não refaz o download.
 */
export function useExerciseCatalog(): UseExerciseCatalogResult {
  const [status, setStatus] = useState<CatalogStatus>('loading')
  const [catalog, setCatalog] = useState<ExerciseCatalog | undefined>()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false

    loadExerciseCatalog()
      .then((loaded) => {
        if (cancelled) return
        setCatalog(loaded)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(
          error instanceof Error ? error.message : 'Não foi possível carregar os exercícios.',
        )
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { status, catalog, errorMessage }
}
