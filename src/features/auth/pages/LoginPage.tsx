import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '@/app/providers/useRole'
import { ROUTES } from '@/app/router/routes'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { signInAndFetchRole } from '@/lib/supabase/auth'

type SubmitState = 'idle' | 'submitting' | 'error'

/**
 * Login real (fatia mínima da Fase 7, ver docs/ROADMAP.md), o suficiente para `auth.uid()`
 * existir e a RLS da Avaliação Física (Fase 9) funcionar de ponta a ponta. Ainda faltam Google,
 * Apple e recuperação de senha — isso é a Fase 7 completa.
 *
 * Sem instant-login mockado: o e-mail/senha precisam ser reais porque o navegador realmente
 * autentica contra o Supabase e recebe um token com acesso a dados de aluno (mesmo que hoje só
 * dados de demonstração). Ver `scripts/seed-demo-users.mjs` para criar as duas contas.
 */
export function LoginPage() {
  const { setRole } = useRole()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setState('submitting')
    setErrorMessage('')

    try {
      const { role } = await signInAndFetchRole(email, password)
      setRole(role)
      navigate(role === 'trainer' ? ROUTES.trainer.dashboard : ROUTES.student.home)
    } catch (error) {
      setState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível entrar.')
    }
  }

  return (
    <main className="atmospheric-overlay relative flex flex-1 flex-col items-center justify-between px-margin-mobile py-12 md:mx-auto md:w-full md:max-w-md">
      <header className="mt-8 flex w-full flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-action-primary/10 text-action-primary">
          <Icon name="fitness_center" filled className="text-4xl" />
        </div>
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold uppercase leading-tight tracking-tight text-text-primary">
            Seu treino, sua evolução, <span className="text-action-primary">meu compromisso.</span>
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
            Windson Wood Personal
          </p>
        </div>
      </header>

      <form onSubmit={(event) => void handleSubmit(event)} className="flex w-full flex-col gap-4">
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {state === 'error' && (
          <p role="alert" className="text-sm text-error">
            {errorMessage}
          </p>
        )}
        <Button type="submit" disabled={state === 'submitting'}>
          {state === 'submitting' ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <footer className="w-full px-8 text-center">
        <p className="text-[10px] uppercase leading-relaxed text-text-secondary/70">
          Login conectado ao Supabase — Google, Apple e recuperação de senha ainda não
          implementados (Fase 7 completa, ver docs/ROADMAP.md).
        </p>
      </footer>
    </main>
  )
}
