import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  deletePasskey,
  listPasskeys,
  registerPasskeyForCurrentUser,
  type PasskeyInfo,
} from '@/lib/supabase/auth'

type Status = 'loading' | 'ready' | 'error'

/**
 * Conta do aluno: cadastro e remoção de passkeys (Face ID, Touch ID, digital). Cada aparelho
 * cadastra a sua; a senha continua funcionando como fallback.
 */
export function StudentAccountPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    try {
      setPasskeys(await listPasskeys())
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleRegister(): Promise<void> {
    setBusy(true)
    setMessage('')
    try {
      await registerPasskeyForCurrentUser()
      setMessage('Passkey cadastrada. Já dá para entrar com Face ID ou digital neste aparelho.')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(passkeyId: string): Promise<void> {
    setBusy(true)
    setMessage('')
    try {
      await deletePasskey(passkeyId)
      setMessage('Passkey removida.')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível remover.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-margin-mobile py-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold uppercase text-text-primary">Minha conta</h1>
        <p className="text-sm text-text-secondary">Entrar com Face ID ou digital</p>
      </header>

      {status === 'loading' && <p className="text-sm text-text-secondary">Carregando…</p>}

      {status === 'error' && (
        <p role="alert" className="text-sm text-error">
          Não foi possível carregar suas passkeys. Atualize a página.
        </p>
      )}

      {status === 'ready' && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-text-secondary">Seus aparelhos</h2>
            {passkeys.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhuma passkey cadastrada ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {passkeys.map((passkey) => (
                  <li
                    key={passkey.id}
                    className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-text-primary">{passkey.friendlyName}</p>
                      <p className="text-xs text-text-secondary">
                        cadastrada em {new Date(passkey.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void handleDelete(passkey.id)}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Button disabled={busy} onClick={() => void handleRegister()}>
            {busy ? 'Aguardando o aparelho…' : 'Cadastrar passkey neste aparelho'}
          </Button>
        </>
      )}

      {message && (
        <p role="status" className="text-sm text-text-secondary">
          {message}
        </p>
      )}
    </main>
  )
}
