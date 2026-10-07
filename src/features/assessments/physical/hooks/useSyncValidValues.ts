import { useEffect, useRef } from 'react'

/**
 * Espelha para o pai os valores do formulário, enquanto eles forem válidos.
 *
 * `onChange` fica numa ref de propósito: o wizard passa a callback inline
 * (`onChange={(b) => onUpdate({ biometrics: b })}`), então ela é uma função nova a
 * cada render. Se entrasse no array de dependências, cada salvamento re-renderizaria
 * o pai, criaria outra função, dispararia o efeito de novo — loop infinito de render,
 * que trava o passo e faz o dado nunca chegar ao banco.
 *
 * A dependência real são os VALORES, comparados por serialização — assim também não
 * há lista de campos para esquecer de atualizar quando o formulário ganhar um campo.
 *
 * Só propaga quando os valores DIFEREM do último que o pai já conhece (começando pelos
 * iniciais). Os schemas aceitam campos vazios, então o form nasce válido: sem essa guarda o
 * efeito disparava na montagem, o wizard chamava `onUpdate` e um rascunho vazio ia para o banco
 * só por abrir a tela "Nova avaliação".
 */
export function useSyncValidValues<T>(
  values: T,
  isValid: boolean,
  onChange: (value: T) => void,
): void {
  const onChangeRef = useRef(onChange)
  const valuesRef = useRef(values)
  const chave = JSON.stringify(values)
  const ultimaPropagadaRef = useRef(chave)

  useEffect(() => {
    onChangeRef.current = onChange
    valuesRef.current = values
  })

  useEffect(() => {
    if (!isValid || chave === ultimaPropagadaRef.current) return
    ultimaPropagadaRef.current = chave
    onChangeRef.current(valuesRef.current)
  }, [chave, isValid])
}
