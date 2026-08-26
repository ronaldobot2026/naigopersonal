import type { Student } from '@/types/domain'
import { MOCK_TRAINER_ID } from './trainers'

/** Dados fictícios para desenvolvimento e demonstração — nunca dados reais de alunos. */
/** "Aluno logado" mockado — não há autenticação real ainda (ver docs/DECISIONS.md). */
export const MOCK_CURRENT_STUDENT_ID = 'student-maria-santos'

export const MOCK_STUDENTS: Student[] = [
  {
    id: 'student-maria-santos',
    name: 'Maria Eduarda Nascimento Bittencourt Santos',
    email: 'maria.eduarda.bittencourt.santos@example.com',
    trainerId: MOCK_TRAINER_ID,
  },
  {
    id: 'student-pedro-oliveira',
    name: 'Pedro Oliveira',
    email: 'pedro.oliveira@example.com',
    trainerId: MOCK_TRAINER_ID,
  },
  {
    id: 'student-ana-paula',
    name: 'Ana Paula',
    email: 'ana.paula@example.com',
    trainerId: MOCK_TRAINER_ID,
  },
  {
    id: 'student-lucas-costa',
    name: 'Lucas Costa',
    email: 'lucas.costa@example.com',
    trainerId: MOCK_TRAINER_ID,
  },
]
