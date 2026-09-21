import { describe, expect, it } from 'vitest'
import {
  angleBetweenPoints,
  bilateralComparison,
  deviationFromHorizontal,
  deviationFromVertical,
  distance,
  midpoint,
  normalizeBySize,
  signedDistanceFromLine,
  slopeDegrees,
} from '../domain/geometry'

describe('distance', () => {
  it('calcula a distância euclidiana (triângulo 3-4-5)', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('retorna 0 para pontos coincidentes', () => {
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0)
  })
})

describe('midpoint', () => {
  it('calcula o ponto médio entre dois pontos', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 2, y: 4 })).toEqual({ x: 1, y: 2 })
  })
})

describe('slopeDegrees', () => {
  it('retorna 0 para um segmento perfeitamente horizontal', () => {
    expect(slopeDegrees({ x: 0, y: 0.3 }, { x: 1, y: 0.3 })).toBe(0)
  })

  it('retorna sinal positivo quando o segundo ponto está mais baixo na imagem', () => {
    const value = slopeDegrees({ x: 0, y: 0.3 }, { x: 1, y: 0.4 })
    expect(value).toBeGreaterThan(0)
  })

  it('dobra ângulos de linha para o intervalo (-90, 90]', () => {
    // segmento quase vertical apontando para baixo: equivalente a uma linha vertical
    const value = slopeDegrees({ x: 0.5, y: 0 }, { x: 0.5, y: 1 })
    expect(Math.abs(value)).toBeCloseTo(90, 5)
  })
})

describe('deviationFromHorizontal', () => {
  it('é 0 para um segmento horizontal', () => {
    expect(deviationFromHorizontal({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0)
  })

  it('é sempre não-negativo, independente do sentido do segmento', () => {
    const a = deviationFromHorizontal({ x: 0, y: 0 }, { x: 1, y: 0.2 })
    const b = deviationFromHorizontal({ x: 1, y: 0.2 }, { x: 0, y: 0 })
    expect(a).toBeCloseTo(b, 10)
    expect(a).toBeGreaterThan(0)
  })
})

describe('deviationFromVertical', () => {
  it('é 0 para um segmento perfeitamente vertical', () => {
    expect(deviationFromVertical({ x: 0.5, y: 0 }, { x: 0.5, y: 1 })).toBe(0)
  })

  it('é 90 para um segmento perfeitamente horizontal', () => {
    expect(deviationFromVertical({ x: 0, y: 0.5 }, { x: 1, y: 0.5 })).toBeCloseTo(90, 5)
  })
})

describe('angleBetweenPoints', () => {
  it('calcula 90 graus para um ângulo reto', () => {
    const angle = angleBetweenPoints({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })
    expect(angle).toBeCloseTo(90, 5)
  })

  it('calcula 180 graus para pontos colineares em direções opostas', () => {
    const angle = angleBetweenPoints({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })
    expect(angle).toBeCloseTo(180, 5)
  })

  it('lança erro quando um dos raios tem comprimento zero', () => {
    expect(() => angleBetweenPoints({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toThrow()
  })
})

describe('normalizeBySize', () => {
  it('retorna a razão entre o valor e o comprimento de referência', () => {
    expect(normalizeBySize(10, 20)).toBe(0.5)
  })

  it('lança erro quando o comprimento de referência é zero ou negativo', () => {
    expect(() => normalizeBySize(10, 0)).toThrow()
    expect(() => normalizeBySize(10, -5)).toThrow()
  })
})

describe('signedDistanceFromLine', () => {
  it('retorna 0 para um ponto sobre a reta', () => {
    expect(signedDistanceFromLine({ x: 0.5, y: 0.75 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 })).toBe(0)
  })

  it('calcula a distância perpendicular a uma reta vertical', () => {
    const value = signedDistanceFromLine({ x: 0.58, y: 0.5 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 })
    expect(Math.abs(value)).toBeCloseTo(0.08, 10)
  })

  it('inverte o sinal quando o ponto está do lado oposto da reta', () => {
    const left = signedDistanceFromLine({ x: 0.4, y: 0.5 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 })
    const right = signedDistanceFromLine({ x: 0.6, y: 0.5 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 })
    expect(Math.sign(left)).toBe(-Math.sign(right))
  })

  it('lança erro quando lineStart e lineEnd coincidem', () => {
    expect(() =>
      signedDistanceFromLine({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 1 }),
    ).toThrow()
  })
})

describe('bilateralComparison', () => {
  it('retorna diferença e razão de assimetria zero para valores idênticos', () => {
    expect(bilateralComparison(10, 10)).toEqual({ difference: 0, asymmetryRatio: 0 })
  })

  it('calcula diferença com sinal e razão de assimetria proporcional', () => {
    const result = bilateralComparison(10, 12)
    expect(result.difference).toBe(2)
    expect(result.asymmetryRatio).toBeCloseTo(2 / 11, 5)
  })

  it('não lança divisão por zero quando ambos os lados são zero', () => {
    expect(bilateralComparison(0, 0)).toEqual({ difference: 0, asymmetryRatio: 0 })
  })
})
