import { useEffect, useState, type DependencyList } from 'react'

export type AsyncStatus = 'loading' | 'ready' | 'error'

interface UseAsyncDataResult<T> {
  status: AsyncStatus
  data: T | undefined
  errorMessage: string | undefined
}

/**
 * Carrega dado assíncrono de um repositório com o trio loading/ready/error já usado em
 * `useExerciseCatalog` e nas páginas de avaliação. Existe para não repetir esse mesmo
 * `useEffect` + 3 `useState` em cada página que lê de um repositório (ver
 * `docs/ARCHITECTURE.md`) — não adiciona cache entre telas nem invalidação; isso é TanStack
 * Query, adotado só quando uma tela precisar invalidar o cache de outra (ex.: concluir treino
 * atualizando o dashboard), o que ainda não existe enquanto os repositórios são mock.
 */
export function useAsyncData<T>(loader: () => Promise<T>, deps: DependencyList): UseAsyncDataResult<T> {
  const [status, setStatus] = useState<AsyncStatus>('loading')
  const [data, setData] = useState<T>()
  const [errorMessage, setErrorMessage] = useState<string>()

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    loader()
      .then((loaded) => {
        if (cancelled) return
        setData(loaded)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar os dados.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { status, data, errorMessage }
}
