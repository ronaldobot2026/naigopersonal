/** Constantes de rota, organizadas por papel. Padrões usados diretamente na config do router. */
export const ROUTES = {
  login: '/login',
  student: {
    home: '/aluno/inicio',
    workouts: '/aluno/treinos',
    workoutDetail: '/aluno/treinos/:workoutId',
    exerciseDetail: '/aluno/exercicios/:exerciseId',
    nutrition: '/aluno/plano-alimentar',
    posturalCorrection: '/aluno/correcao-postural',
    myAssessments: '/aluno/avaliacoes',
    chat: '/aluno/chat',
    billing: '/aluno/financeiro',
  },
  trainer: {
    dashboard: '/personal/dashboard',
    students: '/personal/alunos',
    studentDetail: '/personal/alunos/:studentId',
    studentAssessments: '/personal/alunos/:studentId/avaliacoes',
    newAssessment: '/personal/alunos/:studentId/avaliacoes/nova',
    viewAssessment: '/personal/alunos/:studentId/avaliacoes/:assessmentId',
    library: '/personal/biblioteca',
    newWorkout: '/personal/treinos/novo',
    studentWorkoutBuilder: '/personal/alunos/:studentId/treino',
    chat: '/personal/chat',
  },
} as const

export function buildStudentDetailPath(studentId: string): string {
  return `/personal/alunos/${studentId}`
}

export function buildStudentAssessmentsPath(studentId: string): string {
  return `/personal/alunos/${studentId}/avaliacoes`
}

export function buildNewAssessmentPath(studentId: string): string {
  return `/personal/alunos/${studentId}/avaliacoes/nova`
}

export function buildViewAssessmentPath(studentId: string, assessmentId: string): string {
  return `/personal/alunos/${studentId}/avaliacoes/${assessmentId}`
}

export function buildWorkoutDetailPath(workoutId: string): string {
  return `/aluno/treinos/${workoutId}`
}

export function buildExerciseDetailPath(exerciseId: string): string {
  return `/aluno/exercicios/${exerciseId}`
}

export function buildWorkoutBuilderPath(studentId: string): string {
  return `/personal/alunos/${studentId}/treino`
}
