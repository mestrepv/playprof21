/**
 * App — router raiz do labprof21.
 *
 *   /                      → lista de aulas (public, preview)
 *   /lab/preview/:slug     → preview de uma aula
 *   /login, /register      → auth do professor
 *   /teacher               → dashboard CRUD (require teacher)
 *
 * Fase 4 pluga /lab/session/:id (runtime ao vivo).
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import './modules/lab/styles/tokens.css'
import './modules/lab/styles/helpers.css'
import { AuthProvider } from './modules/auth/AuthContext'
import { LoginPage } from './modules/auth/LoginPage'
import { RegisterPage } from './modules/auth/RegisterPage'
import { IndexPage } from './modules/lab/preview/IndexPage'
import { PreviewPage } from './modules/lab/preview/PreviewPage'
import { LibraryPage } from './modules/teacher/LibraryPage'
import { TeacherPage } from './modules/teacher/TeacherPage'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IndexPage />} />
          <Route path="/lab/preview/:slug" element={<PreviewPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/teacher" element={<TeacherPage />} />
          <Route path="/teacher/library" element={<LibraryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
