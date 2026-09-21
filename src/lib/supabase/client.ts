import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/config/env'
import type { Database } from './database.types'

/**
 * Cliente Supabase singleton, criado só na primeira chamada real (não no import do módulo) —
 * sem isso, qualquer página que importe este arquivo (mesmo sem nunca chamar nada) derruba o
 * app inteiro quando `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` não estão configuradas
 * (ex.: clone novo, sem `.env.local` ainda). Só repositórios e módulos de `lib/supabase/` chamam
 * `getSupabase()` (ver regra de dependência em docs/ARCHITECTURE.md) — nenhum componente React
 * chama isto diretamente.
 *
 * Tipado com `Database` (`database.types.ts`, gerado via `supabase gen types typescript
 * --linked` — regenerar depois de toda migration nova) para que `.from(tabela)` valide nomes de
 * coluna e tabela em tempo de compilação.
 */
let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(env.supabaseUrl(), env.supabasePublishableKey())
  }
  return client
}
