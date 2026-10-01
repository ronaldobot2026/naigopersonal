import { describe, expect, it } from 'vitest'
import {
  ANAMNESIS_TEMPLATES,
  getAnamnesisTemplate,
  getParqPositiveQuestions,
  getUnansweredQuestions,
} from '../domain/anamnesisTemplates'

describe('modelos de anamnese', () => {
  it('PAR-Q tem 7 perguntas Sim/Não e o Padrão tem 17 itens', () => {
    expect(getAnamnesisTemplate('parq').questions).toHaveLength(7)
    expect(getAnamnesisTemplate('parq').questions.every((q) => q.type === 'yesno')).toBe(true)
    expect(getAnamnesisTemplate('standard').questions).toHaveLength(17)
  })

  it('ids de pergunta são únicos dentro e entre os modelos', () => {
    const ids = ANAMNESIS_TEMPLATES.flatMap((t) => t.questions.map((q) => q.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('tudo em branco: lista todas as perguntas, menos as opcionais', () => {
    const padrao = getAnamnesisTemplate('standard')
    const faltando = getUnansweredQuestions(padrao, {})
    expect(faltando).toHaveLength(16)
    expect(faltando.some((q) => q.id === 'std-17')).toBe(false)
  })

  it('Sim com detalhe vazio conta como pendente; Não dispensa o detalhe', () => {
    const padrao = getAnamnesisTemplate('standard')
    const base = { 'std-5': { choice: 'yes' as const } }
    expect(getUnansweredQuestions(padrao, base).some((q) => q.id === 'std-5')).toBe(true)
    expect(
      getUnansweredQuestions(padrao, { 'std-5': { choice: 'yes', text: 'Whey' } }).some(
        (q) => q.id === 'std-5',
      ),
    ).toBe(false)
    expect(
      getUnansweredQuestions(padrao, { 'std-5': { choice: 'no' } }).some((q) => q.id === 'std-5'),
    ).toBe(false)
  })

  it('PAR-Q: devolve só as respostas Sim', () => {
    const positivas = getParqPositiveQuestions({
      'parq-1': { choice: 'no' },
      'parq-2': { choice: 'yes' },
      'parq-5': { choice: 'yes' },
    })
    expect(positivas.map((q) => q.id)).toEqual(['parq-2', 'parq-5'])
  })
})
