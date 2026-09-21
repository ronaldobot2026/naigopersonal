import { getSupabase } from './client'
import type { Role } from '@/types/domain'

export interface SignInResult {
  userId: string
  role: Role
}

/**
 * Login real (fatia mínima da Fase 7, ver docs/ROADMAP.md): autentica e já resolve o papel via
 * `profiles.role`. Usado só pelo `LoginPage` — nenhum outro componente precisa disso hoje.
 */
export async function signInAndFetchRole(email: string, password: string): Promise<SignInResult> {
  const supabase = getSupabase()

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !signInData.user) {
    throw new Error('E-mail ou senha inválidos.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', signInData.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    throw new Error('Login ok, mas não foi possível carregar o perfil da conta.')
  }

  return { userId: signInData.user.id, role: (profile as { role: Role }).role }
}
