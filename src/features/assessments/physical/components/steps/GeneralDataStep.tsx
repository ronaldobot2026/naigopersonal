import { Card } from '@/components/ui/Card'
import type { PhysicalAssessment, Student } from '@/types/domain'

type GeneralDataStepProps = {
  student: Student
  assessment: PhysicalAssessment
}

export function GeneralDataStep({ student, assessment }: GeneralDataStepProps) {
  const createdAt = new Date(assessment.createdAt).toLocaleString('pt-BR')

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">Aluno</p>
        <p className="font-display text-xl font-bold text-text-primary">{student.name}</p>
        <p className="text-sm text-text-secondary [overflow-wrap:anywhere]">{student.email}</p>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          Avaliação iniciada em
        </p>
        <p className="text-text-primary">{createdAt}</p>
      </div>
      <p className="text-sm text-text-secondary">
        Avance pelas abas para registrar biometria, antropometria, registro visual e a avaliação
        postural deste aluno. O rascunho é salvo automaticamente a cada alteração.
      </p>
    </Card>
  )
}
