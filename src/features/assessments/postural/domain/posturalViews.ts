/**
 * Catálogo das vistas da Avaliação Postural.
 *
 * O protocolo exige quatro capturas — frente, lateral esquerda, lateral direita e costas —
 * e cada uma tem rótulo, instruções de preparação e um guia de silhueta próprios. Este módulo
 * é a única fonte da verdade sobre "quais vistas existem e em que ordem"; UI e domínio leem
 * daqui em vez de repetir listas literais.
 */
import type { LandmarkName } from './landmarks'
import type { PosturalView } from './posturalAssessment.types'

/** Ordem de captura apresentada ao usuário. */
export const POSTURAL_VIEWS: readonly PosturalView[] = [
  'front',
  'left_side',
  'right_side',
  'back',
] as const

export const REQUIRED_POSTURAL_VIEW_COUNT = POSTURAL_VIEWS.length

/** Silhueta de posicionamento exibida sobre o preview da câmera. */
export type SilhouetteGuide = 'facing' | 'profile'

export interface PosturalViewDefinition {
  view: PosturalView
  /** Rótulo completo, para títulos e textos alternativos. */
  label: string
  /** Rótulo curto, para chips e checklists. */
  shortLabel: string
  /** Como a pessoa deve se posicionar, em uma linha. */
  positioning: string
  silhouette: SilhouetteGuide
  /** Lado do corpo analisado nas vistas laterais; `undefined` para frente e costas. */
  side?: 'left' | 'right'
  instructions: readonly string[]
}

const SHARED_INSTRUCTIONS = [
  'Corpo inteiro dentro do enquadramento, com cabeça e pés visíveis.',
  'Mantenha a câmera estável, nivelada e na altura do quadril.',
  'Garanta iluminação suficiente, sem sombras fortes.',
  'Use roupas que permitam ver o contorno do corpo.',
  'Mantenha uma postura natural — não tente se corrigir durante a foto.',
] as const

export const POSTURAL_VIEW_DEFINITIONS: Record<PosturalView, PosturalViewDefinition> = {
  front: {
    view: 'front',
    label: 'Vista frontal',
    shortLabel: 'Frente',
    positioning: 'De frente para a câmera, braços soltos ao lado do corpo.',
    silhouette: 'facing',
    instructions: [
      'Fique de frente para a câmera, com os pés na largura do quadril.',
      'Deixe os braços soltos ao lado do corpo, sem cobrir o quadril.',
      ...SHARED_INSTRUCTIONS,
    ],
  },
  left_side: {
    view: 'left_side',
    label: 'Vista lateral esquerda',
    shortLabel: 'Lateral esq.',
    positioning: 'De lado, com o ombro esquerdo voltado para a câmera.',
    silhouette: 'profile',
    side: 'left',
    instructions: [
      'Gire 90° para a direita: o lado esquerdo do corpo fica voltado para a câmera.',
      'Deixe os braços relaxados à frente do tronco, sem esconder o ombro.',
      'Olhe para a frente, sem girar a cabeça em direção à câmera.',
      ...SHARED_INSTRUCTIONS,
    ],
  },
  right_side: {
    view: 'right_side',
    label: 'Vista lateral direita',
    shortLabel: 'Lateral dir.',
    positioning: 'De lado, com o ombro direito voltado para a câmera.',
    silhouette: 'profile',
    side: 'right',
    instructions: [
      'Gire 90° para a esquerda: o lado direito do corpo fica voltado para a câmera.',
      'Deixe os braços relaxados à frente do tronco, sem esconder o ombro.',
      'Olhe para a frente, sem girar a cabeça em direção à câmera.',
      ...SHARED_INSTRUCTIONS,
    ],
  },
  back: {
    view: 'back',
    label: 'Vista posterior',
    shortLabel: 'Costas',
    positioning: 'De costas para a câmera, braços soltos ao lado do corpo.',
    silhouette: 'facing',
    instructions: [
      'Fique de costas para a câmera, com os pés na largura do quadril.',
      'Deixe os braços soltos ao lado do corpo, sem cobrir o quadril.',
      'Se o cabelo cobrir a nuca, prenda-o para liberar a linha dos ombros.',
      ...SHARED_INSTRUCTIONS,
    ],
  },
}

/** Landmarks do lado analisado em cada vista lateral (orelha, ombro, quadril, joelho, tornozelo). */
export const SIDE_VIEW_LANDMARKS: Record<
  'left' | 'right',
  Readonly<Record<'ear' | 'shoulder' | 'hip' | 'knee' | 'ankle', LandmarkName>>
> = {
  left: {
    ear: 'leftEar',
    shoulder: 'leftShoulder',
    hip: 'leftHip',
    knee: 'leftKnee',
    ankle: 'leftAnkle',
  },
  right: {
    ear: 'rightEar',
    shoulder: 'rightShoulder',
    hip: 'rightHip',
    knee: 'rightKnee',
    ankle: 'rightAnkle',
  },
}

export function getPosturalViewDefinition(view: PosturalView): PosturalViewDefinition {
  return POSTURAL_VIEW_DEFINITIONS[view]
}
