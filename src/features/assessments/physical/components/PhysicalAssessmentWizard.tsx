import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Tabs } from '@/components/ui/Tabs'
import { PosturalAssessmentFlow } from '@/features/assessments/postural/components/PosturalAssessmentFlow'
import type { PhysicalAssessment, Student } from '@/types/domain'
import { WIZARD_STEPS, type WizardStepId } from '../domain/wizardSteps'
import { AnthropometryStep } from './steps/AnthropometryStep'
import { BiometricsStep } from './steps/BiometricsStep'
import { GeneralDataStep } from './steps/GeneralDataStep'
import { NotesStep } from './steps/NotesStep'
import { ReviewStep } from './steps/ReviewStep'
import { VisualRecordStep } from './steps/VisualRecordStep'

type PhysicalAssessmentWizardProps = {
  student: Student
  assessment: PhysicalAssessment
  onUpdate: (patch: Partial<PhysicalAssessment>) => void
  onSave: () => Promise<void>
  saving: boolean
  savedAt: string | null
  saveError: string | null
  onComplete: () => Promise<void>
}

/** Indicador do estado do auto-save (e do botão "Salvar ficha" do ReviewStep) — mesmo estado. */
function SaveStatus({
  saving,
  savedAt,
  saveError,
}: {
  saving: boolean
  savedAt: string | null
  saveError: string | null
}) {
  if (saving) {
    return (
      <span className="flex items-center gap-1 font-mono text-xs text-text-secondary">
        <Icon name="progress_activity" className="animate-spin" />
        Salvando…
      </span>
    )
  }

  if (saveError) {
    return (
      <span role="alert" className="flex items-center gap-1 font-mono text-xs text-error">
        <Icon name="error" />
        Falha ao salvar: {saveError}
      </span>
    )
  }

  if (savedAt) {
    return (
      <span className="flex items-center gap-1 font-mono text-xs text-success">
        <Icon name="check_circle" filled />
        Salvo ✓ · {new Date(savedAt).toLocaleTimeString('pt-BR')}
      </span>
    )
  }

  return null
}

export function PhysicalAssessmentWizard({
  student,
  assessment,
  onUpdate,
  onSave,
  saving,
  savedAt,
  saveError,
  onComplete,
}: PhysicalAssessmentWizardProps) {
  const [activeStep, setActiveStep] = useState<WizardStepId>('general')
  const stepIndex = WIZARD_STEPS.findIndex((step) => step.id === activeStep)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ProgressBar
          value={((stepIndex + 1) / WIZARD_STEPS.length) * 100}
          label="Progresso da avaliação"
          className="sm:flex-1"
        />
        <SaveStatus saving={saving} savedAt={savedAt} saveError={saveError} />
      </div>

      <Tabs value={activeStep} onValueChange={(value) => setActiveStep(value as WizardStepId)}>
        <Tabs.List className="mb-4">
          {WIZARD_STEPS.map((step) => (
            <Tabs.Trigger key={step.id} value={step.id}>
              {step.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Panel value="general">
          <GeneralDataStep student={student} assessment={assessment} />
        </Tabs.Panel>
        <Tabs.Panel value="biometrics">
          <BiometricsStep
            value={assessment.biometrics}
            onChange={(biometrics) => onUpdate({ biometrics })}
          />
        </Tabs.Panel>
        <Tabs.Panel value="anthropometry">
          <AnthropometryStep
            value={assessment.anthropometry}
            onChange={(anthropometry) => onUpdate({ anthropometry })}
          />
        </Tabs.Panel>
        <Tabs.Panel value="visual">
          <VisualRecordStep
            assessmentId={assessment.id}
            studentId={assessment.studentId}
            value={assessment.visualRecords}
            onChange={(visualRecords) => onUpdate({ visualRecords })}
          />
        </Tabs.Panel>
        <Tabs.Panel value="postural">
          <PosturalAssessmentFlow
            assessmentId={assessment.id}
            studentId={assessment.studentId}
            evaluatorId={assessment.evaluatorId}
            posturalAssessment={assessment.posturalAssessment}
            onChange={(posturalAssessment) => onUpdate({ posturalAssessment })}
          />
        </Tabs.Panel>
        <Tabs.Panel value="notes">
          <NotesStep
            value={assessment.generalNotes ?? ''}
            onChange={(generalNotes) => onUpdate({ generalNotes })}
          />
        </Tabs.Panel>
        <Tabs.Panel value="review">
          <ReviewStep
            assessment={assessment}
            student={student}
            onSave={onSave}
            saving={saving}
            onComplete={onComplete}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
