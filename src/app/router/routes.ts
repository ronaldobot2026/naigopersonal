/** Constantes de rota, organizadas por papel. Padrões usados diretamente na config do router. */
export const ROUTES = {
  login: '/login',
  forgotPassword: '/esqueci-senha',
  resetPassword: '/redefinir-senha',
  student: {
    home: '/aluno/inicio',
    workouts: '/aluno/treinos',
    workoutDetail: '/aluno/treinos/:workoutId',
    exerciseDetail: '/aluno/exercicios/:exerciseId',
    nutrition: '/aluno/plano-alimentar',
    posturalCorrection: '/aluno/correcao-postural',
    myAssessments: '/aluno/avaliacoes',
    assessmentDetail: '/aluno/avaliacoes/:assessmentId',
    anamnesis: '/aluno/anamnese',
    anamnesisDetail: '/aluno/anamnese/:anamnesisId',
    chat: '/aluno/chat',
    billing: '/aluno/financeiro',
    account: '/aluno/conta',
  },
  trainer: {
    dashboard: '/personal/dashboard',
    students: '/personal/alunos',
    studentDetail: '/personal/alunos/:studentId',
    studentAssessments: '/personal/alunos/:studentId/avaliacoes',
    newAssessment: '/personal/alunos/:studentId/avaliacoes/nova',
    viewAssessment: '/personal/alunos/:studentId/avaliacoes/:assessmentId',
    studentAnamnesis: '/personal/alunos/:studentId/anamnese',
    anamnesisDetail: '/personal/alunos/:studentId/anamnese/:anamnesisId',
    library: '/personal/biblioteca',
    newWorkout: '/personal/treinos/novo',
    studentWorkoutBuilder: '/personal/alunos/:studentId/treino',
    chat: '/personal/chat',
  },
} as const

export function buildStudentDetailPath(studentId: string): string {
  return `/personal/alunos/${studentId}`
}

/**
 * Parâmetro de busca que abre UMA sessão de treino já expandida na aderência
 * (`/personal/alunos/:id?sessao=<workoutLogId>`).
 *
 * É a volta do link de contexto da conversa: a mensagem do aluno carrega `context_id` = a
 * EXECUÇÃO (`workout_logs.id`, ver CHAT-4), e o personal precisa cair na sessão certa em vez de
 * procurar na lista. Fica em query, não em rota nova: é um destaque sobre a ficha do aluno, e a
 * mesma tela com a sessão fechada continua valendo.
 */
export const SESSION_HIGHLIGHT_PARAM = 'sessao'

export function buildSessionHighlightPath(studentId: string, workoutLogId: string): string {
  return `${buildStudentDetailPath(studentId)}?${SESSION_HIGHLIGHT_PARAM}=${workoutLogId}`
}

/** Conversa aberta na caixa de entrada do personal (`/personal/chat?conversa=<id>`). */
export const INBOX_CONVERSATION_PARAM = 'conversa'

export function buildTrainerConversationPath(conversationId: string): string {
  return `/personal/chat?${INBOX_CONVERSATION_PARAM}=${conversationId}`
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

export function buildStudentAssessmentDetailPath(assessmentId: string): string {
  return `/aluno/avaliacoes/${assessmentId}`
}

export function buildStudentAnamnesisListPath(studentId: string): string {
  return `/personal/alunos/${studentId}/anamnese`
}

export function buildTrainerAnamnesisPath(studentId: string, anamnesisId: string): string {
  return `/personal/alunos/${studentId}/anamnese/${anamnesisId}`
}

export function buildStudentAnamnesisDetailPath(anamnesisId: string): string {
  return `/aluno/anamnese/${anamnesisId}`
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
