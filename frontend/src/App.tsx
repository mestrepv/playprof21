/**
 * App — router raiz do labprof21.
 *
 *   /                      → lista de aulas (public, preview)
 *   /lesson/preview/:slug     → preview de uma aula
 *   /login, /register      → auth do professor
 *   /teacher               → dashboard CRUD (require teacher)
 *
 * Fase 4 pluga /lesson/session/:id (runtime ao vivo).
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import './styles/theme.css'
import './modules/lesson/styles/tokens.css'
import './modules/lesson/styles/helpers.css'
import { AuthProvider } from './modules/auth/AuthContext'
import { LoginPage } from './modules/auth/LoginPage'
import { RegisterPage } from './modules/auth/RegisterPage'
import { IndexPage } from './modules/lesson/preview/IndexPage'
import { PreviewPage } from './modules/lesson/preview/PreviewPage'
import { JoinPage } from './modules/live/JoinPage'
import { SessionPage } from './modules/live/SessionPage'
import { StudentDashboard } from './modules/student/StudentDashboard'
import { StudentJoinPage } from './modules/student/StudentJoinPage'
import { TrailPage } from './modules/student/TrailPage'
import { ProfilePage } from './modules/profile/ProfilePage'
import { SettingsPage } from './modules/settings/SettingsPage'
import { ClassroomPage } from './modules/teacher/ClassroomPage'
import { LessonEditorPage } from './modules/teacher/LessonEditorPage'
import { LibraryPage } from './modules/teacher/LibraryPage'
import { TeacherPage } from './modules/teacher/TeacherPage'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IndexPage />} />
          <Route path="/lesson/preview/:slug" element={<PreviewPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/teacher" element={<TeacherPage />} />
          <Route path="/teacher/classroom/:id" element={<ClassroomPage />} />
          <Route path="/teacher/library" element={<LibraryPage />} />
          <Route path="/teacher/editor/:slug" element={<LessonEditorPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/lesson/session/:sid" element={<SessionPage />} />
          <Route path="/lesson/join" element={<JoinPage />} />
          <Route path="/student/join" element={<StudentJoinPage />} />
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/trail/:id" element={<TrailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
