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

/**
 * Pede o e-mail de recuperação de senha. Responde sempre com sucesso, mesmo se o e-mail não
 * existir: não revelamos quem tem conta (anti-enumeração). O link do e-mail aponta para
 * `redirectTo`, que precisa estar em `additional_redirect_urls` do Supabase.
 */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo })
  if (error) {
    throw new Error('Não foi possível enviar o e-mail agora. Tente de novo em instantes.')
  }
}

/**
 * Define a nova senha. Só funciona numa sessão de recuperação (o link do e-mail já trouxe o
 * token e o Supabase criou a sessão); sem ela, o `updateUser` falha.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password: newPassword })
  if (error) {
    throw new Error('Não foi possível trocar a senha. Peça um novo link de recuperação.')
  }
}
