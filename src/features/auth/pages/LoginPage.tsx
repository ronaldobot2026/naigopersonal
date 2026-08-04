import { useNavigate } from 'react-router-dom'
import { useRole } from '@/app/providers/useRole'
import { ROUTES } from '@/app/router/routes'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { Role } from '@/types/domain'

/**
 * Tela de entrada. Substitui os botões OAuth do export original (Google/Apple) por uma
 * troca de papel mockada — ver docs/DECISIONS.md. Autenticação real é trabalho futuro.
 */
export function LoginPage() {
  const { setRole } = useRole()
  const navigate = useNavigate()

  function handleEnter(role: Role): void {
    setRole(role)
    navigate(role === 'trainer' ? ROUTES.trainer.dashboard : ROUTES.student.home)
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

      <section className="flex w-full flex-col gap-4">
        <p className="text-center text-sm text-text-secondary">
          Autenticação real ainda não implementada. Escolha um papel para explorar o protótipo:
        </p>
        <Button onClick={() => handleEnter('trainer')}>Entrar como Personal</Button>
        <Button variant="secondary" onClick={() => handleEnter('student')}>
          Entrar como Aluno
        </Button>
      </section>

      <footer className="w-full px-8 text-center">
        <p className="text-[10px] uppercase leading-relaxed text-text-secondary/70">
          Protótipo de desenvolvimento — nenhum dado real de aluno é utilizado nesta etapa.
        </p>
      </footer>
    </main>
  )
}
