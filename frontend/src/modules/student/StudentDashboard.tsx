/**
 * /student — dashboard do aluno logado.
 *
 * Lista turmas em que está matriculado e, clicando, mostra as atribuições
 * (trilha/aula interativa/atividade).
 *
 * Na Fase 6 só trilha e atividade ficam com placeholder "abre na Fase 7";
 * aula interativa já tem preview funcional desde a Fase 2.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { SlideShell } from '../lab/components/SlideShell'
import { apiJson } from '../lab/runtime/apiFetch'
import type { AssignmentExpanded, Classroom } from '../teacher/types'

export function StudentDashboard() {
  const { user, token, logout, loading } = useAuth()
  if (loading) return <SlideShell>carregando…</SlideShell>
  if (!user || !token) return <Navigate to="/student/join" replace />
  if (user.role !== 'student') {
    // Teacher caiu aqui por engano — manda de volta ao painel deles.
    return <Navigate to="/teacher" replace />
  }
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
  const [classrooms, setClassrooms] = useState<Classroom[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    apiJson<Classroom[]>('/api/student/classrooms', { token })
      .then(setClassrooms)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [token])
  useEffect(load, [load])

  return (
    <SlideShell>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-lab-xl)', margin: 0 }}>Minhas turmas</h1>
          <p style={{ color: '#555B66', marginTop: 4 }}>
            Olá, <strong>{displayName}</strong>.{' '}
            <Link to="/student/join" style={{ color: 'var(--color-lab-accent)' }}>
              entrar em outra turma
            </Link>
          </p>
        </div>
        <button onClick={onLogout} style={linkBtn}>
          sair
        </button>
      </header>

      {err && (
        <div
          style={{
            padding: '10px 12px',
            background: '#FAECE7',
            color: '#993C1D',
            borderRadius: 8,
            fontFamily: 'var(--font-lab-mono)',
          }}
        >
          {err}
        </div>
      )}
      {classrooms === null && <div style={{ color: '#555B66', marginTop: 20 }}>carregando…</div>}
      {classrooms && classrooms.length === 0 && (
        <div style={{ color: '#555B66', marginTop: 20 }}>
          você ainda não está em nenhuma turma —{' '}
          <Link to="/student/join" style={{ color: 'var(--color-lab-accent)' }}>
            entre com um código
          </Link>
        </div>
      )}
      <ul style={list}>
        {(classrooms ?? []).map((c) => (
          <li key={c.id} style={card}>
            <button
              type="button"
              onClick={() => setExpanded((cur) => (cur === c.id ? null : c.id))}
              style={{ ...unbutton, width: '100%', textAlign: 'left' }}
            >
              <div style={{ fontSize: 'var(--text-lab-md)', fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: '#555B66', fontFamily: 'var(--font-lab-mono)' }}>
                {expanded === c.id ? '▾ fechar' : '▸ abrir atribuições'}
              </div>
            </button>
            {expanded === c.id && <AssignmentsPanel classroomId={c.id} token={token} />}
          </li>
        ))}
      </ul>
    </SlideShell>
  )
}

function AssignmentsPanel({ classroomId, token }: { classroomId: string; token: string }) {
  const [items, setItems] = useState<AssignmentExpanded[] | null>(null)
  useEffect(() => {
    apiJson<AssignmentExpanded[]>(`/api/student/classrooms/${classroomId}/assignments`, { token })
      .then(setItems)
      .catch(() => setItems([]))
  }, [classroomId, token])

  if (items === null) {
    return <div style={{ ...small, marginTop: 10 }}>carregando…</div>
  }
  if (items.length === 0) {
    return <div style={{ ...small, marginTop: 10 }}>nenhuma atribuição ainda.</div>
  }
  return (
    <ul style={{ ...list, marginTop: 12 }}>
      {items.map((ae) => {
        const m = contentMeta(ae)
        return (
          <li key={ae.assignment.id} style={itemRow}>
            <span style={{ ...kindBadge, background: m.bg, color: m.fg }}>{m.label}</span>
            <span style={{ flex: 1, fontWeight: 500 }}>{m.title}</span>
            {m.href ? (
              <Link to={m.href} style={{ ...small, color: 'var(--color-lab-accent)', textDecoration: 'none' }}>
                abrir →
              </Link>
            ) : (
              <span style={{ ...small, fontStyle: 'italic' }}>{m.placeholder}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function contentMeta(ae: AssignmentExpanded): {
  label: string
  title: string
  bg: string
  fg: string
  href: string | null
  placeholder?: string
} {
  if (ae.activity) {
    return {
      label: 'atividade',
      title: ae.activity.title,
      bg: '#E6F1FB',
      fg: '#0C447C',
      href: `/student/activity/${encodeURIComponent(ae.activity.id)}`,
    }
  }
  if (ae.trail) {
    return {
      label: 'trilha',
      title: ae.trail.title,
      bg: '#E1F5EE',
      fg: '#085041',
      href: `/student/trail/${encodeURIComponent(ae.trail.id)}`,
    }
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
  return { label: '?', title: '(apagado)', bg: '#F1EFE8', fg: '#555B66', href: null }
}

// ── estilos ─────────────────────────────────────────────────────────────
const list: React.CSSProperties = { listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 8 }
const card: React.CSSProperties = {
  background: '#FFFEF9',
  border: '1px solid var(--color-lab-rule)',
  borderRadius: 12,
  padding: 14,
}
const itemRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  border: '1px solid var(--color-lab-rule)',
  borderRadius: 8,
  background: '#FFF',
}
const kindBadge: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-lab-mono)',
  padding: '2px 8px',
  borderRadius: 4,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  flexShrink: 0,
}
const small: React.CSSProperties = {
  fontSize: 12,
  color: '#555B66',
  fontFamily: 'var(--font-lab-mono)',
}
const unbutton: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
}
const linkBtn: React.CSSProperties = {
  ...unbutton,
  color: 'var(--color-lab-accent)',
  fontSize: 14,
  textDecoration: 'underline',
}
