import { MOCK_CHAT_MESSAGES } from '@/mocks/chat'
import type { ChatMessage } from '../domain/chatMessage.types'

/**
 * Fonte de dados da conversa personal↔aluno. Hoje devolve o fixture de `@/mocks/chat`; o envio
 * continua otimista em memória na própria página até existir backend de mensagens (Fase 12 do
 * roadmap — realtime, anexos, persistência).
 */
export const chatRepository = {
  async findMessages(): Promise<ChatMessage[]> {
    return MOCK_CHAT_MESSAGES
  },
}
