import { describe, expect, it } from 'vitest'
import {
  createEntry,
  createWorkoutPlan,
  duplicateEntry,
  moveEntry,
  nextDivisionId,
} from '../domain/createWorkoutPlan'
import type { WorkoutExerciseEntry } from '../domain/workout.types'

const entradas = (...ids: string[]): WorkoutExerciseEntry[] => ids.map(createEntry)

describe('moveEntry', () => {
  it('move um exercicio para cima', () => {
    const r = moveEntry(entradas('a', 'b', 'c'), 2, 0)
    expect(r.map((e) => e.exerciseId)).toEqual(['c', 'a', 'b'])
  })

  it('move um exercicio para baixo', () => {
    const r = moveEntry(entradas('a', 'b', 'c'), 0, 2)
    expect(r.map((e) => e.exerciseId)).toEqual(['b', 'c', 'a'])
  })

  it('nao muta a lista original', () => {
    const original = entradas('a', 'b')
    moveEntry(original, 0, 1)
    expect(original.map((e) => e.exerciseId)).toEqual(['a', 'b'])
  })

  it('devolve a lista intacta quando o indice esta fora dos limites', () => {
    const original = entradas('a', 'b')
    expect(moveEntry(original, 0, 5)).toBe(original)
    expect(moveEntry(original, -1, 0)).toBe(original)
    expect(moveEntry(original, 1, 1)).toBe(original)
  })
})

describe('duplicateEntry', () => {
  it('insere a copia logo abaixo do original', () => {
    const r = duplicateEntry(entradas('a', 'b'), 0)
    expect(r.map((e) => e.exerciseId)).toEqual(['a', 'a', 'b'])
  })

  it('copia a prescricao, sem compartilhar a referencia', () => {
    const lista = entradas('a')
    lista[0].sets = 5
    lista[0].notes = 'pegada aberta'
    const r = duplicateEntry(lista, 0)
    expect(r[1].sets).toBe(5)
    expect(r[1].notes).toBe('pegada aberta')
    r[1].sets = 9
    expect(r[0].sets).toBe(5)
  })

  it('ignora indice inexistente', () => {
    const original = entradas('a')
    expect(duplicateEntry(original, 7)).toBe(original)
  })
})

describe('nextDivisionId', () => {
  it('nasce com a divisao A e sugere B em seguida', () => {
    const plan = createWorkoutPlan('aluno-1', 'Ana')
    expect(plan.divisions.map((d) => d.id)).toEqual(['A'])
    expect(nextDivisionId(plan)).toBe('B')
  })

  it('devolve null quando A ate E ja existem', () => {
    const plan = createWorkoutPlan('aluno-1', 'Ana')
    plan.divisions = (['A', 'B', 'C', 'D', 'E'] as const).map((id) => ({ id, label: '', entries: [] }))
    expect(nextDivisionId(plan)).toBeNull()
  })
})
