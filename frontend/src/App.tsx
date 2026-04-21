/**
 * App — router raiz do labprof21.
 *
 * Fase 2 só tem duas rotas úteis:
 *   /                        → lista de aulas (IndexPage)
 *   /lab/preview/:slug       → preview de uma aula (PreviewPage)
 *
 * Fase 4 pluga /lab/session/:id (runtime ao vivo mestre↔alunos).
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import './modules/lab/styles/tokens.css'
import './modules/lab/styles/helpers.css'
import { IndexPage } from './modules/lab/preview/IndexPage'
import { PreviewPage } from './modules/lab/preview/PreviewPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/lab/preview/:slug" element={<PreviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
