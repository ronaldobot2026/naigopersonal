import { env } from '@/lib/config/env'
import type { Student } from '@/types/domain'
import { MOCK_TRAINER_ID } from './trainers'

/** Dados fictícios para desenvolvimento e demonstração — nunca dados reais de alunos. */
/**
 * "Aluno logado" mockado para as features que ainda não migraram para dados reais (Fase 8,
 * pendente). O id usa `VITE_DEMO_STUDENT_ID` quando definido — precisa bater com a linha real de
 * `public.students` no Supabase (criada por `scripts/seed-demo-users.mjs`) para a Avaliação
 * Física (Fase 9, já em Supabase) conseguir gravar; sem a variável, cai no id mockado antigo e o
 * resto do app (treinos, chat, etc., ainda 100% mock) continua funcionando normalmente.
 */
export const MOCK_CURRENT_STUDENT_ID = env.demoStudentId() ?? 'student-maria-santos'

export const MOCK_STUDENTS: Student[] = [
  {
    id: MOCK_CURRENT_STUDENT_ID,
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
