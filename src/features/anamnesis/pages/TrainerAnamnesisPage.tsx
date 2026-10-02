import { Link, useParams } from 'react-router-dom'
import { buildStudentAnamnesisListPath } from '@/app/router/routes'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AnamnesisFiller } from '../components/AnamnesisFiller'
import { getAnamnesisTemplate } from '../domain/anamnesisTemplates'
import { anamnesisRepository } from '../repositories/anamnesisRepository'

/** Personal: preenche (ou revisa) uma anamnese do aluno. */
export function TrainerAnamnesisPage() {
  const { studentId, anamnesisId } = useParams<{ studentId: string; anamnesisId: string }>()
  const { status, data } = useAsyncData(
    () => anamnesisRepository.findById(anamnesisId ?? ''),
    [anamnesisId],
  )

  const backTo = buildStudentAnamnesisListPath(studentId ?? '')

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      {status === 'loading' && <LoadingState label="Carregando anamnese…" />}
      {(status === 'error' || (status === 'ready' && (!data || data.studentId !== studentId))) && (
        <ErrorState title="Anamnese não encontrada" description="Verifique se o link está correto." />
      )}
      {status === 'ready' && data && data.studentId === studentId && (
        <>
          <PageHeader
            eyebrow="Anamnese"
            title={getAnamnesisTemplate(data.templateId).name}
            actions={
              <Link to={backTo} className="text-sm font-medium text-action-primary hover:underline">
                Voltar
              </Link>
            }
          />
          <AnamnesisFiller anamnesis={data} backTo={backTo} />
        </>
      )}
    </div>
  )
}
