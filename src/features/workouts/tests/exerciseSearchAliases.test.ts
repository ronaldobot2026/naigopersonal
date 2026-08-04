import { describe, expect, it } from 'vitest'
import rawCatalog from '../../../../public/data/exercises.json?raw'
import type { RawExerciseCatalog } from '../domain/exercise.types'
import { filterExercises, toExerciseCatalog } from '../domain/exerciseCatalog'
import { SEARCH_ALIASES, findAliasesForName } from '../domain/exerciseSearchAliases'

const catalog = toExerciseCatalog(JSON.parse(rawCatalog) as RawExerciseCatalog)
const NO_FILTERS = { bodyPart: null, equipment: null, target: null }

function search(term: string) {
  return filterExercises(catalog.exercises, { ...NO_FILTERS, search: term })
}

describe('findAliasesForName', () => {
  it('exige palavra inteira — "fly" não pode casar dentro de "butterfly"', () => {
    expect(findAliasesForName('butterfly yoga pose')).not.toContain('voador')
    expect(findAliasesForName('cable low fly')).toContain('voador')
  })

  it('associa os nomes de stiff usados no Brasil', () => {
    expect(findAliasesForName('barbell straight leg deadlift')).toContain('stiff')
    expect(findAliasesForName('dumbbell stiff leg deadlift')).toContain('stiff')
    expect(findAliasesForName('barbell romanian deadlift')).toContain('stiff')
  })

  it('não associa apelido a exercício não relacionado', () => {
    expect(findAliasesForName('barbell bench press')).not.toContain('stiff')
    expect(findAliasesForName('barbell curl')).not.toContain('agachamento')
  })
})

describe('busca com vocabulário de academia brasileiro', () => {
  it('encontra o stiff com barra, que no dataset se chama "straight leg deadlift"', () => {
    const ids = search('stiff').map((exercise) => exercise.id)

    expect(ids).toContain('0116') // barbell straight leg deadlift
    expect(ids).toContain('0432') // dumbbell stiff leg deadlift
    expect(ids).toContain('0085') // barbell romanian deadlift
  })

  it.each([
    ['mesa flexora', 'leg curl'],
    ['cadeira extensora', 'leg extension'],
    ['elevacao pelvica', 'hip thrust / glute bridge'],
    ['rosca scott', 'preacher curl'],
    ['triceps testa', 'skullcrusher'],
    ['agachamento bulgaro', 'split squat'],
    ['barra fixa', 'pull-up'],
    ['remada baixa', 'seated row'],
    ['voador', 'fly'],
    ['desenvolvimento militar', 'military press'],
    ['levantamento terra', 'deadlift'],
    ['prancha', 'plank'],
    ['encolhimento', 'shrug'],
    ['panturrilha', 'calf raise'],
  ])('"%s" encontra os exercícios de %s', (term) => {
    expect(search(term).length).toBeGreaterThan(0)
  })

  it('a busca sem acento encontra o mesmo que a com acento', () => {
    expect(search('elevacao pelvica').length).toBe(search('elevação pélvica').length)
  })

  it('não mistura o apelido no nome exibido', () => {
    // O apelido serve só para achar; o cartão continua mostrando o nome traduzido.
    const stiff = search('stiff').find((exercise) => exercise.id === '0116')
    expect(stiff?.name).not.toContain('stiff')
  })
})

describe('integridade do dicionário de apelidos', () => {
  it('todo apelido casa com pelo menos um exercício do catálogo', () => {
    const dead = SEARCH_ALIASES.filter(([term]) => search(term).length === 0).map(([term]) => term)
    expect(dead).toEqual([])
  })

  it('não tem termo em pt-BR duplicado', () => {
    const terms = SEARCH_ALIASES.map(([term]) => term)
    expect(new Set(terms).size).toBe(terms.length)
  })
})
