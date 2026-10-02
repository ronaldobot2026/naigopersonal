import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { studentRepository } from '../repositories/studentRepository'

type SubmitState = 'idle' | 'submitting' | 'error'

interface InviteStudentFormProps {
  onInvited: () => void
}

/**
 * Convite de aluno novo (Fase 8, docs/ROADMAP.md — cadastro/convite pela UI). Chama sempre a
 * Edge Function `invite-student` via `studentRepository.invite` — nunca o Admin API direto,
 * porque isso exigiria a `service_role key` no cliente. A função valida no servidor que quem
 * chama é um trainer e grava o vínculo `students.trainer_id`; este componente só cuida do
 * estado de carregando/erro do formulário.
 */
export function InviteStudentForm({ onInvited }: InviteStudentFormProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setState('submitting')
    setErrorMessage('')

    try {
      await studentRepository.invite({ email, fullName })
      setFullName('')
      setEmail('')
      setState('idle')
      onInvited()
    } catch (error) {
      setState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível convidar o aluno.')
    }
  }

  return (
    <Card>
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome completo"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        {state === 'error' && (
          <p role="alert" className="text-sm text-error">
            {errorMessage}
          </p>
        )}
        <div>
          <Button type="submit" disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Enviando convite…' : 'Enviar convite'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
