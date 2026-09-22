import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { PosturalAssessment, PosturalView } from '../domain/posturalAssessment.types'
import { getCaptureForView } from '../domain/posturalSession'
import { POSTURAL_VIEWS, getPosturalViewDefinition } from '../domain/posturalViews'

type ViewChecklistProps = {
  assessment: PosturalAssessment | undefined
  onSelectView: (view: PosturalView) => void
  onViewFindings: () => void
}

type ViewStatus = 'pending' | 'low_quality' | 'done'

const STATUS_LABEL: Record<ViewStatus, string> = {
  pending: 'Pendente',
  low_quality: 'Refazer',
  done: 'Capturada',
}

const STATUS_TONE: Record<ViewStatus, 'neutral' | 'warning' | 'success'> = {
  pending: 'neutral',
  low_quality: 'warning',
  done: 'success',
}

const STATUS_ICON: Record<ViewStatus, string> = {
  pending: 'photo_camera',
  low_quality: 'warning',
  done: 'check_circle',
}

const STATUS_ICON_CLASS: Record<ViewStatus, string> = {
  pending: 'text-text-secondary',
  low_quality: 'text-warning',
  done: 'text-success',
}

function statusForView(assessment: PosturalAssessment | undefined, view: PosturalView): ViewStatus {
  const capture = getCaptureForView(assessment, view)
  if (!capture) return 'pending'
  return capture.quality.passed ? 'done' : 'low_quality'
}

/**
 * Painel de controle das quatro capturas exigidas pelo protocolo. Mostra o progresso,
 * permite escolher qual vista capturar e refazer qualquer uma já concluída.
 */
export function ViewChecklist({ assessment, onSelectView, onViewFindings }: ViewChecklistProps) {
  const statuses = POSTURAL_VIEWS.map((view) => ({ view, status: statusForView(assessment, view) }))
  const doneCount = statuses.filter((item) => item.status === 'done').length
  const nextPending = statuses.find((item) => item.status !== 'done')?.view

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-lg text-text-primary">Capturas posturais</h3>
          <span className="font-mono text-xs uppercase tracking-wider text-text-secondary">
            {doneCount} de {POSTURAL_VIEWS.length}
          </span>
        </div>
        <p className="text-sm text-text-secondary">
          O protocolo exige quatro fotos: frente, lateral esquerda, lateral direita e costas.
        </p>
        <ProgressBar
          value={(doneCount / POSTURAL_VIEWS.length) * 100}
          label={`Capturas posturais — ${doneCount} de ${POSTURAL_VIEWS.length}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {statuses.map(({ view, status }) => {
          const definition = getPosturalViewDefinition(view)
          return (
            <Card
              key={view}
              tone="glass"
              interactive
              className="flex flex-col gap-3 transition-[border-color,box-shadow] duration-300 ease-out-quint hover:border-action-primary/50 hover:shadow-glass"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-text-primary">{definition.label}</p>
                  <p className="text-sm text-text-secondary">{definition.positioning}</p>
                </div>
                <Icon
                  name={STATUS_ICON[status]}
                  filled={status === 'done'}
                  className={STATUS_ICON_CLASS[status]}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                <Button
                  variant={status === 'done' ? 'secondary' : 'primary'}
                  onClick={() => onSelectView(view)}
                >
                  {status === 'done' ? 'Rever' : 'Capturar'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {nextPending ? (
        <Button onClick={() => onSelectView(nextPending)} className="self-center">
          Continuar com {getPosturalViewDefinition(nextPending).label.toLowerCase()}
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-sm text-success">
            As quatro vistas foram capturadas e aprovadas.
          </p>
          <Button onClick={onViewFindings}>Ver achados e correção sugerida</Button>
        </div>
      )}
    </div>
  )
}
