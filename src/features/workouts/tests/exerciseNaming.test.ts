import { describe, expect, it } from 'vitest'
import { translateExerciseName } from '../domain/exerciseNaming'

describe('translateExerciseName — composição', () => {
  it('remonta movimento, modificador e equipamento na ordem do português', () => {
    expect(translateExerciseName('dumbbell incline bench press').value).toBe(
      'Supino inclinado com halteres',
    )
    expect(translateExerciseName('barbell curl').value).toBe('Rosca com barra')
    expect(translateExerciseName('cable seated row').value).toBe('Remada sentada no cabo')
  })

  it('faz a concordância de gênero com o movimento', () => {
    // "supino" é masculino, "rosca" é feminino — o mesmo modificador muda de forma.
    expect(translateExerciseName('barbell decline bench press').value).toContain('declinado')
    expect(translateExerciseName('dumbbell incline curl').value).toContain('inclinada')
  })

  it('prefere a expressão mais completa quando duas terminam no mesmo ponto', () => {
    // "bench press" precisa vencer "press", senão viraria "Pressão ... no banco".
    expect(translateExerciseName('barbell bench press').value).toBe('Supino com barra')
    expect(translateExerciseName('lever leg press').value).toBe('Leg press na máquina')
  })

  it('escolhe o núcleo à direita em nomes compostos', () => {
    expect(translateExerciseName('dumbbell biceps curl to shoulder press').value).toContain(
      'Desenvolvimento',
    )
  })
})

describe('translateExerciseName — segurança', () => {
  it('preserva termos desconhecidos em vez de descartá-los', () => {
    // Sem isso, "superman push-up" e "chest tap push-up" colapsariam no mesmo nome.
    expect(translateExerciseName('superman push-up').value).toContain('superman')
    expect(translateExerciseName('kettlebell pistol squat').value).toContain('pistol')
    expect(translateExerciseName('superman push-up').value).not.toBe(
      translateExerciseName('shoulder tap push-up').value,
    )
  })

  it('devolve o nome original quando não reconhece o movimento', () => {
    const result = translateExerciseName('pelvic tilt')
    expect(result.value).toBe('pelvic tilt')
    expect(result.isTranslated).toBe(false)
  })

  it('remove ruído de catálogo do dataset', () => {
    expect(translateExerciseName('barbell upright row v. 2').value).toBe('Remada alta com barra')
    expect(translateExerciseName('push-up (male)').value).toBe('Flexão de braço')
  })

  it('não repete o equipamento já contido no movimento', () => {
    expect(translateExerciseName('sled 45 degrees leg press').value).not.toMatch(
      /leg press.*leg press/i,
    )
  })

  it('é determinística', () => {
    const name = 'cable one arm curl'
    expect(translateExerciseName(name).value).toBe(translateExerciseName(name).value)
  })
})
