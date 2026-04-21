/**
 * /student — dashboard do aluno com duas tabs:
 *
 *   Trilhas  →  árvore vertical de trilhas (estilo Duolingo stacked).
 *               Cada trilha é UM nó; dentro da trilha as atividades são
 *               executadas linearmente (ver TrailPage). Estrelas agregam
 *               a performance das atividades da trilha.
 *               Desbloqueio sequencial por turma: próxima trilha só abre
 *               quando a anterior foi completada (todas atividades
 *               tentadas, com qualquer score).
 *
 *   Aulas    →  aulas interativas atribuídas às turmas do aluno. Cada
 *               card tem link pro preview; aula ao vivo entra por código
 *               separado em /lab/join.
 */

import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { SlideShell } from '../lab/components/SlideShell'
import { apiJson } from '../lab/runtime/apiFetch'
import type { StudentInteractiveLessonItem, TrailStatus, TrailSummary } from './types'

type Tab = 'trails' | 'lessons'

export function StudentDashboard() {
  const { user, token, logout, loading } = useAuth()
  if (loading) return <SlideShell>carregando…</SlideShell>
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

  return (
    <SlideShell>
      <header style={headerRow}>
        <div>
          <h1 style={{ fontSize: 'var(--text-lab-xl)', margin: 0 }}>Olá, {displayName}</h1>
          <p style={{ color: '#555B66', marginTop: 4 }}>
            <Link to="/student/join" style={{ color: 'var(--color-lab-accent)' }}>
              entrar em outra turma
            </Link>
          </p>
        </div>
        <button onClick={onLogout} style={linkBtn}>
          sair
        </button>
      </header>

      {err && <div style={errBox}>{err}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <TabBtn active={tab === 'trails'} onClick={() => setTab('trails')}>
          Trilhas
          {trails && trails.length > 0 && <span style={badgeCount}>{trails.length}</span>}
        </TabBtn>
        <TabBtn active={tab === 'lessons'} onClick={() => setTab('lessons')}>
          Aulas
          {lessons && lessons.length > 0 && <span style={badgeCount}>{lessons.length}</span>}
        </TabBtn>
      </div>

      {tab === 'trails' && <TrailsTab trails={trails} />}
      {tab === 'lessons' && <LessonsTab lessons={lessons} />}
    </SlideShell>
  )
}

// ── Tab Trilhas — árvore sequencial ────────────────────────────────────────

function TrailsTab({ trails }: { trails: TrailSummary[] | null }) {
  if (trails === null) return <div style={muted}>carregando…</div>
  if (trails.length === 0) {
    return (
      <div style={muted}>
        sem trilhas atribuídas ainda. Peça pro seu professor atribuir uma trilha à turma.
      </div>
    )
  }

  // Agrupa por turma mantendo a ordem de position; cada turma vira uma "ilha"
  // de trilhas sequenciais. Ao dar aula em múltiplas turmas é o que faz sentido.
  const groups = new Map<string, { name: string; items: TrailSummary[] }>()
  for (const t of trails) {
    if (!groups.has(t.classroom_id)) groups.set(t.classroom_id, { name: t.classroom_name, items: [] })
    groups.get(t.classroom_id)!.items.push(t)
  }

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {[...groups.entries()].map(([cid, { name, items }]) => (
        <section key={cid}>
          <h2 style={sectionTitle}>{name}</h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, maxWidth: 560 }}>
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
    <div
      style={{
        display: 'flex',
        gap: 14,
        padding: '16px 18px',
        borderRadius: 14,
        border: `2px solid ${palette.border}`,
        background: palette.bg,
        color: locked ? '#8C93A1' : 'inherit',
        alignItems: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          display: 'grid',
          placeItems: 'center',
          background: completed ? '#0F6E56' : palette.border,
          color: '#FFF',
          fontWeight: 700,
          fontFamily: 'var(--font-lab-mono)',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {completed ? '✓' : locked ? '🔒' : displayIndex}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 'var(--text-lab-md)' }}>{trail.title}</div>
        <div style={{ fontSize: 12, color: '#555B66', fontFamily: 'var(--font-lab-mono)' }}>
          {activities_attempted}/{activities_total} atividade{activities_total === 1 ? '' : 's'}
          {trail.description && ` · ${trail.description}`}
        </div>
      </div>
      <Stars n={stars} faded={!completed} />
      {!locked && !completed && <Chip bg="#EEEDFE" fg="#3C3489">continuar →</Chip>}
      {completed && <Chip bg="#E1F5EE" fg="#085041">revisitar</Chip>}
      {locked && <Chip bg="#F1EFE8" fg="#888780">bloqueada</Chip>}
    </div>
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

function Stars({ n, faded = false }: { n: number; faded?: boolean }) {
  return (
    <div aria-label={`${n} estrela${n === 1 ? '' : 's'}`} style={{ fontSize: 18, letterSpacing: 2, flexShrink: 0 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ color: i < n ? '#E8A53A' : faded ? '#D8D5CB' : '#D8D5CB' }}>
          ★
        </span>
      ))}
    </div>
  )
}

