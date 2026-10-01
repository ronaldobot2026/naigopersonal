import { Link, useParams } from 'react-router-dom'
import { buildStudentAnamnesisDetailPath, ROUTES } from '@/app/router/routes'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useAsyncData } from '@/hooks/useAsyncData'
import { MOCK_CURRENT_STUDENT_ID } from '@/mocks/students'
import { AnamnesisFiller } from '../components/AnamnesisFiller'
import { getAnamnesisTemplate } from '../domain/anamnesisTemplates'
import { indexedDbAnamnesisRepository } from '../repositories/indexedDbAnamnesisRepository'

/**
 * Aluno: lista as anamneses que o personal enviou para ele. Rascunhos do personal
 * (`draft`) não aparecem — só o que está aguardando o aluno ou já foi concluído.
 */
export function StudentMyAnamnesisPage() {
  const { status, data, errorMessage } = useAsyncData(
    () => indexedDbAnamnesisRepository.findByStudentId(MOCK_CURRENT_STUDENT_ID),
    [],
  )
  const items = (data ?? []).filter((item) => item.status !== 'draft')

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader
        eyebrow="Meu perfil"
        title="Anamnese"
        description="Questionários de saúde enviados pelo seu personal."
      />
      {status === 'loading' && <LoadingState label="Carregando…" />}
      {status === 'error' && (
        <ErrorState
          title="Não foi possível carregar"
          description={errorMessage ?? 'Tente novamente.'}
        />
      )}
      {status === 'ready' && items.length === 0 && (
        <EmptyState
          title="Nenhuma anamnese para responder"
          description="Quando seu personal enviar um questionário, ele aparece aqui."
        />
      )}
      {status === 'ready' && items.length > 0 && (
        <Card>
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={buildStudentAnamnesisDetailPath(item.id)}
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
                  <Badge tone={item.status === 'completed' ? 'success' : 'warning'}>
                    {item.status === 'completed' ? 'Respondida' : 'Responder'}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/** Aluno: responde (ou revê) uma anamnese. */
export function StudentAnamnesisFillPage() {
  const { anamnesisId } = useParams<{ anamnesisId: string }>()
  const { status, data } = useAsyncData(
    () => indexedDbAnamnesisRepository.findById(anamnesisId ?? ''),
    [anamnesisId],
  )
  const visible =
    status === 'ready' && data && data.studentId === MOCK_CURRENT_STUDENT_ID && data.status !== 'draft'

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      {status === 'loading' && <LoadingState label="Carregando anamnese…" />}
      {(status === 'error' || (status === 'ready' && !visible)) && (
        <ErrorState title="Anamnese não encontrada" description="Verifique se o link está correto." />
      )}
      {visible && data && (
        <>
          <PageHeader eyebrow="Anamnese" title={getAnamnesisTemplate(data.templateId).name} />
          <AnamnesisFiller anamnesis={data} backTo={ROUTES.student.anamnesis} />
        </>
      )}
    </div>
  )
}
