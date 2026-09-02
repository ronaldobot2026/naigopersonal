import { useEffect, useRef } from 'react'

/**
 * Espelha para o pai os valores do formulário, enquanto eles forem válidos.
 *
 * `onChange` fica numa ref de propósito: o wizard passa a callback inline
 * (`onChange={(b) => onUpdate({ biometrics: b })}`), então ela é uma função nova a
 * cada render. Se entrasse no array de dependências, cada salvamento re-renderizaria
 * o pai, criaria outra função, dispararia o efeito de novo — loop infinito de render,
 * que trava o passo e faz o dado nunca chegar ao IndexedDB.
 *
 * A dependência real são os VALORES, comparados por serialização — assim também não
 * há lista de campos para esquecer de atualizar quando o formulário ganhar um campo.
 */
export function useSyncValidValues<T>(values: T, isValid: boolean, onChange: (value: T) => void): void {
  const onChangeRef = useRef(onChange)
  const valuesRef = useRef(values)

  useEffect(() => {
    onChangeRef.current = onChange
    valuesRef.current = values
  })

  const chave = JSON.stringify(values)

  useEffect(() => {
    if (!isValid) return
    onChangeRef.current(valuesRef.current)
  }, [chave, isValid])
}
