import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { requestPasswordReset } from '@/lib/supabase/auth'

type SubmitState = 'idle' | 'submitting' | 'sent' | 'error'

/**
 * Pedido de recuperação de senha (Fase 7). Depois de enviar, mostra sempre a mesma confirmação,
 * tenha ou não conta — assim a tela não revela quem é aluno. A rota de destino do link é
 * `ROUTES.resetPassword`.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setState('submitting')
    setErrorMessage('')

    try {
      await requestPasswordReset(email, `${window.location.origin}${ROUTES.resetPassword}`)
      setState('sent')
    } catch (error) {
      setState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível enviar.')
    }
  }

  if (state === 'sent') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-margin-mobile py-12 text-center md:mx-auto md:w-full md:max-w-md">
        <h1 className="font-display text-2xl font-bold uppercase text-text-primary">
          Confira seu e-mail
        </h1>
        <p className="text-sm text-text-secondary">
          Se existe uma conta para {email}, enviamos um link para criar uma nova senha. O link
          vale por tempo limitado.
        </p>
        <Link to={ROUTES.login} className="text-sm font-medium text-action-primary">
          Voltar ao login
        </Link>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-margin-mobile py-12 md:mx-auto md:w-full md:max-w-md">
      <header className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-bold uppercase text-text-primary">
          Esqueci minha senha
        </h1>
        <p className="text-sm text-text-secondary">Digite o e-mail da sua conta.</p>
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
        {state === 'error' && (
          <p role="alert" className="text-sm text-error">
            {errorMessage}
          </p>
        )}
        <Button type="submit" disabled={state === 'submitting'}>
          {state === 'submitting' ? 'Enviando…' : 'Enviar link'}
        </Button>
      </form>

      <Link to={ROUTES.login} className="text-sm font-medium text-action-primary">
        Voltar ao login
      </Link>
    </main>
  )
}
