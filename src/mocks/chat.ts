export interface ChatMessage {
  id: string
  from: 'trainer' | 'student'
  text: string
  time: string
}

/** Conversa fictícia — chat ainda não é conectado a um backend de mensagens real. */
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
]
