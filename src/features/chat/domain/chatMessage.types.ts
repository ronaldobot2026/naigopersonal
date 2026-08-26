export interface ChatMessage {
  id: string
  from: 'trainer' | 'student'
  text: string
  time: string
}
