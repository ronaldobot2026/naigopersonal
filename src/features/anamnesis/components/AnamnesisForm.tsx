import { Input } from '@/components/ui/Input'
import type {
  AnamnesisAnswers,
  AnamnesisQuestion,
  AnamnesisTemplate,
} from '../domain/anamnesis.types'

type AnamnesisFormProps = {
  template: AnamnesisTemplate
  answers: AnamnesisAnswers
  onChange: (answers: AnamnesisAnswers) => void
  readOnly?: boolean
  /** IDs das perguntas a destacar como pendentes (após tentar concluir). */
  highlightIds?: string[]
}

const CHOICES = [
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não' },
] as const

function YesNo({
  question,
  value,
  readOnly,
  onSelect,
}: {
  question: AnamnesisQuestion
  value?: 'yes' | 'no'
  readOnly: boolean
  onSelect: (value: 'yes' | 'no') => void
}) {
  return (
    <div role="radiogroup" aria-label={question.label} className="flex gap-2">
      {CHOICES.map((choice) => {
        const selected = value === choice.value
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={readOnly}
            onClick={() => onSelect(choice.value)}
            className={`min-w-20 rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-default ${
              selected
                ? 'border-action-primary bg-action-primary text-action-primary-foreground'
                : 'border-border text-text-primary hover:bg-surface-elevated disabled:hover:bg-transparent'
            }`}
          >
            {choice.label}
          </button>
        )
      })}
    </div>
  )
}

/** Formulário genérico de anamnese: renderiza qualquer modelo a partir das perguntas. */
export function AnamnesisForm({
  template,
  answers,
  onChange,
  readOnly = false,
  highlightIds = [],
}: AnamnesisFormProps) {
  function patch(questionId: string, change: Partial<AnamnesisAnswers[string]>) {
    onChange({ ...answers, [questionId]: { ...answers[questionId], ...change } })
  }

  return (
    <ol className="flex flex-col gap-6">
      {template.questions.map((question, index) => {
        const answer = answers[question.id]
        const pending = highlightIds.includes(question.id)
        return (
          <li
            key={question.id}
            className={`flex flex-col gap-3 rounded-md p-3 ${pending ? 'border border-error' : ''}`}
          >
            <p className="font-medium text-text-primary">
              {index + 1}. {question.label}
              {question.optional && (
                <span className="ml-2 text-xs text-text-secondary">(opcional)</span>
              )}
            </p>

            {(question.type === 'yesno' || question.type === 'yesno_detail') && (
              <YesNo
                question={question}
                value={answer?.choice}
                readOnly={readOnly}
                onSelect={(choice) => patch(question.id, { choice })}
              />
            )}

            {question.type === 'yesno_detail' && answer?.choice === 'yes' && (
              <Input
                label={question.detailLabel ?? 'Detalhe'}
                value={answer.text ?? ''}
                readOnly={readOnly}
                onChange={(event) => patch(question.id, { text: event.target.value })}
              />
            )}

            {question.type === 'text' && (
              <Input
                label="Resposta"
                value={answer?.text ?? ''}
                readOnly={readOnly}
                onChange={(event) => patch(question.id, { text: event.target.value })}
              />
            )}

            {question.type === 'textarea' && (
              <textarea
                aria-label="Resposta"
                rows={4}
                value={answer?.text ?? ''}
                readOnly={readOnly}
                onChange={(event) => patch(question.id, { text: event.target.value })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-body text-text-primary focus:border-action-primary focus:outline-none focus:ring-2 focus:ring-action-primary/20"
              />
            )}

            {pending && (
              <p role="alert" className="text-xs text-error">
                Responda esta pergunta para concluir.
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
