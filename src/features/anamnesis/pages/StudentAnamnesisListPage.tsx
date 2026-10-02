import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buildTrainerAnamnesisPath, buildStudentDetailPath } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useAuthUser } from '@/lib/supabase/useAuthUser'
import { AnamnesisForm } from '../components/AnamnesisForm'
import { ANAMNESIS_TEMPLATES, getAnamnesisTemplate } from '../domain/anamnesisTemplates'
import type {
  AnamnesisFilledBy,
  AnamnesisStatus,
  AnamnesisTemplateId,
} from '../domain/anamnesis.types'
import { anamnesisRepository } from '../repositories/anamnesisRepository'

const STATUS_BADGE: Record<AnamnesisStatus, { label: string; tone: 'neutral' | 'warning' | 'success' }> = {
  draft: { label: 'Em preenchimento', tone: 'neutral' },
  pending_student: { label: 'Aguardando o aluno', tone: 'warning' },
  completed: { label: 'Concluída', tone: 'success' },
}

/** Personal: lista as anamneses do aluno e cria uma nova (escolhe o modelo e quem preenche). */
export function StudentAnamnesisListPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const [reloadKey, setReloadKey] = useState(0)
  const [templateId, setTemplateId] = useState<AnamnesisTemplateId | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const { userId: trainerId, status: authStatus } = useAuthUser()

  const { status, data, errorMessage } = useAsyncData(
    () =>
      authStatus === 'authenticated'
        ? anamnesisRepository.findByStudentId(studentId ?? '')
        : new Promise<never>(() => undefined),
    [studentId, reloadKey, authStatus],
  )

  if (!studentId) {
    return <ErrorState title="Aluno não informado" description="Volte para a lista de alunos." />
  }
  if (authStatus === 'unauthenticated') {
    return <ErrorState title="Sessão expirada" description="Faça login novamente." />
  }
  const alunoId = studentId

  async function create(filledBy: AnamnesisFilledBy) {
    if (!templateId || !trainerId) return
    setCreateError(null)
    try {
      const created = await anamnesisRepository.create({
        studentId: alunoId,
        trainerId,
        templateId,
        filledBy,
      })
      if (filledBy === 'trainer') {
        navigate(buildTrainerAnamnesisPath(alunoId, created.id))
      } else {
        setTemplateId(null)
        setReloadKey((key) => key + 1)
      }
    } catch (erro: unknown) {
      console.error('Falha ao criar a anamnese:', erro)
      setCreateError(erro instanceof Error ? erro.message : 'Não foi possível criar a anamnese.')
    }
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Perfil do aluno"
        title="Anamnese"
        description="Questionários de saúde e hábitos do aluno."
        actions={
          <Link
            to={buildStudentDetailPath(alunoId)}
            className="text-sm font-medium text-action-primary hover:underline"
          >
            Voltar ao aluno
          </Link>
        }
      />

      <Card className="mb-6 flex flex-col gap-4">
        <h3 className="font-display text-lg font-bold text-text-primary">Nova anamnese</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {ANAMNESIS_TEMPLATES.map((template) => {
            const selected = templateId === template.id
            return (
              <button
                key={template.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setTemplateId(template.id)
                  setPreviewing(false)
                }}
                className={`rounded-md border p-4 text-left transition-colors ${
                  selected
                    ? 'border-action-primary bg-surface-elevated'
                    : 'border-border hover:bg-surface-elevated'
                }`}
              >
                <p className="font-bold text-text-primary">{template.name}</p>
                <p className="text-sm text-text-secondary">{template.description}</p>
              </button>
            )
          })}
        </div>

        {templateId && (
          <>
            <p className="font-medium text-text-primary">O que você deseja fazer?</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => void create('trainer')}>Eu irei preencher</Button>
              <Button variant="secondary" onClick={() => void create('student')}>
                Meu aluno irá preencher
              </Button>
              <Button variant="ghost" onClick={() => setPreviewing((value) => !value)}>
                {previewing ? 'Ocultar modelo' : 'Ver modelo'}
              </Button>
            </div>
            {createError && (
              <p role="alert" className="text-sm text-error">
                {createError}
              </p>
            )}
            {previewing && (
              <AnamnesisForm
                template={getAnamnesisTemplate(templateId)}
                answers={{}}
                onChange={() => undefined}
                readOnly
              />
            )}
          </>
        )}
      </Card>

      {status === 'loading' && <LoadingState label="Carregando anamneses…" />}
      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar as anamneses"
          description={errorMessage ?? 'Tente novamente.'}
        />
      )}
      {status === 'ready' && (data ?? []).length === 0 && (
        <EmptyState
          title="Nenhuma anamnese ainda"
          description="Escolha um modelo acima para começar."
        />
      )}
      {status === 'ready' && (data ?? []).length > 0 && (
        <Card>
          <ul className="divide-y divide-border">
            {(data ?? []).map((item) => {
              const badge = STATUS_BADGE[item.status]
              return (
                <li key={item.id}>
                  <Link
                    to={buildTrainerAnamnesisPath(alunoId, item.id)}
                    className="flex items-center justify-between gap-4 py-4 transition-colors hover:text-action-primary"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium text-text-primary">
                        {getAnamnesisTemplate(item.templateId).name}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </span>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
