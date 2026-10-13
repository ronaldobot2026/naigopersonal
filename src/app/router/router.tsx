import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/app/layouts/AppShell'
import { StudentShell } from '@/app/layouts/StudentShell'
import { TrainerShell } from '@/app/layouts/TrainerShell'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { PersonalDashboardPage } from '@/features/dashboard/pages/PersonalDashboardPage'
import { StudentHomePage } from '@/features/dashboard/pages/StudentHomePage'
import { NewPhysicalAssessmentPage } from '@/features/assessments/physical/pages/NewPhysicalAssessmentPage'
import { StudentAssessmentsPage } from '@/features/assessments/physical/pages/StudentAssessmentsPage'
import { StudentMyAssessmentsPage } from '@/features/assessments/physical/pages/StudentMyAssessmentsPage'
import { StudentAssessmentDetailPage } from '@/features/assessments/physical/pages/StudentAssessmentDetailPage'
import { StudentAnamnesisListPage } from '@/features/anamnesis/pages/StudentAnamnesisListPage'
import { TrainerAnamnesisPage } from '@/features/anamnesis/pages/TrainerAnamnesisPage'
import {
  StudentAnamnesisFillPage,
  StudentMyAnamnesisPage,
} from '@/features/anamnesis/pages/StudentMyAnamnesisPage'
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
import { TrainerInboxPage } from '@/features/chat/pages/TrainerInboxPage'
import { ROUTES } from './routes'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to={ROUTES.login} replace /> },
  {
    element: <AppShell />,
    children: [{ path: ROUTES.login, element: <LoginPage /> }],
  },
  {
    element: <StudentShell />,
    children: [
      { path: ROUTES.student.home, element: <StudentHomePage /> },
      { path: ROUTES.student.workouts, element: <StudentWorkoutsPage /> },
      { path: ROUTES.student.workoutDetail, element: <WorkoutDetailPage /> },
      { path: ROUTES.student.exerciseDetail, element: <ExerciseDetailPage /> },
      { path: ROUTES.student.nutrition, element: <NutritionPlanPage /> },
      { path: ROUTES.student.posturalCorrection, element: <PosturalCorrectionPage /> },
      { path: ROUTES.student.myAssessments, element: <StudentMyAssessmentsPage /> },
      { path: ROUTES.student.assessmentDetail, element: <StudentAssessmentDetailPage /> },
      { path: ROUTES.student.anamnesis, element: <StudentMyAnamnesisPage /> },
      { path: ROUTES.student.anamnesisDetail, element: <StudentAnamnesisFillPage /> },
      {
        path: ROUTES.student.chat,
        element: <ChatPage selfRole="student" counterpartName="Trainer Wood" />,
      },
      { path: ROUTES.student.billing, element: <BillingPage /> },
    ],
  },
  {
    // Shell próprio do personal: ele carrega o badge global de não lidas (ver TrainerShell).
    element: <TrainerShell />,
    children: [
      { path: ROUTES.trainer.dashboard, element: <PersonalDashboardPage /> },
      { path: ROUTES.trainer.students, element: <StudentsListPage /> },
      { path: ROUTES.trainer.studentDetail, element: <StudentDetailPage /> },
      { path: ROUTES.trainer.studentAssessments, element: <StudentAssessmentsPage /> },
      { path: ROUTES.trainer.newAssessment, element: <NewPhysicalAssessmentPage /> },
      { path: ROUTES.trainer.viewAssessment, element: <NewPhysicalAssessmentPage /> },
      { path: ROUTES.trainer.studentAnamnesis, element: <StudentAnamnesisListPage /> },
      { path: ROUTES.trainer.anamnesisDetail, element: <TrainerAnamnesisPage /> },
      { path: ROUTES.trainer.library, element: <ExerciseLibraryPage /> },
      { path: ROUTES.trainer.newWorkout, element: <WorkoutBuilderPage /> },
      { path: ROUTES.trainer.studentWorkoutBuilder, element: <WorkoutBuilderPage /> },
      { path: ROUTES.trainer.chat, element: <TrainerInboxPage /> },
    ],
  },
  { path: '*', element: <Navigate to={ROUTES.login} replace /> },
])
