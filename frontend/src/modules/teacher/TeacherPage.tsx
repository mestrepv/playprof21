import '../../styles/dashboard.css'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AppShell } from '../../components/ui/AppShell'
import { useAuth } from '../auth/AuthContext'
import { apiJson } from '../lesson/runtime/apiFetch'
import type { Classroom, Trail } from './types'

interface TeacherStats {
  classrooms: number
  activities: number
  trails: number
  students: number
}

const TURMA_COLORS = ['#378ADD', '#534AB7', '#D85A30', '#58cc02', '#ce82ff', '#ffc800', '#D4537E', '#3B6D11']

function classroomColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return TURMA_COLORS[h % TURMA_COLORS.length]
}

// ── página raiz ───────────────────────────────────────────────────────────

export function TeacherPage() {
  const { user, token, loading } = useAuth()
  if (loading) return <AppShell>carregando…</AppShell>
  if (!user || !token) return <Navigate to="/login?next=/teacher" replace />
  return <Dashboard token={token} />
}

// ── dashboard ─────────────────────────────────────────────────────────────

function Dashboard({ token }: { token: string }) {
  const navigate = useNavigate()
  const [classrooms, setClassrooms] = useState<Classroom[] | null>(null)
  const [trails, setTrails] = useState<Trail[] | null>(null)
  const [stats, setStats] = useState<TeacherStats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const createInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    apiJson<Classroom[]>('/api/classrooms', { token })
      .then(setClassrooms)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
    apiJson<Trail[]>('/api/trails', { token })
      .then(setTrails)
      .catch(() => {/* não bloqueia */})
    apiJson<TeacherStats>('/api/teacher/stats', { token })
      .then(setStats)
      .catch(() => {/* informativo, não bloqueia */})
  }, [token])

  useEffect(load, [load])

  useEffect(() => {
    if (showCreate) createInputRef.current?.focus()
  }, [showCreate])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    try {
      const c = await apiJson<Classroom>('/api/classrooms', {
        token,
        method: 'POST',
        json: { name: newName.trim() },
      })
      setClassrooms((prev) => [c, ...(prev ?? [])])
      setStats((prev) => prev ? { ...prev, classrooms: prev.classrooms + 1 } : prev)
      setNewName('')
      setShowCreate(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <div className="db-main-head db-anim1">
        <h1 className="db-main-title">Início</h1>
        <div className="db-main-actions">
          <button
            className="db-btn db-btn--secondary"
            onClick={() => setShowCreate((v) => !v)}
          >
            + Nova turma
          </button>
          <button
            className="db-btn db-btn--primary"
            onClick={() => navigate('/teacher/library#trilhas')}
          >
            + Nova trilha
          </button>
        </div>
      </div>

      {err && <div className="db-error">{err}</div>}

      <div className="db-stats db-anim2">
        <div className="db-stat-card">
          <span className="db-stat-val db-stat-val--blue">
            {stats?.classrooms ?? classrooms?.length ?? '—'}
          </span>
          <span className="db-stat-label">Turmas</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-val db-stat-val--purple">
            {stats?.activities ?? '—'}
          </span>
          <span className="db-stat-label">Atividades</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-val db-stat-val--green">
            {stats?.students ?? '—'}
          </span>
          <span className="db-stat-label">Alunos</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-val db-stat-val--amber">
            {stats?.trails ?? trails?.length ?? '—'}
          </span>
          <span className="db-stat-label">Trilhas</span>
        </div>
      </div>

      <div className="db-content db-anim3">
        {/* Minhas turmas */}
        <div className="db-section">
          <div className="db-section-head">
            <span className="db-section-title">Minhas turmas</span>
            <button
              className="db-section-link"
              onClick={() => setShowCreate((v) => !v)}
            >
              + Nova
            </button>
          </div>

          {showCreate && (
            <form className="db-create-form" onSubmit={create}>
              <input
                ref={createInputRef}
                className="db-create-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="nome da turma (ex: 2PGN)"
                maxLength={160}
              />
              <button
                type="submit"
                className="db-create-submit"
                disabled={busy || !newName.trim()}
              >
                criar
              </button>
            </form>
          )}

          <div className="db-turma-list">
            {classrooms === null && (
              <div className="db-empty">Carregando turmas…</div>
            )}
            {classrooms !== null && classrooms.length === 0 && (
              <div className="db-empty">Nenhuma turma ainda. Crie sua primeira!</div>
            )}
            {classrooms !== null && classrooms.map((c) => (
              <ClassroomRow key={c.id} classroom={c} />
            ))}
          </div>
        </div>

        {/* Trilhas recentes */}
        <div className="db-section">
          <div className="db-section-head">
            <span className="db-section-title">Trilhas recentes</span>
            <Link to="/teacher/library#trilhas" className="db-section-link">
              + Nova
            </Link>
          </div>

          <div className="db-miss-list">
            {trails === null && (
              <div className="db-empty">Carregando trilhas…</div>
            )}
            {trails !== null && trails.length === 0 && (
              <div className="db-empty">Nenhuma trilha ainda. Crie sua primeira!</div>
            )}
            {trails !== null && trails.slice(0, 10).map((t) => (
              <TrailRow key={t.id} trail={t} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

// ── componentes ───────────────────────────────────────────────────────────

function ClassroomRow({ classroom: c }: { classroom: Classroom }) {
  const color = classroomColor(c.id)
  return (
    <Link to={`/teacher/classroom/${c.id}`} className="db-turma-row">
      <div className="db-tc-dot" style={{ background: color }} />
      <div className="db-tc-body">
        <div className="db-tc-name">{c.name}</div>
        <div className="db-tc-meta">
          <span>abrir turma →</span>
        </div>
      </div>
      {c.code && <span className="db-tc-code">{c.code}</span>}
    </Link>
  )
}

function TrailRow({ trail: t }: { trail: Trail }) {
  return (
    <Link to="/teacher/library#trilhas" className="db-miss-row">
      <div className="db-miss-type db-miss-type--trail">☰</div>
      <div className="db-miss-info">
        <div className="db-miss-name">{t.title}</div>
        {t.description && (
          <div className="db-miss-detail">
            <span>{t.description}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
