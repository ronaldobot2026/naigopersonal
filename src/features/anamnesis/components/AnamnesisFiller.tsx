import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { AnamnesisForm } from './AnamnesisForm'
import {
  getAnamnesisTemplate,
  getParqPositiveQuestions,
  getUnansweredQuestions,
} from '../domain/anamnesisTemplates'
import type { Anamnesis, AnamnesisAnswers } from '../domain/anamnesis.types'
import { indexedDbAnamnesisRepository } from '../repositories/indexedDbAnamnesisRepository'

type AnamnesisFillerProps = {
  anamnesis: Anamnesis
  /** Rota para voltar depois de concluir. */
  backTo: string
  onCompleted?: (completed: Anamnesis) => void
}

/**
 * Tela de preenchimento reutilizada pelo personal e pelo aluno: salva a cada alteração
 * (rascunho), valida as perguntas obrigatórias ao concluir e, depois de concluída, vira
 * somente leitura. No PAR-Q, mostra o alerta de liberação médica quando há resposta "Sim".
 */
export function AnamnesisFiller({ anamnesis, backTo, onCompleted }: AnamnesisFillerProps) {
  const template = getAnamnesisTemplate(anamnesis.templateId)
  const [current, setCurrent] = useState(anamnesis)
  const [answers, setAnswers] = useState<AnamnesisAnswers>(anamnesis.answers)
  const [highlightIds, setHighlightIds] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)

  const readOnly = current.status === 'completed'

  useEffect(() => {
    setCurrent(anamnesis)
    setAnswers(anamnesis.answers)
  }, [anamnesis])

  function handleChange(next: AnamnesisAnswers) {
    setAnswers(next)
    setHighlightIds([])
    indexedDbAnamnesisRepository
      .saveAnswers(current, next)
      .then(() => setSaveError(null))
      .catch((erro: unknown) => {
        console.error('Falha ao salvar a anamnese:', erro)
        setSaveError(erro instanceof Error ? erro.message : 'Erro desconhecido ao salvar.')
      })
  }

  async function handleComplete() {
    const missing = getUnansweredQuestions(template, answers)
    if (missing.length > 0) {
      setHighlightIds(missing.map((question) => question.id))
      return
    }
    setCompleting(true)
    try {
      const completed = await indexedDbAnamnesisRepository.complete(current, answers)
      setCurrent(completed)
      setSaveError(null)
      onCompleted?.(completed)
    } catch (erro: unknown) {
      console.error('Falha ao concluir a anamnese:', erro)
      setSaveError(erro instanceof Error ? erro.message : 'Erro desconhecido ao concluir.')
    } finally {
      setCompleting(false)
    }
  }

  const parqPositives =
    template.id === 'parq' && readOnly ? getParqPositiveQuestions(answers) : []

  return (
    <div className="flex flex-col gap-4">
      {saveError && (
        <Card tone="elevated" className="flex items-start gap-2 border-error">
          <Icon name="error" className="text-error" />
          <div>
            <p className="font-bold text-error">Não foi possível salvar</p>
            <p className="text-sm text-text-secondary">{saveError}</p>
          </div>
        </Card>
      )}

      {template.id === 'parq' && readOnly && (
        <Card
          tone="elevated"
          className={`flex items-start gap-2 ${parqPositives.length > 0 ? 'border-warning' : ''}`}
        >
          <Icon
            name={parqPositives.length > 0 ? 'warning' : 'check_circle'}
            className={parqPositives.length > 0 ? 'text-warning' : 'text-success'}
          />
          <p className="text-sm text-text-primary">
            {parqPositives.length > 0
              ? `${parqPositives.length} resposta(s) "Sim": recomende liberação médica antes de iniciar os treinos.`
              : 'Nenhuma restrição apontada na triagem.'}
          </p>
        </Card>
      )}

      <Card>
        <AnamnesisForm
          template={template}
          answers={answers}
          onChange={handleChange}
          readOnly={readOnly}
          highlightIds={highlightIds}
        />
      </Card>

      {readOnly ? (
        <div className="flex items-center justify-between gap-4">
          <Badge tone="success">
            <Icon name="check_circle" /> Anamnese concluída
          </Badge>
          <Link to={backTo} className="text-sm font-medium text-action-primary hover:underline">
            Voltar
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-end gap-2">
          {highlightIds.length > 0 && (
            <p role="alert" className="text-sm text-error">
              Faltam {highlightIds.length} pergunta(s) obrigatória(s).
            </p>
          )}
          <Button onClick={() => void handleComplete()} disabled={completing}>
            {completing ? 'Concluindo…' : 'Concluir anamnese'}
          </Button>
        </div>
      )}
    </div>
  )
}
