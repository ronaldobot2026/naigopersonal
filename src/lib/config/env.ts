/**
 * Variáveis de ambiente públicas do frontend (prefixo `VITE_*`, embutidas no bundle — nunca um
 * segredo aqui). Valida no import, não no boot do app: só falha quando algo realmente as
 * consome, o que ainda não acontece em nenhum repositório (Fase 6 só sobe o schema; cutover de
 * repositório é a partir da Fase 8 — ver docs/ROADMAP.md).
 */
function requireEnv(name: string): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não definida. Ver .env.example.`)
  }
  return value
}

export const env = {
  supabaseUrl: (): string => requireEnv('VITE_SUPABASE_URL'),
  supabasePublishableKey: (): string => requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
}
