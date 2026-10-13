import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getSupabase } from '@/lib/supabase/client'
import { updatePassword } from '@/lib/supabase/auth'

const MIN_PASSWORD_LENGTH = 8

type Phase = 'checking' | 'ready' | 'invalid' | 'done'

/**
 * Nova senha, aberta pelo link do e-mail de recuperação. O Supabase lê o token da URL e cria uma
 * sessão de recuperação; sem essa sessão a tela mostra "link inválido" em vez de um formulário
 * que não funcionaria.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('checking')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    void getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setPhase(data.session ? 'ready' : 'invalid')
      })
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setErrorMessage('')

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (password !== confirmation) {
      setErrorMessage('As senhas não batem.')
      return
    }

    setSubmitting(true)
    try {
      await updatePassword(password)
      setPhase('done')
      navigate(ROUTES.login, { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível trocar a senha.')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'checking') {
    return (
      <main className="flex flex-1 items-center justify-center px-margin-mobile py-12">
        <p className="text-sm text-text-secondary">Verificando o link…</p>
      </main>
    )
  }

  if (phase === 'invalid') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-margin-mobile py-12 text-center md:mx-auto md:w-full md:max-w-md">
        <h1 className="font-display text-2xl font-bold uppercase text-text-primary">
          Link inválido ou vencido
        </h1>
        <p className="text-sm text-text-secondary">Peça um novo link de recuperação.</p>
        <Link to={ROUTES.forgotPassword} className="text-sm font-medium text-action-primary">
          Pedir novo link
        </Link>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-margin-mobile py-12 md:mx-auto md:w-full md:max-w-md">
      <header className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-bold uppercase text-text-primary">Nova senha</h1>
        <p className="text-sm text-text-secondary">
          Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
        </p>
      </header>

      <form onSubmit={(event) => void handleSubmit(event)} className="flex w-full flex-col gap-4">
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Input
          label="Repita a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
        {errorMessage && (
          <p role="alert" className="text-sm text-error">
            {errorMessage}
          </p>
        )}
        <Button type="submit" disabled={submitting || phase === 'done'}>
          {submitting ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </main>
  )
}
