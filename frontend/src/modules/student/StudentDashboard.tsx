/**
 * /student — dashboard do aluno com duas tabs (Trilhas | Aulas).
 * Árvore Duolingo-like de trilhas, sequencial por turma.
 */

import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppShell } from '../../components/ui/AppShell'
import { useAuth } from '../auth/AuthContext'
import { apiJson } from '../lab/runtime/apiFetch'
import type { StudentInteractiveLessonItem, TrailStatus, TrailSummary } from './types'

type Tab = 'trails' | 'lessons'

export function StudentDashboard() {
  const { user, token, logout, loading } = useAuth()
  if (loading) return <AppShell>carregando…</AppShell>
  if (!user || !token) return <Navigate to="/student/join" replace />
  if (user.role !== 'student') return <Navigate to="/teacher" replace />
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
  const [tab, setTab] = useState<Tab>('trails')
  const [trails, setTrails] = useState<TrailSummary[] | null>(null)
  const [lessons, setLessons] = useState<StudentInteractiveLessonItem[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    apiJson<TrailSummary[]>('/api/student/trails', { token })
      .then(setTrails)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
    apiJson<StudentInteractiveLessonItem[]>('/api/student/interactive-lessons', { token })
      .then(setLessons)
      .catch(() => setLessons([]))
  }, [token])

  void onLogout

  return (
    <AppShell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--p21-sp-5)' }}>
        <h1 style={{ fontSize: 'var(--p21-text-xl)', margin: 0 }}>Oi, {displayName.split(' ')[0]}</h1>
        <Button as="a" href="/student/join" variant="outline" size="sm">
          outra turma
        </Button>
      </div>

      {err && (
        <div style={errBox}>
          {err}
        </div>
      )}

      <div role="tablist" style={tabRow}>
        <TabBtn active={tab === 'trails'} onClick={() => setTab('trails')} count={trails?.length}>
          Trilhas
        </TabBtn>
        <TabBtn active={tab === 'lessons'} onClick={() => setTab('lessons')} count={lessons?.length}>
          Aulas
        </TabBtn>
      </div>

      {tab === 'trails' && <TrailsTab trails={trails} />}
      {tab === 'lessons' && <LessonsTab lessons={lessons} />}
    </AppShell>
  )
}

// ── Tab Trilhas ────────────────────────────────────────────────────────────

