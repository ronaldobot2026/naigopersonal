/**
 * Thresholds centrais da Avaliação Postural.
 *
 * IMPORTANTE — estes valores são heurísticas de produto, não referência médica validada.
 * Eles decidem apenas o que a UI destaca para revisão do treinador ("attention" vs.
 * "within_expected_range"), nunca um diagnóstico. Qualquer ajuste aqui deve ser revisado
 * por um profissional de educação física ou fisioterapia antes de mudar o comportamento
 * em produção. Ver docs/POSTURAL_ASSESSMENT.md.
 */
export const POSTURE_THRESHOLDS = {
  /** Visibilidade mínima (0–1) de um landmark individual para ser considerado confiável. */
  minLandmarkVisibility: 0.5,

  /** Score agregado mínimo (0–1) do quality gate para permitir concluir a captura. */
  minQualityScore: 0.6,

  /** Margem mínima (fração da altura/largura da imagem) entre cabeça/pés e a borda do enquadramento. */
  frameMarginRatio: 0.04,

  /** Extensão mínima do corpo (ombro–tornozelo) como fração da altura da imagem — evita pessoa pequena demais. */
  minBodySpanRatio: 0.35,

  /** Acima deste desvio (graus), a inclinação de ombros vira "attention" em vez de "within_expected_range". */
  shoulderInclinationAttentionDeg: 3,

  /** Acima deste desvio (graus), a inclinação de quadris vira "attention". */
  hipInclinationAttentionDeg: 3,

  /** Acima deste desvio da vertical (graus) entre orelha e ombro, a vista lateral vira "attention". */
  headAlignmentAttentionDeg: 12,

  /** Acima deste desvio da vertical (graus) entre ombro e quadril, o alinhamento do tronco vira "attention". */
  trunkAlignmentAttentionDeg: 8,

  /** Confiança mínima (0–1) para uma métrica ser apresentada como conclusiva; abaixo disso vira "low_confidence". */
  minConfidenceForConclusiveMetric: 0.6,

  /**
   * Largura dos ombros / extensão vertical do corpo. Serve para detectar orientação
   * incompatível com a vista escolhida. Deliberadamente folgados: em uma foto frontal a razão
   * fica perto de 0,25 e em uma foto de perfil perto de 0,05 — os limites abaixo só reprovam
   * casos claramente errados, evitando falsos positivos.
   */
  maxShoulderSpanRatioForSideView: 0.18,
  minShoulderSpanRatioForBilateralView: 0.08,
} as const

export type PostureThresholds = typeof POSTURE_THRESHOLDS
