import type {
  AnamnesisAnswers,
  AnamnesisQuestion,
  AnamnesisTemplate,
  AnamnesisTemplateId,
} from './anamnesis.types'

const yn = (id: string, label: string): AnamnesisQuestion => ({ id, label, type: 'yesno' })

/** PAR-Q: triagem de prontidão para atividade física (7 perguntas Sim/Não). */
const PARQ: AnamnesisTemplate = {
  id: 'parq',
  name: 'PAR-Q',
  description: 'Triagem rápida de saúde antes de iniciar atividade física (7 perguntas).',
  questions: [
    yn(
      'parq-1',
      'Algum médico já disse que você possui algum problema de coração e que só deveria realizar atividade física supervisionado por profissionais de saúde?',
    ),
    yn('parq-2', 'Você sente dores no peito quando pratica atividade física?'),
    yn('parq-3', 'No último mês, você sentiu dores no peito quando praticou atividade física?'),
    yn('parq-4', 'Você apresenta desequilíbrio devido à tontura e/ou perda de consciência?'),
    yn(
      'parq-5',
      'Você possui algum problema ósseo ou articular que poderia ser piorado pela atividade física?',
    ),
    yn(
      'parq-6',
      'Você toma atualmente algum medicamento para pressão arterial e/ou problema de coração?',
    ),
    yn('parq-7', 'Sabe de alguma outra razão pela qual você não deve praticar atividade física?'),
  ],
}

/** Anamnese padrão: hábitos, histórico de saúde e observações (17 itens). */
const STANDARD: AnamnesisTemplate = {
  id: 'standard',
  name: 'Padrão',
  description: 'Objetivo, hábitos de vida e histórico de saúde (17 itens).',
  questions: [
    { id: 'std-1', label: 'Qual é o seu objetivo?', type: 'text' },
    {
      id: 'std-2',
      label: 'Pratica atividade física? Há quanto tempo e quais atividades?',
      type: 'text',
    },
    { id: 'std-3', label: 'Faz quantas refeições por dia?', type: 'text' },
    { id: 'std-4', label: 'Faz dieta? Acompanhada ou alguma específica?', type: 'text' },
    {
      id: 'std-5',
      label: 'Faz suplementação?',
      type: 'yesno_detail',
      detailLabel: 'Quais suplementos?',
    },
    { id: 'std-6', label: 'Dorme quantas horas por noite?', type: 'text' },
    {
      id: 'std-7',
      label: 'Fuma?',
      type: 'yesno_detail',
      detailLabel: 'Quantos cigarros por dia?',
    },
    {
      id: 'std-8',
      label: 'Consome bebidas alcoólicas?',
      type: 'yesno_detail',
      detailLabel: 'Quantas vezes por semana?',
    },
    yn('std-9', 'Possui colesterol, triglicerídeos ou glicose altos?'),
    {
      id: 'std-10',
      label: 'Possui alguma alteração cardíaca?',
      type: 'yesno_detail',
      detailLabel: 'Qual?',
    },
    yn('std-11', 'Tem diabetes?'),
    yn('std-12', 'É hipertenso?'),
    {
      id: 'std-13',
      label: 'Possui problemas pulmonares?',
      type: 'yesno_detail',
      detailLabel: 'Quais?',
    },
    {
      id: 'std-14',
      label: 'Toma algum medicamento controlado?',
      type: 'yesno_detail',
      detailLabel: 'Quais?',
    },
    {
      id: 'std-15',
      label: 'Fez alguma cirurgia?',
      type: 'yesno_detail',
      detailLabel: 'Qual?',
    },
    {
      id: 'std-16',
      label: 'Possui algum problema ortopédico diagnosticado?',
      type: 'yesno_detail',
      detailLabel: 'Quais?',
    },
    { id: 'std-17', label: 'Observações', type: 'textarea', optional: true },
  ],
}

export const ANAMNESIS_TEMPLATES: AnamnesisTemplate[] = [PARQ, STANDARD]

export function getAnamnesisTemplate(id: AnamnesisTemplateId): AnamnesisTemplate {
  const found = ANAMNESIS_TEMPLATES.find((template) => template.id === id)
  if (!found) throw new Error(`Modelo de anamnese desconhecido: ${id}`)
  return found
}

/** Pergunta respondida? Perguntas opcionais sempre contam como respondidas. */
export function isQuestionAnswered(question: AnamnesisQuestion, answers: AnamnesisAnswers): boolean {
  if (question.optional) return true
  const answer = answers[question.id]
  switch (question.type) {
    case 'yesno':
      return answer?.choice !== undefined
    case 'yesno_detail':
      if (answer?.choice === undefined) return false
      return answer.choice === 'no' || Boolean(answer.text?.trim())
    default:
      return Boolean(answer?.text?.trim())
  }
}

export function getUnansweredQuestions(
  template: AnamnesisTemplate,
  answers: AnamnesisAnswers,
): AnamnesisQuestion[] {
  return template.questions.filter((question) => !isQuestionAnswered(question, answers))
}

/**
 * PAR-Q: qualquer resposta "Sim" indica que o aluno deve procurar liberação médica antes de
 * treinar. Retorna as perguntas respondidas "Sim" (vazio = nenhuma restrição apontada).
 */
export function getParqPositiveQuestions(answers: AnamnesisAnswers): AnamnesisQuestion[] {
  return PARQ.questions.filter((question) => answers[question.id]?.choice === 'yes')
}