function TrailsTab({ trails }: { trails: TrailSummary[] | null }) {
  if (trails === null) return <div style={muted}>carregando…</div>
  if (trails.length === 0) {
    return (
      <Card>
        <div style={{ color: 'var(--p21-ink-3)' }}>
          sem trilhas atribuídas ainda. Quando o professor atribuir, elas aparecem aqui.
        </div>
      </Card>
    )
  }

  const groups = new Map<string, { name: string; items: TrailSummary[] }>()
  for (const t of trails) {
    if (!groups.has(t.classroom_id)) groups.set(t.classroom_id, { name: t.classroom_name, items: [] })
    groups.get(t.classroom_id)!.items.push(t)
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--p21-sp-7)' }}>
      {[...groups.entries()].map(([cid, { name, items }]) => (
        <section key={cid}>
          <h2 style={sectionTitle}>{name}</h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--p21-sp-3)' }}>
            {items
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((t, i) => (
                <TrailTreeNode key={t.trail.id} summary={t} displayIndex={i + 1} />
              ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function TrailTreeNode({ summary, displayIndex }: { summary: TrailSummary; displayIndex: number }) {
  const { trail, status, stars, activities_attempted, activities_total } = summary
  const locked = status === 'locked'
  const completed = status === 'completed'
  const palette = STATUS_COLORS[status]

  const card = (
    <Card
      padded
      interactive={!locked}
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        borderColor: palette.border,
        background: palette.bg,
        opacity: locked ? 0.7 : 1,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: completed ? 'var(--p21-primary-ink)' : palette.badgeBg,
          color: '#FFF',
          fontWeight: 700,
          fontFamily: 'var(--p21-font-display)',
          fontSize: 20,
          flexShrink: 0,
          boxShadow: 'none',
        }}
      >
        {completed ? '✓' : locked ? '🔒' : displayIndex}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--p21-text-md)', color: 'var(--p21-ink)' }}>
          {trail.title}
        </div>
        <div
          style={{
            fontSize: 'var(--p21-text-xs)',
            color: 'var(--p21-ink-3)',
            fontFamily: 'var(--p21-font-mono)',
            marginTop: 2,
          }}
        >
          {activities_attempted}/{activities_total} atividade{activities_total === 1 ? '' : 's'}
        </div>
        {trail.description && (
          <div
            style={{ fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-3)', marginTop: 4 }}
          >
            {trail.description}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <Stars n={stars} />
        {!locked && !completed && <Chip tone="primary">continuar →</Chip>}
        {completed && <Chip tone="teal">revisitar</Chip>}
        {locked && <Chip tone="muted">bloqueada</Chip>}
      </div>
    </Card>
  )

  if (locked) return <li aria-disabled>{card}</li>
  return (
    <li>
      <Link to={`/student/trail/${encodeURIComponent(trail.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        {card}
      </Link>
    </li>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <div aria-label={`${n} estrelas`} style={{ letterSpacing: 1, fontSize: 18 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ color: i < n ? 'var(--p21-amber)' : 'var(--slate-300)' }}>
          ★
        </span>
      ))}
    </div>
  )
}

// ── Tab Aulas ─────────────────────────────────────────────────────────────

function LessonsTab({ lessons }: { lessons: StudentInteractiveLessonItem[] | null }) {
  if (lessons === null) return <div style={muted}>carregando…</div>
  if (lessons.length === 0) {
    return (
      <Card>
        <div style={{ color: 'var(--p21-ink-3)' }}>sem aulas interativas atribuídas ainda.</div>
      </Card>
    )
  }

  const groups = new Map<string, { name: string; items: StudentInteractiveLessonItem[] }>()
  for (const l of lessons) {
    if (!groups.has(l.classroom_id)) groups.set(l.classroom_id, { name: l.classroom_name, items: [] })
    groups.get(l.classroom_id)!.items.push(l)
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--p21-sp-7)' }}>
      {[...groups.entries()].map(([cid, { name, items }]) => (
        <section key={cid}>
          <h2 style={sectionTitle}>{name}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--p21-sp-3)' }}>
            {items.map((x) => (
              <li key={x.interactive_lesson.id}>
                <Link
                  to={`/lab/preview/${encodeURIComponent(x.interactive_lesson.slug)}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <Card interactive style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 24 }} aria-hidden>
                      🎬
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{x.interactive_lesson.title}</div>
                      <div
                        style={{
                          fontSize: 'var(--p21-text-xs)',
                          color: 'var(--p21-ink-3)',
                          fontFamily: 'var(--p21-font-mono)',
                        }}
                      >
                        aula interativa
                      </div>
                    </div>
                    <Chip tone="purple">abrir →</Chip>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Card>
        <div style={{ fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-3)' }}>
          Aula ao vivo em curso? Abra{' '}
          <Link to="/lab/join">entrar na sala ao vivo</Link> e digite o código que o professor mostrou.
        </div>
      </Card>
    </div>
  )
}

// ── UI helpers ────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count?: number
  children: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        flex: 1,
        minHeight: 'var(--p21-tap)',
        padding: '10px 16px',
        borderRadius: 'var(--p21-radius-md)',
        border: `2px solid ${active ? 'var(--p21-blue)' : 'var(--p21-border)'}`,
        background: active ? 'var(--p21-blue-soft)' : 'var(--p21-surface)',
        color: active ? 'var(--p21-blue-ink)' : 'var(--p21-ink-2)',
        fontWeight: active ? 600 : 500,
        fontFamily: 'inherit',
        fontSize: 'var(--p21-text-base)',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span
          style={{
            fontSize: 11,
            padding: '1px 7px',
            borderRadius: 999,
            background: active ? 'var(--p21-blue)' : 'var(--p21-border-strong)',
            color: '#FFF',
            fontFamily: 'var(--p21-font-mono)',
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function Chip({ tone, children }: { tone: 'primary' | 'teal' | 'purple' | 'muted'; children: React.ReactNode }) {
  const palettes = {
    primary: { bg: 'var(--p21-primary-soft)', fg: 'var(--p21-primary-ink)' },
    teal: { bg: 'var(--p21-primary-soft)', fg: 'var(--p21-primary-ink)' },
    purple: { bg: 'var(--p21-purple-soft)', fg: 'var(--p21-purple-ink)' },
    muted: { bg: 'var(--p21-surface-2)', fg: 'var(--p21-ink-3)' },
  }[tone]
  return (
    <span
      style={{
        fontSize: 11,
        padding: '4px 9px',
        borderRadius: 'var(--p21-radius-pill)',
        fontFamily: 'var(--p21-font-mono)',
        background: palettes.bg,
        color: palettes.fg,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// ── estilos ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TrailStatus, { bg: string; border: string; badgeBg: string }> = {
  completed: { bg: 'var(--p21-primary-soft)', border: 'var(--p21-primary-ink)', badgeBg: 'var(--p21-primary-ink)' },
  available: { bg: 'var(--p21-surface)', border: 'var(--p21-primary)', badgeBg: 'var(--p21-primary)' },
  locked: { bg: 'var(--p21-surface-2)', border: 'var(--p21-border)', badgeBg: 'var(--p21-border-strong)' },
}

const sectionTitle: React.CSSProperties = {
  fontSize: 'var(--p21-text-sm)',
  margin: '0 0 var(--p21-sp-3)',
  color: 'var(--p21-ink-3)',
  fontFamily: 'var(--p21-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  fontWeight: 600,
}
const muted: React.CSSProperties = {
  color: 'var(--p21-ink-3)',
  fontFamily: 'var(--p21-font-mono)',
  fontSize: 'var(--p21-text-sm)',
  marginTop: 20,
}
const tabRow: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--p21-sp-2)',
  marginBottom: 'var(--p21-sp-5)',
}
const errBox: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--p21-coral-soft)',
  color: 'var(--p21-coral-ink)',
  borderRadius: 'var(--p21-radius-md)',
  fontFamily: 'var(--p21-font-mono)',
  fontSize: 'var(--p21-text-sm)',
  marginBottom: 'var(--p21-sp-4)',
}
