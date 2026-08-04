export const WIZARD_STEPS = [
  { id: 'general', label: 'Dados gerais' },
  { id: 'biometrics', label: 'Biometria' },
  { id: 'anthropometry', label: 'Antropometria' },
  { id: 'visual', label: 'Registro visual' },
  { id: 'postural', label: 'Avaliação postural' },
  { id: 'notes', label: 'Observações' },
  { id: 'review', label: 'Revisão' },
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id']
