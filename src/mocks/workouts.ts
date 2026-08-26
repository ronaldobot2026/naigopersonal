import type { WorkoutSession } from '@/features/workouts/domain/workout.types'

export type { WorkoutExerciseEntry, WorkoutSession } from '@/features/workouts/domain/workout.types'

/**
 * Dados fictícios — o programa de treino ainda não persiste em backend real. Os `exerciseId`
 * apontam para registros reais do catálogo, então as telas exibem nome, mídia e execução
 * verdadeiros.
 */
export const MOCK_WORKOUTS: WorkoutSession[] = [
  {
    id: 'treino-a',
    name: 'Peito & Tríceps — Hipertrofia com Ênfase em Amplitude',
    focusTag: 'HIPERTROFIA',
    durationMinutes: 65,
    progressPercent: 85,
    exercises: [
      { exerciseId: '0025', sets: 4, reps: '10-12', loadKg: 32 }, // supino com barra
      { exerciseId: '0314', sets: 3, reps: '10-12', loadKg: 18 }, // supino inclinado com halteres
      { exerciseId: '0061', sets: 3, reps: '12' }, // tríceps testa com barra
      { exerciseId: '0662', sets: 3, reps: 'até a falha' }, // flexão de braço
    ],
  },
  {
    id: 'treino-b',
    name: 'Costas & Bíceps',
    focusTag: 'FORÇA',
    durationMinutes: 70,
    progressPercent: 40,
    exercises: [
      { exerciseId: '0198', sets: 4, reps: '10-12' }, // puxada no cabo
      { exerciseId: '0861', sets: 3, reps: '12' }, // remada sentada no cabo
      { exerciseId: '0031', sets: 4, reps: '10', loadKg: 25 }, // rosca com barra
    ],
  },
  {
    id: 'treino-c',
    name: 'Membros Inferiores',
    focusTag: 'POTÊNCIA',
    durationMinutes: 75,
    progressPercent: 10,
    exercises: [
      { exerciseId: '0043', sets: 4, reps: '8-10', loadKg: 60 }, // agachamento completo com barra
      { exerciseId: '0085', sets: 3, reps: '10' }, // levantamento terra romeno com barra
      { exerciseId: '0599', sets: 3, reps: '12' }, // mesa flexora
      { exerciseId: '0417', sets: 4, reps: '15' }, // panturrilha em pé com halteres
    ],
  },
  {
    id: 'treino-d',
    name: 'Ombros & Core',
    focusTag: 'DEFINIÇÃO',
    durationMinutes: 55,
    progressPercent: 0,
    exercises: [
      { exerciseId: '0405', sets: 4, reps: '10' }, // desenvolvimento sentado com halteres
      { exerciseId: '0334', sets: 3, reps: '15' }, // elevação lateral com halteres
      { exerciseId: '0464', sets: 3, reps: '30s' }, // prancha frontal com rotação
    ],
  },
]
