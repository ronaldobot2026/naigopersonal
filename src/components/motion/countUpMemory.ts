/**
 * Memória de contagens já exibidas, por sessão do app.
 *
 * As abas do aluno (Ficha, Treino, …) desmontam a página inteira, então todo `CountUp` da home
 * remontava e recomeçava do zero a cada volta — flicker e número errado por alguns segundos.
 * Este módulo guarda, por chave, o último valor que já foi contado para o usuário: quem já viu
 * a contagem daquele número recebe o valor final direto.
 *
 * É memória do app de propósito (um `Map` no módulo, vivo enquanto a aba estiver aberta). Não
 * usa `localStorage`: a marca não deve sobreviver ao fechamento da aba, senão o usuário nunca
 * mais veria a animação. Recarregar a página reanima, o que é o comportamento desejado.
 */
const lastShownByKey = new Map<string, number>()

/** Último valor já contado para esta chave nesta sessão, ou `null` se nunca contou. */
export function recallCountUpValue(key: string): number | null {
  const value = lastShownByKey.get(key)
  return value === undefined ? null : value
}

export function rememberCountUpValue(key: string, value: number): void {
  lastShownByKey.set(key, value)
}

/** Usado em teste (e em logout) para voltar ao estado de "primeira visita". */
export function resetCountUpMemory(): void {
  lastShownByKey.clear()
}
