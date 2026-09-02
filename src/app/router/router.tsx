import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/app/layouts/AppShell'
import { RoleShell } from '@/app/layouts/RoleShell'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { PersonalDashboardPage } from '@/features/dashboard/pages/PersonalDashboardPage'
import { StudentHomePage } from '@/features/dashboard/pages/StudentHomePage'
import { NewPhysicalAssessmentPage } from '@/features/assessments/physical/pages/NewPhysicalAssessmentPage'
import { StudentAssessmentsPage } from '@/features/assessments/physical/pages/StudentAssessmentsPage'
import { StudentsListPage } from '@/features/students/pages/StudentsListPage'
import { StudentDetailPage } from '@/features/students/pages/StudentDetailPage'
import { StudentWorkoutsPage } from '@/features/workouts/pages/StudentWorkoutsPage'
import { WorkoutDetailPage } from '@/features/workouts/pages/WorkoutDetailPage'
import { ExerciseDetailPage } from '@/features/workouts/pages/ExerciseDetailPage'
import { PosturalCorrectionPage } from '@/features/workouts/pages/PosturalCorrectionPage'
import { ExerciseLibraryPage } from '@/features/workouts/pages/ExerciseLibraryPage'
import { WorkoutBuilderPage } from '@/features/workouts/pages/WorkoutBuilderPage'
import { NutritionPlanPage } from '@/features/nutrition/pages/NutritionPlanPage'
import { BillingPage } from '@/features/billing/pages/BillingPage'
import { ChatPage } from '@/features/chat/pages/ChatPage'
import type { NavItem } from '@/components/navigation/BottomNavigation'
import { ROUTES } from './routes'

const STUDENT_NAV_ITEMS: NavItem[] = [
  { to: ROUTES.student.home, icon: 'home', label: 'Início' },
  { to: ROUTES.student.workouts, icon: 'fitness_center', label: 'Treinos' },
  { to: ROUTES.student.posturalCorrection, icon: 'accessibility_new', label: 'Correção' },
  { to: ROUTES.student.chat, icon: 'chat', label: 'Chat' },
]

const TRAINER_NAV_ITEMS: NavItem[] = [
  { to: ROUTES.trainer.dashboard, icon: 'dashboard', label: 'Dashboard' },
  { to: ROUTES.trainer.students, icon: 'group', label: 'Alunos' },
  { to: ROUTES.trainer.library, icon: 'menu_book', label: 'Biblioteca' },
  { to: ROUTES.trainer.chat, icon: 'chat', label: 'Chat' },
]

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to={ROUTES.login} replace /> },
  {
    element: <AppShell />,
    children: [{ path: ROUTES.login, element: <LoginPage /> }],
  },
  {
    element: (
      <RoleShell navItems={STUDENT_NAV_ITEMS} sidebarSubtitle="ÁREA DO ALUNO" switchTo="trainer" />
    ),
    children: [
      { path: ROUTES.student.home, element: <StudentHomePage /> },
      { path: ROUTES.student.workouts, element: <StudentWorkoutsPage /> },
      { path: ROUTES.student.workoutDetail, element: <WorkoutDetailPage /> },
      { path: ROUTES.student.exerciseDetail, element: <ExerciseDetailPage /> },
      { path: ROUTES.student.nutrition, element: <NutritionPlanPage /> },
      { path: ROUTES.student.posturalCorrection, element: <PosturalCorrectionPage /> },
      {
        path: ROUTES.student.chat,
        element: <ChatPage selfRole="student" counterpartName="Trainer Wood" />,
      },
      { path: ROUTES.student.billing, element: <BillingPage /> },
    ],
  },
  {
    element: (
      <RoleShell
        navItems={TRAINER_NAV_ITEMS}
        sidebarSubtitle="ELITE TRAINING SYSTEM"
        switchTo="student"
      />
    ),
    children: [
      { path: ROUTES.trainer.dashboard, element: <PersonalDashboardPage /> },
      { path: ROUTES.trainer.students, element: <StudentsListPage /> },
      { path: ROUTES.trainer.studentDetail, element: <StudentDetailPage /> },
      { path: ROUTES.trainer.studentAssessments, element: <StudentAssessmentsPage /> },
      { path: ROUTES.trainer.newAssessment, element: <NewPhysicalAssessmentPage /> },
      { path: ROUTES.trainer.viewAssessment, element: <NewPhysicalAssessmentPage /> },
      { path: ROUTES.trainer.library, element: <ExerciseLibraryPage /> },
      { path: ROUTES.trainer.newWorkout, element: <WorkoutBuilderPage /> },
      { path: ROUTES.trainer.studentWorkoutBuilder, element: <WorkoutBuilderPage /> },
      {
        path: ROUTES.trainer.chat,
        element: <ChatPage selfRole="trainer" counterpartName="Aluno" />,
      },
    ],
  },
  { path: '*', element: <Navigate to={ROUTES.login} replace /> },
])
