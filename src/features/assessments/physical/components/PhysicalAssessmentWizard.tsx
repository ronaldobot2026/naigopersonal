import { useState } from 'react'
import { Card } from '@/components/ui/Card'
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
  saveError: string | null
  onComplete: () => Promise<void>
  completing: boolean
  completeError: string | null
}

export function PhysicalAssessmentWizard({
  student,
  assessment,
  onUpdate,
  saveError,
  onComplete,
  completing,
  completeError,
}: PhysicalAssessmentWizardProps) {
  const [activeStep, setActiveStep] = useState<WizardStepId>('general')
  const stepIndex = WIZARD_STEPS.findIndex((step) => step.id === activeStep)

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar
        value={((stepIndex + 1) / WIZARD_STEPS.length) * 100}
        label="Progresso da avaliação"
      />

      {saveError && (
        <Card tone="elevated" className="flex items-start gap-2 border-error">
          <Icon name="error" className="text-error" />
          <div>
            <p className="font-bold text-error">Não foi possível salvar o rascunho</p>
            <p className="text-sm text-text-secondary">{saveError}</p>
          </div>
        </Card>
      )}

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
            value={assessment.visualRecords}
            onChange={(visualRecords) => onUpdate({ visualRecords })}
          />
        </Tabs.Panel>
        <Tabs.Panel value="postural">
          <PosturalAssessmentFlow
            assessmentId={assessment.id}
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
            onComplete={onComplete}
            completing={completing}
            completeError={completeError}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
