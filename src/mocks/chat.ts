import type { ChatMessage } from '@/features/chat/domain/chatMessage.types'

export type { ChatMessage } from '@/features/chat/domain/chatMessage.types'

/**
 * Conversa fictícia — chat ainda não é conectado a um backend de mensagens real. Inclui
 * propositalmente uma mensagem com token longo sem espaços (link) e uma mensagem de uma palavra
 * só: são os dois casos clássicos que vazam de bolha de chat quando falta `break-words`/
 * `overflow-wrap` no container.
 */
export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    from: 'trainer',
    text: 'Olá! Vi seus resultados da evolução de hoje. Excelente progresso no supino inclinado. Como está se sentindo para o treino de pernas amanhã?',
    time: '14:20',
  },
  {
    id: 'msg-2',
    from: 'student',
    text: 'Obrigado! Senti que a técnica está bem mais sólida. Para amanhã estou um pouco cansado, mas pronto para o desafio. Algum ajuste no volume?',
    time: '14:25',
  },
  {
    id: 'msg-3',
    from: 'trainer',
    text: 'Vamos reduzir uma série no agachamento e focar na execução. Qualidade acima de quantidade.',
    time: '14:28',
  },
  {
    id: 'msg-4',
    from: 'trainer',
    text: 'Segue o vídeo da execução correta: https://exemplo.com/videos/agachamento-tecnica-completa-explicacao-detalhada-2026',
    time: '14:31',
  },
  {
    id: 'msg-5',
    from: 'student',
    text: 'Perfeito!',
    time: '14:32',
  },
]
