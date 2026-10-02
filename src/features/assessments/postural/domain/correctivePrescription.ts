/**
 * Vínculo entre achado postural e grupos musculares corretivos, e derivação de achados a partir
 * das métricas da avaliação. Ver docs/CORRECTIVE_PRESCRIPTION.md, seções 2.2 e 2.3.
 *
 * A tabela de vínculos é conhecimento de treino, não regra de código: fica isolada aqui,
 * versionada e fácil de o Windson revisar, em vez de espalhada pela UI. Os `target` usados são
 * os valores crus do catálogo (inglês, iguais aos de `public/data/exercises.json`) — a tradução
 * para pt-BR acontece só na hora de casar com o catálogo já traduzido, em
 * `correctiveExerciseSelection.ts`.
 */
import type { PosturalMetric } from './posturalAssessment.types'
import type { FindingKind, FindingSide, PosturalFinding } from './correctivePrescription.types'

interface CorrectiveTargetLink {
  /** `target` do catálogo (vocabulário em inglês) — ver seção 2.2 da spec para a lista completa. */
  targetMuscles: string[]
  /**
   * Padrão de movimento do achado (seção 2.4 da spec), testado contra `originalName` (inglês) por
   * `correctiveExerciseSelection.ts`. É conhecimento POR ACHADO, não global: uma lista global
   * (`row`/`shrug`/`pull`) foi tentada e reprovada na validação de 21/09 — `pull` casava com
   * exercícios de perna (`leg pull`, `rack pull`) e `shoulder_elevation`/`shoulder_depression`
   * (correções opostas) devolviam a mesma sugestão. Cada achado tem seu próprio vocabulário aqui.
   */
  movementPatterns: string[]
  /** Justificativa em 1 linha, revisável pelo treinador — não é regra fixa. */
  rationale: string
}

/**
 * Tabela declarativa dos 10 achados possíveis → alvos corretivos. Os exemplos de exercício
 * citados nas justificativas vêm literalmente do pedido do Windson (áudio de 2026-09-21).
 */
export const CORRECTIVE_TARGET_LINKS: Record<FindingKind, CorrectiveTargetLink> = {
  shoulder_elevation: {
    targetMuscles: ['traps', 'levator scapulae', 'delts'],
    movementPatterns: ['row', 'shrug'],
    rationale:
      'Ombro elevado: fortalecer trapézio/deltoides com puxadas (ex.: remada alta, elevação puxada).',
  },
  shoulder_depression: {
    targetMuscles: ['delts', 'traps'],
    movementPatterns: ['raise', 'press', 'fly'],
    rationale: 'Ombro deprimido: fortalecer deltoides e trapézio para sustentar a cintura escapular.',
  },
  hip_inclination: {
    targetMuscles: ['glutes', 'abs', 'adductors', 'abductors'],
    movementPatterns: ['bridge', 'abduct', 'adduct', 'leg raise'],
    rationale: 'Quadril fora da horizontal: fortalecer glúteos/core/adutores-abdutores para estabilizar a pelve.',
  },
  head_forward: {
    // 'neck' é `bodyPart` no catálogo, não `target` — entra aqui para o fallback de bodyPart
    // (seção 3.2.6) alcançar exercícios de pescoço quando os alvos de `target` não bastarem.
    targetMuscles: ['levator scapulae', 'traps', 'neck'],
    movementPatterns: ['chin', 'neck', 'shrug', 'row'],
    rationale: 'Cabeça anteriorizada: fortalecer musculatura cervical/escapular com retrações e encolhimentos.',
  },
  trunk_lateral_deviation: {
    targetMuscles: ['abs', 'spine', 'lats', 'upper back'],
    movementPatterns: ['plank', 'dead bug', 'pallof', 'row'],
    rationale: 'Tronco inclinado: fortalecer core e dorsais para melhorar o controle postural do tronco.',
  },
  knee_hyperextension: {
    targetMuscles: ['hamstrings', 'glutes', 'quads'],
    movementPatterns: ['curl', 'deadlift', 'bridge', 'good morning'],
    rationale: 'Hiperextensão de joelho: fortalecer posteriores de coxa e glúteos (ex.: flexora, stiff).',
  },
  knee_valgus: {
    targetMuscles: ['glutes', 'abductors', 'quads'],
    movementPatterns: ['abduct', 'clamshell', 'squat', 'step'],
    rationale: 'Joelho valgo (para dentro): fortalecer glúteos/abdutores para melhorar o controle do joelho.',
  },
  knee_varus: {
    targetMuscles: ['adductors', 'quads'],
    movementPatterns: ['adduct', 'sumo', 'squat'],
    rationale: 'Joelho varo (para fora): fortalecer adutores para equilibrar o alinhamento do joelho.',
  },
  pelvic_tilt_anterior: {
    targetMuscles: ['abs', 'glutes', 'hamstrings'],
    movementPatterns: ['plank', 'bridge', 'dead bug', 'crunch'],
    rationale: 'Pelve anteriorizada: fortalecer core, glúteos e posteriores para reduzir a báscula anterior.',
  },
  pelvic_tilt_posterior: {
    targetMuscles: ['spine', 'quads', 'abs'],
    movementPatterns: ['extension', 'hip', 'squat', 'good morning'],
    rationale: 'Pelve retrovertida: fortalecer extensores de tronco e quadríceps para reduzir a báscula posterior.',
  },
}

