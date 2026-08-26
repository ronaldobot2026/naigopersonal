import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/config/env'

/**
 * Cliente Supabase singleton. Só repositórios importam este módulo (ver regra de dependência em
 * docs/ARCHITECTURE.md) — nenhum componente React chama `supabase` diretamente.
 */
export const supabase = createClient(env.supabaseUrl(), env.supabasePublishableKey())
