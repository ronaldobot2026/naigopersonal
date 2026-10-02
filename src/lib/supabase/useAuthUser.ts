import { useEffect, useState } from 'react'
import { getSupabase } from './client'

export type AuthUserStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthUserState {
  userId: string | null
  status: AuthUserStatus
}

/**
 * Sessão real do Supabase Auth (login mínimo da Fase 9 — ver docs/ROADMAP.md). Não decide
 * navegação nem autorização: isso continua sendo o `RoleProvider` (mecanismo de UX) e a RLS no
 * banco (mecanismo de autorização de verdade), respectivamente. Usado só onde `auth.uid()`
 * precisa chegar ao cliente, como no `evaluatorId` da Avaliação Física.
 */
export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ userId: null, status: 'loading' })

  useEffect(() => {
    let cancelled = false

    // `getSupabase()` lança se VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY não estiverem
    // configuradas (clone novo, sem .env.local ainda) — trata como "sem sessão" em vez de
    // derrubar a árvore React inteira; o erro continua visível no console.
    let supabase: ReturnType<typeof getSupabase>
    try {
      supabase = getSupabase()
    } catch (error) {
      console.error(error)
      setState({ userId: null, status: 'unauthenticated' })
      return
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const userId = data.session?.user.id ?? null
      setState({ userId, status: userId ? 'authenticated' : 'unauthenticated' })
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      const userId = session?.user.id ?? null
      setState({ userId, status: userId ? 'authenticated' : 'unauthenticated' })
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  return state
}