function Chip({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '4px 8px',
        borderRadius: 6,
        fontFamily: 'var(--font-lab-mono)',
        background: bg,
        color: fg,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}

// ── Tab Aulas ─────────────────────────────────────────────────────────────

function LessonsTab({ lessons }: { lessons: StudentInteractiveLessonItem[] | null }) {
  if (lessons === null) return <div style={muted}>carregando…</div>
  if (lessons.length === 0) {
    return <div style={muted}>sem aulas interativas atribuídas ainda.</div>
  }

  const groups = new Map<string, { name: string; items: StudentInteractiveLessonItem[] }>()
  for (const l of lessons) {
    if (!groups.has(l.classroom_id)) groups.set(l.classroom_id, { name: l.classroom_name, items: [] })
    groups.get(l.classroom_id)!.items.push(l)
  }

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {[...groups.entries()].map(([cid, { name, items }]) => (
        <section key={cid}>
          <h2 style={sectionTitle}>{name}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, maxWidth: 560 }}>
            {items.map((x) => (
              <li key={x.interactive_lesson.id}>
                <Link
                  to={`/lab/preview/${encodeURIComponent(x.interactive_lesson.slug)}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: '#FFFEF9',
                    border: '1px solid var(--color-lab-rule)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 20 }} aria-hidden>
                    🎬
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{x.interactive_lesson.title}</div>
                    <div style={{ fontSize: 12, color: '#555B66', fontFamily: 'var(--font-lab-mono)' }}>
                      aula interativa · <code>{x.interactive_lesson.slug}</code>
                    </div>
                  </div>
                  <Chip bg="#EEEDFE" fg="#3C3489">abrir →</Chip>
                </Link>
              </li>
            ))}
          </ul>
          <div style={{ ...muted, fontSize: 12, marginTop: 8 }}>
            Aula ao vivo? O professor mostra um código — abra{' '}
            <Link to="/lab/join" style={{ color: 'var(--color-lab-accent)' }}>
              entrar na aula ao vivo
            </Link>
            .
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Helpers visuais ───────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--color-lab-accent)' : 'var(--color-lab-rule)'}`,
        background: active ? '#EEEDFE' : '#FFF',
        color: active ? 'var(--color-lab-accent)' : 'inherit',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {children}
    </button>
  )
}

const STATUS_COLORS: Record<TrailStatus, { bg: string; border: string }> = {
  completed: { bg: '#F4FBF8', border: '#0F6E56' },
  available: { bg: '#FFFEF9', border: 'var(--color-lab-accent)' },
  locked: { bg: '#F5F5F0', border: '#D8D5CB' },
}

const headerRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 12,
  marginBottom: 18,
  flexWrap: 'wrap',
}
const sectionTitle: React.CSSProperties = {
  fontSize: 'var(--text-lab-md)',
  margin: '0 0 10px',
  color: '#2A2D33',
}
const muted: React.CSSProperties = {
  color: '#555B66',
  fontFamily: 'var(--font-lab-mono)',
  fontSize: 14,
  marginTop: 20,
}
const errBox: React.CSSProperties = {
  padding: '10px 12px',
  background: '#FAECE7',
  color: '#993C1D',
  borderRadius: 8,
  fontFamily: 'var(--font-lab-mono)',
  marginBottom: 14,
}
const linkBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--color-lab-accent)',
  fontSize: 14,
  textDecoration: 'underline',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const badgeCount: React.CSSProperties = {
  fontSize: 11,
  padding: '1px 6px',
  borderRadius: 10,
  background: '#FFF',
  border: '1px solid currentColor',
  fontFamily: 'var(--font-lab-mono)',
}