function sideLabel(side: FindingSide): string {
  if (side === 'left') return 'esquerdo'
  if (side === 'right') return 'direito'
  return ''
}

function formatDegrees(value: number): string {
  return `${value.toFixed(1)}°`
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/** Frase de evidência por tipo de achado — sempre não-conclusiva (ver 2.3: `evidence`). */
const EVIDENCE_BUILDERS: Record<FindingKind, (metric: PosturalMetric, side: FindingSide) => string> = {
  shoulder_elevation: (metric, side) =>
    `ombro ${sideLabel(side)} ~${formatDegrees(Math.abs(metric.value ?? 0))} acima da linha dos ombros`,
  shoulder_depression: (metric, side) =>
    `ombro ${sideLabel(side)} ~${formatDegrees(Math.abs(metric.value ?? 0))} abaixo da linha dos ombros`,
  hip_inclination: (metric) =>
    `quadril com ~${formatDegrees(Math.abs(metric.value ?? 0))} de diferença em relação à horizontal`,
  head_forward: (metric, side) =>
    `cabeça (lado ${sideLabel(side)}) ~${formatDegrees(metric.value ?? 0)} projetada à frente do ombro`,
  trunk_lateral_deviation: (metric, side) =>
    `tronco (leitura lateral ${sideLabel(side)}) com ~${formatDegrees(metric.value ?? 0)} de desvio em relação à vertical`,
  knee_hyperextension: (metric, side) =>
    `joelho ${sideLabel(side)} com ~${formatDegrees(metric.value ?? 0)} de desvio em relação ao alinhamento esperado`,
  knee_valgus: (metric, side) =>
    `joelho ${sideLabel(side)} com desvio lateral de ~${formatRatio(metric.value ?? 0)} da largura do corpo`,
  knee_varus: (metric, side) =>
    `joelho ${sideLabel(side)} com desvio lateral de ~${formatRatio(metric.value ?? 0)} da largura do corpo`,
  pelvic_tilt_anterior: (metric, side) =>
    `pelve (leitura lateral ${sideLabel(side)}) com ~${formatDegrees(metric.value ?? 0)} de desvio em relação ao alinhamento esperado`,
  pelvic_tilt_posterior: (metric, side) =>
    `pelve (leitura lateral ${sideLabel(side)}) com ~${formatDegrees(metric.value ?? 0)} de desvio em relação ao alinhamento esperado`,
}

function sideFromView(view: PosturalMetric['view']): FindingSide {
  if (view === 'left_side') return 'left'
  if (view === 'right_side') return 'right'
  return 'bilateral'
}

/** Lado elevado a partir do sinal de `shoulderInclination` (slope entre leftShoulder→rightShoulder). */
function elevatedShoulderSide(metric: PosturalMetric): FindingSide {
  return (metric.value ?? 0) > 0 ? 'left' : 'right'
}

interface FindingRule {
  kind: FindingKind
  resolveSide: (metric: PosturalMetric) => FindingSide
  thresholdValue: number
}

/**
 * Mapa metric.id (sufixo após `${view}.`) → regra de achado. Nem toda métrica em "attention" vira
 * achado hoje: algumas leituras (ex.: `trunkAlignment`, que mede inclinação sagital) não
 * distinguem a direção clínica exigida por certos `FindingKind` — por ora reaproveitamos o kind
 * mais próximo, documentado aqui, até existir uma métrica dedicada. Direção não-observável
 * (valgo/varo, anterior/posterior, hiperextensão/flexão) sempre escolhe a variante mais comum,
 * nunca afirmando a direção real — daí a frase de evidência nunca cravar isso.
 */
const FINDING_RULES_BY_METRIC_PROPERTY: Record<string, FindingRule> = {
  shoulderInclination: {
    kind: 'shoulder_elevation',
    resolveSide: elevatedShoulderSide,
    thresholdValue: 3,
  },
  hipInclination: {
    kind: 'hip_inclination',
    resolveSide: () => 'bilateral',
    thresholdValue: 3,
  },
  headAlignment: {
    kind: 'head_forward',
    resolveSide: (metric) => sideFromView(metric.view),
    thresholdValue: 12,
  },
  trunkAlignment: {
    kind: 'trunk_lateral_deviation',
    resolveSide: (metric) => sideFromView(metric.view),
    thresholdValue: 8,
  },
  kneeAngle: {
    kind: 'knee_hyperextension',
    resolveSide: (metric) => sideFromView(metric.view),
    thresholdValue: 5,
  },
  pelvicTilt: {
    kind: 'pelvic_tilt_anterior',
    resolveSide: (metric) => sideFromView(metric.view),
    thresholdValue: 10,
  },
  kneeTrackingDeviationLeft: {
    kind: 'knee_valgus',
    resolveSide: () => 'left',
    thresholdValue: 0.03,
  },
  kneeTrackingDeviationRight: {
    kind: 'knee_valgus',
    resolveSide: () => 'right',
    thresholdValue: 0.03,
  },
}

/** Extrai o nome da propriedade do id da métrica (`"right_side.kneeAngle"` → `"kneeAngle"`). */
function metricProperty(metric: PosturalMetric): string {
  return metric.id.slice(metric.view.length + 1)
}

/**
 * Deriva os achados (`PosturalFinding`) a partir das métricas em "attention" de uma avaliação.
 * Métricas sem regra de vínculo definida (ainda) são ignoradas silenciosamente — não é erro,
 * é uma leitura que por ora não tem exercício corretivo associado.
 */
export function deriveFindingsFromMetrics(metrics: PosturalMetric[]): PosturalFinding[] {
  const findings: PosturalFinding[] = []

  for (const metric of metrics) {
    if (metric.status !== 'attention' || metric.value === null) continue

    const rule = FINDING_RULES_BY_METRIC_PROPERTY[metricProperty(metric)]
    if (!rule) continue

    const side = rule.resolveSide(metric)
    const link = CORRECTIVE_TARGET_LINKS[rule.kind]

    findings.push({
      id: `finding:${metric.id}`,
      kind: rule.kind,
      side,
      sourceMetricId: metric.id,
      view: metric.view,
      measuredValue: metric.value,
      thresholdValue: rule.thresholdValue,
      evidence: EVIDENCE_BUILDERS[rule.kind](metric, side),
      targetMuscles: link.targetMuscles,
      rationale: link.rationale,
    })
  }

  return findings
}
