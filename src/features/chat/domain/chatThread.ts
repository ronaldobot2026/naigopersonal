import type { ChatMessage } from './chatMessage.types'

/**
 * Reconciliação da conversa em memória.
 *
 * A pegadinha clássica do chat otimista: a mensagem aparece na tela antes de o `insert` voltar e,
 * logo depois, o MESMO insert chega de novo pelo Realtime — sem reconciliar por identidade, a
 * mensagem do próprio usuário aparece duas vezes.
 *
 * A identidade aqui é o `id`, gerado no cliente e reenviado no insert (ver
 * `chatRepository.sendMessage`): a linha otimista, a resposta do insert e o evento do Realtime
 * carregam o mesmo id, então qualquer ordem de chegada converge para uma única bolha.
 */

/** Ordem da thread: cronológica crescente (a tela rola para o fim). Empate desempatado por id. */
function compare(a: ChatMessage, b: ChatMessage): number {
  if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  return a.createdAt < b.createdAt ? -1 : 1
}

/**
 * Insere ou substitui `incoming` na thread, mantendo a ordem cronológica.
 *
 * Quando o id já está na lista a linha é SUBSTITUÍDA: é assim que a mensagem otimista
 * (`pending: true`) vira a definitiva, e é por isso que o evento do Realtime da própria mensagem
 * não duplica nada.
 */
export function mergeMessage(current: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const index = current.findIndex((message) => message.id === incoming.id)
  if (index >= 0) {
    const next = [...current]
    next[index] = incoming
    return next.sort(compare)
  }
  return [...current, incoming].sort(compare)
}

/** Mescla um lote (página do histórico) na thread, sem duplicar o que já está em memória. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  return incoming.reduce(mergeMessage, current)
}

/** Remove uma mensagem por id — usado quando o envio falha e a bolha otimista precisa sair. */
export function dropMessage(current: ChatMessage[], id: string): ChatMessage[] {
  return current.filter((message) => message.id !== id)
}
