import { describe, expect, it } from 'vitest'
import type { PosturalMetric } from '@/features/assessments/postural/domain/posturalAssessment.types'
import { toExerciseCatalog } from '../domain/exerciseCatalog'
import type { Exercise, RawExerciseCatalog } from '../domain/exercise.types'
import { POSTURAL_CATEGORIES } from '../domain/posturalProgram'
import {
  POSTURAL_FOCUSES,
  derivePosturalFindings,
  selectExercisesForFocus,
} from '../domain/posturalPrescription'

function buildMetric(
  overrides: Partial<PosturalMetric> & Pick<PosturalMetric, 'id'>,
): PosturalMetric {
  return {
    label: 'Métrica',
    view: 'front',
    value: 10,
    unit: 'degree',
    confidence: 0.9,
    status: 'attention',
    automaticObservation: 'Indicador visual. Requer validação do profissional.',
    trainerValidation: 'accepted',
    ...overrides,
  }
}

describe('derivePosturalFindings', () => {
  it('mapeia cada métrica destacada para a região que ela observa', () => {
    const findings = derivePosturalFindings([
      buildMetric({ id: 'front.shoulderInclination', value: 6 }),
      buildMetric({ id: 'left_side.headAlignment', value: 20, view: 'left_side' }),
    ])

    expect(findings.map((finding) => finding.focus.id)).toEqual(['cintura_escapular', 'cervical'])
  })

  it('ordena da leitura mais acentuada para a menos, em relação ao limiar de cada métrica', () => {
    // 9° num limiar de 3° (razão 3) pesa mais que 18° num limiar de 12° (razão 1,5),
    // mesmo o segundo tendo o valor absoluto maior.
    const findings = derivePosturalFindings([
      buildMetric({ id: 'left_side.headAlignment', value: 18, view: 'left_side' }),
      buildMetric({ id: 'front.hipInclination', value: 9 }),
    ])

    expect(findings.map((finding) => finding.focus.id)).toEqual(['quadril_pelve', 'cervical'])
    expect(findings[0].severity).toBeCloseTo(3)
    expect(findings[1].severity).toBeCloseTo(1.5)
  })

  it('junta num único achado a mesma região vista de dois ângulos', () => {
    const findings = derivePosturalFindings([
      buildMetric({ id: 'front.shoulderInclination', value: 4 }),
      buildMetric({ id: 'back.shoulderInclination', value: 7, view: 'back' }),
    ])

    expect(findings).toHaveLength(1)
    expect(findings[0].metrics).toHaveLength(2)
    // A severidade acompanha a leitura mais acentuada das duas.
    expect(findings[0].severity).toBeCloseTo(7 / 3)
  })

  it('ignora métricas dentro da faixa esperada', () => {
    const findings = derivePosturalFindings([
      buildMetric({ id: 'front.shoulderInclination', status: 'within_expected_range', value: 1 }),
    ])

    expect(findings).toEqual([])
  })

  it('ignora métricas que o treinador rejeitou', () => {
    const findings = derivePosturalFindings([
      buildMetric({ id: 'front.hipInclination', trainerValidation: 'rejected' }),
    ])

    expect(findings).toEqual([])
  })

  it('ignora leituras não conclusivas, mesmo com valor alto', () => {
    const findings = derivePosturalFindings([
      buildMetric({ id: 'front.hipInclination', status: 'low_confidence', value: 30 }),
      buildMetric({
        id: 'back.hipInclination',
        status: 'not_available',
        value: null,
        view: 'back',
      }),
    ])

    expect(findings).toEqual([])
  })

  it('sinaliza quando algum apoio do achado ainda aguarda o treinador', () => {
    const [pending] = derivePosturalFindings([
      buildMetric({ id: 'front.shoulderInclination', trainerValidation: 'pending' }),
    ])
    const [reviewed] = derivePosturalFindings([
      buildMetric({ id: 'front.shoulderInclination', trainerValidation: 'edited' }),
    ])

    expect(pending.isTrainerValidated).toBe(false)
    expect(reviewed.isTrainerValidated).toBe(true)
  })

  it('não quebra com um id de métrica que ainda não tem região mapeada', () => {
    expect(derivePosturalFindings([buildMetric({ id: 'front.kneeSymmetry' })])).toEqual([])
  })
})

describe('selectExercisesForFocus (catálogo real)', () => {
  // Lido pelo pipeline do Vite (raiz do projeto), e não por `fs`: o tsconfig da aplicação
  // não expõe os tipos do Node — de propósito, para o código de app não usar API de Node.
  const modules = import.meta.glob('/public/data/exercises.json', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>
  const raw = JSON.parse(modules['/public/data/exercises.json']) as RawExerciseCatalog
  const { exercises } = toExerciseCatalog(raw)

  it('devolve exercícios em toda combinação de região e categoria', () => {
    // Guarda de regressão: um rótulo de músculo renomeado em `exerciseTaxonomy.ts` esvaziaria
    // silenciosamente uma aba da tela. Aqui isso vira um teste vermelho.
    for (const focus of POSTURAL_FOCUSES) {
      for (const category of POSTURAL_CATEGORIES) {
        const selected = selectExercisesForFocus(exercises, focus.id, category.id)
        expect(selected.length, `sem exercícios para ${focus.id} / ${category.id}`).toBeGreaterThan(
          0,
        )
      }
    }
  })

  it('restringe o resultado à região pedida', () => {
    const focus = POSTURAL_FOCUSES.find((item) => item.id === 'quadril_pelve')!
    const selected = selectExercisesForFocus(exercises, 'quadril_pelve', 'fortalecimento')

    const belongsToFocus = (exercise: Exercise) =>
      focus.muscles.includes(exercise.target) || focus.bodyParts.includes(exercise.bodyPart)

    expect(selected.every(belongsToFocus)).toBe(true)
  })

  it('é um subconjunto da categoria — nunca traz exercício fora dela', () => {
    const alongamentos = selectExercisesForFocus(exercises, 'cervical', 'alongamento')

    expect(alongamentos.length).toBeGreaterThan(0)
    expect(alongamentos.every((exercise) => exercise.originalName.includes('stretch'))).toBe(true)
  })
})
