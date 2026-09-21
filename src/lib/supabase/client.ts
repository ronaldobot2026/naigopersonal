import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/config/env'

/**
 * Cliente Supabase singleton, criado só na primeira chamada real (não no import do módulo) —
 * sem isso, qualquer página que importe este arquivo (mesmo sem nunca chamar nada) derruba o
 * app inteiro quando `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` não estão configuradas
 * (ex.: clone novo, sem `.env.local` ainda). Só repositórios e módulos de `lib/supabase/` chamam
 * `getSupabase()` (ver regra de dependência em docs/ARCHITECTURE.md) — nenhum componente React
 * chama isto diretamente.
 */
let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabasePublishableKey())
  }
  return client
}
