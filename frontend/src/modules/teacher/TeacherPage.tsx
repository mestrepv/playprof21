/**
 * TeacherPage — lista de turmas do professor.
 *
 * Cada turma expande pra mostrar suas atribuições (AssignmentExpanded). Trails,
 * Activities e InteractiveLessons vivem no banco (/teacher/library); aqui só se
 * cria/remove o link banco→turma.
 *
 * Atribuir exige que o professor já tenha conteúdo no banco — se o banco estiver
 * vazio, mostra CTA pra /teacher/library.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { SlideShell } from '../lab/components/SlideShell'
import { apiJson } from '../lab/runtime/apiFetch'
import { CodeOverlay } from '../live/CodeOverlay'
import type {
  Activity,
  AssignmentExpanded,
  Classroom,
  ContentType,
  InteractiveLesson,
  Trail,
} from './types'

export function TeacherPage() {
  const { user, token, logout, loading } = useAuth()
  if (loading) return <Shell>carregando…</Shell>
  if (!user || !token) return <Navigate to="/login?next=/teacher" replace />
  return <Dashboard token={token} displayName={user.display_name} onLogout={logout} />
}

function Dashboard({
  token,
  displayName,
  onLogout,
}: {
  token: string
  displayName: string
  onLogout: () => void
}) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [codeModalFor, setCodeModalFor] = useState<Classroom | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const reportErr = (e: unknown) => setErr(e instanceof Error ? e.message : String(e))

  const loadClassrooms = useCallback(() => {
    apiJson<Classroom[]>('/api/classrooms', { token }).then(setClassrooms).catch(reportErr)
  }, [token])

  useEffect(loadClassrooms, [loadClassrooms])

  const createClassroom = async (name: string) => {
    try {
      const c = await apiJson<Classroom>('/api/classrooms', { token, method: 'POST', json: { name } })
      setClassrooms((prev) => [c, ...prev])
      setExpanded(c.id)
    } catch (e) {
      reportErr(e)
    }
  }
  const deleteClassroom = async (id: string) => {
    if (!confirm('Deletar turma e todas as atribuições? Conteúdo do banco fica intacto.')) return
    try {
      await apiJson<void>(`/api/classrooms/${id}`, { token, method: 'DELETE' })
      setClassrooms((prev) => prev.filter((c) => c.id !== id))
      if (expanded === id) setExpanded(null)
    } catch (e) {
      reportErr(e)
    }
  }

  return (
    <Shell>
      <header style={headerRow}>
        <div>
          <h1 style={{ fontSize: 'var(--text-lab-xl)', margin: 0 }}>Turmas</h1>
          <p style={{ color: '#555B66', marginTop: 4 }}>
            Olá, <strong>{displayName}</strong>.{' '}
            <Link to="/teacher/library" style={link}>
              ir pro banco de conteúdos →
            </Link>
            {' · '}
            <Link to="/" style={link}>
              preview
            </Link>
          </p>
        </div>
        <button onClick={onLogout} style={linkBtn}>
          sair
        </button>
      </header>

      {err && <ErrorBanner msg={err} onClose={() => setErr(null)} />}

      <InlineCreate placeholder="Nome da turma (ex.: 3A 2026)" onSubmit={createClassroom} />

      {classrooms.length === 0 && (
        <div style={{ color: '#555B66', marginTop: 20 }}>nenhuma turma ainda — crie acima.</div>
      )}

      <ul style={list}>
        {classrooms.map((c) => (
          <li key={c.id} style={classCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <button
                type="button"
                onClick={() => setExpanded((cur) => (cur === c.id ? null : c.id))}
                style={{ ...unbutton, flex: 1, textAlign: 'left' }}
              >
                <div style={{ fontSize: 'var(--text-lab-md)', fontWeight: 500 }}>{c.name}</div>
                <div style={small}>
                  {expanded === c.id ? '▾ fechar' : '▸ abrir atribuições'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setCodeModalFor(c)}
                style={{
                  ...small,
                  border: '1px solid var(--color-lab-accent)',
                  color: 'var(--color-lab-accent)',
                  background: '#FFF',
                  padding: '4px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                title="mostrar código + QR da turma pros alunos entrarem"
              >
                {c.code ? `código ${c.code}` : 'código'}
              </button>
              <button onClick={() => deleteClassroom(c.id)} style={dangerBtn} aria-label="deletar">
                ×
              </button>
            </div>
            {expanded === c.id && (
              <AssignmentsPanel classroomId={c.id} token={token} onError={reportErr} />
            )}
          </li>
        ))}
      </ul>
      {codeModalFor && (
        <CodeOverlay
          caption={`código da turma ${codeModalFor.name}`}
          joinPathBase="/student/join"
          rotatePath={`/api/classrooms/${codeModalFor.id}/code/rotate`}
          initialCode={codeModalFor.code}
          token={token}
          onClose={() => {
            setCodeModalFor(null)
            loadClassrooms()
          }}
        />
      )}
    </Shell>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Painel de assignments dentro de uma turma expandida
// ═════════════════════════════════════════════════════════════════════════

function AssignmentsPanel({
  classroomId,
  token,
  onError,
}: {
  classroomId: string
  token: string
  onError: (e: unknown) => void
}) {
  const navigate = useNavigate()
  const startLive = async (interactiveLessonId: string) => {
    try {
      const s = await apiJson<{ id: string }>('/api/lab/sessions', {
        token,
        method: 'POST',
        json: { interactive_lesson_id: interactiveLessonId },
      })
      navigate(`/lab/session/${s.id}?role=master`)
    } catch (e) {
      onError(e)
    }
  }
  const [items, setItems] = useState<AssignmentExpanded[]>([])
  const [bank, setBank] = useState<{ activities: Activity[]; trails: Trail[]; lessons: InteractiveLesson[] } | null>(
    null,
  )

  const load = useCallback(() => {
    apiJson<AssignmentExpanded[]>(`/api/classrooms/${classroomId}/assignments`, { token })
      .then(setItems)
      .catch(onError)
  }, [classroomId, token, onError])

  useEffect(load, [load])

  // Banco (3 listas paralelas) — carrega ao expandir.
  useEffect(() => {
    Promise.all([
      apiJson<Activity[]>('/api/activities', { token }),
      apiJson<Trail[]>('/api/trails', { token }),
      apiJson<InteractiveLesson[]>('/api/interactive-lessons', { token }),
    ])
      .then(([activities, trails, lessons]) => setBank({ activities, trails, lessons }))
      .catch(onError)
  }, [token, onError])

  const attach = async (content_type: ContentType, content_id: string) => {
    try {
      await apiJson<unknown>(`/api/classrooms/${classroomId}/assignments`, {
        token,
        method: 'POST',
        json: { content_type, content_id, position: items.length },
      })
      load()
    } catch (e) {
      onError(e)
    }
  }

  const detach = async (assignmentId: string) => {
    try {
      await apiJson<void>(`/api/assignments/${assignmentId}`, { token, method: 'DELETE' })
      setItems((prev) => prev.filter((x) => x.assignment.id !== assignmentId))
    } catch (e) {
      onError(e)
    }
  }

  const bankEmpty = bank !== null && bank.activities.length === 0 && bank.trails.length === 0 && bank.lessons.length === 0

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--color-lab-rule)' }}>
      <div style={{ fontSize: 13, color: '#555B66', marginBottom: 8 }}>Atribuições ({items.length})</div>
      {items.length === 0 && <div style={{ color: '#888', fontSize: 13, fontStyle: 'italic' }}>nenhuma ainda</div>}
      <ul style={list}>
        {items.map((ae) => {
          const meta = contentMeta(ae)
          return (
            <li key={ae.assignment.id} style={assignRow}>
              <span style={{ ...kindBadge, background: meta.bg, color: meta.fg }}>{meta.label}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{meta.title}</span>
              {ae.interactive_lesson && (
                <button
                  onClick={() => startLive(ae.interactive_lesson!.id)}
                  style={{
                    ...small,
                    border: '1px solid var(--color-lab-accent)',
                    color: 'var(--color-lab-accent)',
                    background: '#FFF',
                    padding: '4px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  title="criar sessão ao vivo e abrir como mestre"
                >
                  iniciar ao vivo ▶
                </button>
              )}
              {meta.href && (
                <Link to={meta.href} style={{ ...small, color: 'var(--color-lab-accent)', textDecoration: 'none' }}>
                  preview
                </Link>
              )}
              <button onClick={() => detach(ae.assignment.id)} style={dangerBtn} aria-label="remover atribuição">
                ×
              </button>
            </li>
          )
        })}
      </ul>

      {bank === null ? (
        <div style={{ ...small, marginTop: 10 }}>carregando banco…</div>
      ) : bankEmpty ? (
        <div style={{ ...small, marginTop: 10 }}>
          seu banco está vazio —{' '}
          <Link to="/teacher/library" style={link}>
            criar conteúdo
          </Link>
        </div>
      ) : (
        <AttachPicker bank={bank} existing={items} onAttach={attach} />
      )}
    </div>
  )
}

function contentMeta(ae: AssignmentExpanded): {
  label: string
  title: string
  bg: string
  fg: string
  href: string | null
} {
  if (ae.activity) {
    return {
      label: 'atividade',
      title: ae.activity.title,
      bg: '#E6F1FB',
      fg: '#0C447C',
      href: null,
    }
  }
  if (ae.trail) {
    return { label: 'trilha', title: ae.trail.title, bg: '#E1F5EE', fg: '#085041', href: null }
  }
  if (ae.interactive_lesson) {
    return {
      label: 'aula interativa',
      title: ae.interactive_lesson.title,
      bg: '#EEEDFE',
      fg: '#3C3489',
      href: `/lab/preview/${encodeURIComponent(ae.interactive_lesson.slug)}`,
    }
  }
  return { label: '?', title: '(conteúdo apagado)', bg: '#F1EFE8', fg: '#555B66', href: null }
}

function AttachPicker({
  bank,
  existing,
  onAttach,
}: {
  bank: { activities: Activity[]; trails: Trail[]; lessons: InteractiveLesson[] }
  existing: AssignmentExpanded[]
  onAttach: (t: ContentType, id: string) => void
}) {
  const alreadyAttached = new Set(existing.map((e) => `${e.assignment.content_type}:${e.assignment.content_id}`))
  const options: Array<{ type: ContentType; id: string; label: string; kind: string }> = [
    ...bank.trails.map((t) => ({ type: 'trail' as const, id: t.id, label: t.title, kind: 'trilha' })),
    ...bank.lessons.map((l) => ({ type: 'interactive_lesson' as const, id: l.id, label: l.title, kind: 'aula interativa' })),
    ...bank.activities.map((a) => ({ type: 'activity' as const, id: a.id, label: a.title, kind: 'atividade' })),
  ].filter((o) => !alreadyAttached.has(`${o.type}:${o.id}`))

  const [sel, setSel] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!sel) return
        const [type, id] = sel.split('|') as [ContentType, string]
        onAttach(type, id)
        setSel('')
      }}
      style={{ display: 'flex', gap: 6, marginTop: 10 }}
    >
      <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ ...inputSmall, flex: 1 }}>
        <option value="">— atribuir conteúdo do banco —</option>
        {options.map((o) => (
          <option key={`${o.type}|${o.id}`} value={`${o.type}|${o.id}`}>
            [{o.kind}] {o.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={!sel} style={smallPrimary}>
        +
      </button>
    </form>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Pequenos helpers de UI
// ═════════════════════════════════════════════════════════════════════════

function Shell({ children }: { children: ReactNode }) {
  return <SlideShell>{children}</SlideShell>
}

function ErrorBanner({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: '#FAECE7',
        color: '#993C1D',
        borderRadius: 8,
        fontFamily: 'var(--font-lab-mono)',
        marginBottom: 'var(--spacing-lab-4)',
      }}
    >
      {msg}{' '}
      <button onClick={onClose} style={{ ...linkBtn, color: '#993C1D' }}>
        (ok)
      </button>
    </div>
  )
}

export function InlineCreate({ placeholder, onSubmit, cta = '+' }: { placeholder: string; onSubmit: (v: string) => void; cta?: string }) {
  const [v, setV] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!v.trim()) return
        onSubmit(v.trim())
        setV('')
      }}
      style={{ display: 'flex', gap: 6, marginTop: 'var(--spacing-lab-4)', maxWidth: 520 }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} style={{ ...inputSmall, flex: 1 }} />
      <button type="submit" style={smallPrimary}>
        {cta}
      </button>
    </form>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// estilos — compartilhados também com LibraryPage
// ═════════════════════════════════════════════════════════════════════════

export const headerRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 'var(--spacing-lab-4)',
  flexWrap: 'wrap',
  gap: 12,
}
export const list: React.CSSProperties = { listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 8 }
export const classCard: React.CSSProperties = {
  background: '#FFFEF9',
  border: '1px solid var(--color-lab-rule, #D8D5CB)',
  borderRadius: 12,
  padding: 14,
}
export const assignRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  border: '1px solid var(--color-lab-rule, #D8D5CB)',
  borderRadius: 8,
  background: '#FFF',
}
export const kindBadge: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-lab-mono, monospace)',
  padding: '2px 8px',
  borderRadius: 4,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  flexShrink: 0,
}
export const small: React.CSSProperties = {
  fontSize: 12,
  color: '#555B66',
  fontFamily: 'var(--font-lab-mono, monospace)',
}
export const inputSmall: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--color-lab-rule, #D8D5CB)',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'inherit',
}
export const smallPrimary: React.CSSProperties = {
  padding: '0 14px',
  borderRadius: 6,
  border: 'none',
  background: 'var(--color-lab-accent)',
  color: '#FFF',
  fontSize: 16,
  fontWeight: 500,
  cursor: 'pointer',
}
export const dangerBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 12,
  border: 'none',
  background: 'transparent',
  color: '#993C1D',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  flexShrink: 0,
}
export const unbutton: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
}
export const link: React.CSSProperties = { color: 'var(--color-lab-accent)' }
export const linkBtn: React.CSSProperties = {
  ...unbutton,
  color: 'var(--color-lab-accent)',
  fontSize: 14,
  textDecoration: 'underline',
}
