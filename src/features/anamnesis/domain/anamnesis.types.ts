export type AnamnesisTemplateId = 'parq' | 'standard'

/**
 * - `text`: resposta livre de uma linha.
 * - `textarea`: resposta livre longa (observações).
 * - `yesno`: Sim / Não.
 * - `yesno_detail`: Sim / Não e, quando Sim, um campo "qual / quantos".
 */
export type AnamnesisQuestionType = 'text' | 'textarea' | 'yesno' | 'yesno_detail'

export interface AnamnesisQuestion {
  id: string
  label: string
  type: AnamnesisQuestionType
  /** Rótulo do campo de detalhe, só para `yesno_detail`. */
  detailLabel?: string
  /** Perguntas opcionais não bloqueiam a conclusão (ex.: Observações). */
  optional?: boolean
}

export interface AnamnesisTemplate {
  id: AnamnesisTemplateId
  name: string
  description: string
  questions: AnamnesisQuestion[]
}

export interface AnamnesisAnswer {
  choice?: 'yes' | 'no'
  text?: string
}

export type AnamnesisAnswers = Record<string, AnamnesisAnswer>

/** Quem preenche: o próprio personal ou o aluno (pelo app dele). */
export type AnamnesisFilledBy = 'trainer' | 'student'

/**
 * - `draft`: personal preenchendo.
 * - `pending_student`: criada pelo personal, aguardando o aluno responder.
 * - `completed`: respondida e fechada (somente leitura).
 */
export type AnamnesisStatus = 'draft' | 'pending_student' | 'completed'

export interface Anamnesis {
  id: string
  studentId: string
  trainerId: string
  templateId: AnamnesisTemplateId
  filledBy: AnamnesisFilledBy
  status: AnamnesisStatus
  answers: AnamnesisAnswers
  createdAt: string
  updatedAt: string
  completedAt?: string
}
