/**
 * LibraryPage — banco de conteúdos do professor.
 *
 * Três abas: Atividades · Trilhas · Aulas Interativas. Cada aba tem list + create.
 *
 * Edição rica de Activity (quiz builder) fica pra Fase 5+ — aqui quiz se cria
 * com título + opções separadas por `|` e index da correta. Suficiente pra
 * smoke + pipeline; depois a gente poliu.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { PageShell } from '../../components/ui/PageShell'
import { useAuth } from '../auth/AuthContext'
import { apiJson } from '../lab/runtime/apiFetch'
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_LABEL,
  type Activity,
  type ActivityKind,
  type InteractiveLesson,
  type Trail,
} from './types'

// Estilos locais (movidos do TeacherPage antigo que foi refatorado).
const classCard: React.CSSProperties = {
  background: 'var(--p21-surface)',
  border: '1px solid var(--p21-border)',
  borderRadius: 'var(--p21-radius-md)',
  padding: 14,
}
const dangerBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 14,
  border: 'none',
  background: 'transparent',
  color: 'var(--p21-coral-ink)',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  flexShrink: 0,
}
const headerRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 'var(--p21-sp-4)',
  flexWrap: 'wrap',
  gap: 12,
}
const inputSmall: React.CSSProperties = {
  padding: '10px 12px',
  border: '2px solid var(--p21-border-strong)',
  borderRadius: 'var(--p21-radius-sm)',
  fontSize: 16,
  fontFamily: 'inherit',
  background: 'var(--p21-surface)',
  minHeight: 44,
}
const kindBadge: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--p21-font-mono)',
  padding: '2px 8px',
  borderRadius: 4,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  flexShrink: 0,
}
const link: React.CSSProperties = { color: 'var(--p21-blue)' }
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
  color: 'var(--p21-blue)',
  fontSize: 14,
  textDecoration: 'underline',
}
const list: React.CSSProperties = { listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 10 }
const small: React.CSSProperties = {
  fontSize: 'var(--p21-text-xs)',
  color: 'var(--p21-ink-3)',
  fontFamily: 'var(--p21-font-mono)',
}
const smallPrimary: React.CSSProperties = {
  padding: '0 14px',
  borderRadius: 'var(--p21-radius-sm)',
  border: 'none',
  background: 'var(--p21-primary)',
  color: '#FFF',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: 40,
}

type Tab = 'activities' | 'trails' | 'lessons'

export function LibraryPage() {
  const { user, token, logout, loading } = useAuth()
  if (loading) return <PageShell>carregando…</PageShell>
  if (!user || !token) return <Navigate to="/login?next=/teacher/library" replace />
  return <Library token={token} displayName={user.display_name} onLogout={logout} />
}

function Library({ token, displayName, onLogout }: { token: string; displayName: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('activities')
  const [err, setErr] = useState<string | null>(null)

  const right = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-2)' }}>{displayName}</span>
      <Button as="a" href="/teacher" variant="outline" size="sm">
        turmas
      </Button>
      <Button variant="ghost" size="sm" onClick={onLogout}>
        sair
      </Button>
    </div>
  )

  return (
    <PageShell headerRight={right}>
      <h1 style={{ fontSize: 'var(--p21-text-xl)', margin: '0 0 var(--p21-sp-5)' }}>Banco de conteúdos</h1>

      {err && <ErrorBanner msg={err} onClose={() => setErr(null)} />}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TabBtn active={tab === 'activities'} onClick={() => setTab('activities')}>
          Atividades
        </TabBtn>
        <TabBtn active={tab === 'trails'} onClick={() => setTab('trails')}>
          Trilhas
        </TabBtn>
        <TabBtn active={tab === 'lessons'} onClick={() => setTab('lessons')}>
          Aulas interativas
        </TabBtn>
      </div>

      {tab === 'activities' && <ActivitiesTab token={token} onError={setErr} />}
      {tab === 'trails' && <TrailsTab token={token} onError={setErr} />}
      {tab === 'lessons' && <LessonsTab token={token} onError={setErr} />}
    </PageShell>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--color-lab-accent)' : 'var(--color-lab-rule, #D8D5CB)'}`,
        background: active ? '#EEEDFE' : '#FFF',
        color: active ? 'var(--color-lab-accent)' : 'inherit',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
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

// ═════════════════════════════════════════════════════════════════════════
// Activities
// ═════════════════════════════════════════════════════════════════════════

function ActivitiesTab({ token, onError }: { token: string; onError: (e: string) => void }) {
  const [items, setItems] = useState<Activity[]>([])
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ActivityKind>('quiz')
  const [quizStem, setQuizStem] = useState('')
  const [quizOptions, setQuizOptions] = useState('')
  const [quizCorrect, setQuizCorrect] = useState(0)
  const [linkUrl, setLinkUrl] = useState('')
  const [maxScore, setMaxScore] = useState(10)

  const report = (e: unknown) => onError(e instanceof Error ? e.message : String(e))

  const load = useCallback(() => {
    apiJson<Activity[]>('/api/activities', { token }).then(setItems).catch(report)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  useEffect(load, [load])

  const submit = async () => {
    if (!title.trim()) return
    let config: Record<string, unknown> = {}
    if (kind === 'quiz') {
      const opts = quizOptions
        .split('|')
        .map((o) => o.trim())
        .filter(Boolean)
      if (opts.length < 2) {
        onError('Quiz precisa de pelo menos 2 opções separadas por |')
        return
      }
      config = { stem: quizStem.trim(), options: opts, correctIndex: quizCorrect }
    } else if (kind === 'external-link') {
      config = { url: linkUrl.trim() }
    }
    try {
      const a = await apiJson<Activity>('/api/activities', {
        token,
        method: 'POST',
        json: { title: title.trim(), kind, config, max_score: maxScore },
      })
      setItems((prev) => [a, ...prev])
      setTitle('')
      setQuizStem('')
      setQuizOptions('')
      setQuizCorrect(0)
      setLinkUrl('')
    } catch (e) {
      report(e)
    }
  }

  const del = async (id: string) => {
    if (!confirm('Deletar atividade? Remove também das trilhas e atribuições.')) return
    try {
      await apiJson<void>(`/api/activities/${id}`, { token, method: 'DELETE' })
      setItems((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      report(e)
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        style={formCard}
      >
        <div style={formRow}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="título" style={{ ...inputSmall, flex: 1 }} required />
          <select value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)} style={inputSmall}>
            {ACTIVITY_KINDS.map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={1000}
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
            style={{ ...inputSmall, width: 88 }}
            title="Pontos máximos"
          />
        </div>
        {kind === 'quiz' && (
          <div style={formRow}>
            <input value={quizStem} onChange={(e) => setQuizStem(e.target.value)} placeholder="enunciado" style={{ ...inputSmall, flex: 1 }} />
            <input
              value={quizOptions}
              onChange={(e) => setQuizOptions(e.target.value)}
              placeholder="opções separadas por |"
              style={{ ...inputSmall, flex: 2 }}
            />
            <input
              type="number"
              min={0}
              value={quizCorrect}
              onChange={(e) => setQuizCorrect(Number(e.target.value))}
              style={{ ...inputSmall, width: 80 }}
              title="Index da correta (0-based)"
            />
          </div>
        )}
        {kind === 'external-link' && (
          <div style={formRow}>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="URL (ex.: https://planckgo.example/quantum)"
              style={{ ...inputSmall, flex: 1 }}
            />
          </div>
        )}
        {(kind === 'simulator' || kind === 'animation') && (
          <div style={{ ...small, marginTop: 8 }}>
            kind stub — editor específico chega em fases futuras; por ora o config fica vazio.
          </div>
        )}
        <button type="submit" style={{ ...smallPrimary, alignSelf: 'flex-start', padding: '8px 14px', fontSize: 14 }}>
          criar atividade
        </button>
      </form>

      <ul style={list}>
        {items.map((a) => (
          <li key={a.id} style={classCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...kindBadge, background: '#E6F1FB', color: '#0C447C' }}>{a.kind}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{a.title}</span>
              <span style={small}>{a.max_score} pts</span>
              <button onClick={() => del(a.id)} style={dangerBtn}>
                ×
              </button>
            </div>
            {Object.keys(a.config).length > 0 && (
              <pre
                style={{
                  ...small,
                  marginTop: 8,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: '#F5F5F0',
                  padding: '6px 8px',
                  borderRadius: 4,
                  maxHeight: 120,
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(a.config, null, 2)}
              </pre>
            )}
          </li>
        ))}
        {items.length === 0 && <li style={{ ...small, padding: 10 }}>nenhuma atividade ainda</li>}
      </ul>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Trails
// ═════════════════════════════════════════════════════════════════════════

function TrailsTab({ token, onError }: { token: string; onError: (e: string) => void }) {
  const [items, setItems] = useState<Trail[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const report = (e: unknown) => onError(e instanceof Error ? e.message : String(e))

  const load = useCallback(() => {
    apiJson<Trail[]>('/api/trails', { token }).then(setItems).catch(report)
    apiJson<Activity[]>('/api/activities', { token }).then(setActivities).catch(report)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  useEffect(load, [load])

  const create = async (title: string) => {
    try {
      const t = await apiJson<Trail>('/api/trails', { token, method: 'POST', json: { title } })
      setItems((prev) => [t, ...prev])
    } catch (e) {
      report(e)
    }
  }
  const del = async (id: string) => {
    if (!confirm('Deletar trilha? Activities continuam no banco.')) return
    try {
      await apiJson<void>(`/api/trails/${id}`, { token, method: 'DELETE' })
      setItems((prev) => prev.filter((t) => t.id !== id))
    } catch (e) {
      report(e)
    }
  }

  return (
    <div>
      <InlineCreate placeholder="nome da trilha" onSubmit={create} />
      <ul style={list}>
        {items.map((t) => (
          <li key={t.id} style={classCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => setExpanded((cur) => (cur === t.id ? null : t.id))}
                style={{ ...unbutton, flex: 1, textAlign: 'left' }}
              >
                <div style={{ fontWeight: 500 }}>{t.title}</div>
                {t.description && <div style={small}>{t.description}</div>}
              </button>
              <button onClick={() => del(t.id)} style={dangerBtn}>
                ×
              </button>
            </div>
            {expanded === t.id && <TrailActivitiesEditor trail={t} bank={activities} token={token} onError={onError} />}
          </li>
        ))}
        {items.length === 0 && <li style={{ ...small, padding: 10 }}>nenhuma trilha ainda</li>}
      </ul>
    </div>
  )
}

function TrailActivitiesEditor({
  trail,
  bank,
  token,
  onError,
}: {
  trail: Trail
  bank: Activity[]
  token: string
  onError: (e: string) => void
}) {
  const [items, setItems] = useState<Activity[]>([])
  const [sel, setSel] = useState('')
  const report = (e: unknown) => onError(e instanceof Error ? e.message : String(e))

  const load = useCallback(() => {
    apiJson<Activity[]>(`/api/trails/${trail.id}/activities`, { token }).then(setItems).catch(report)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail.id, token])
  useEffect(load, [load])

  const attach = async () => {
    if (!sel) return
    try {
      await apiJson<unknown>(`/api/trails/${trail.id}/activities`, {
        token,
        method: 'POST',
        json: { activity_id: sel, position: items.length },
      })
      setSel('')
      load()
    } catch (e) {
      report(e)
    }
  }

  const detach = async (aid: string) => {
    try {
      await apiJson<void>(`/api/trails/${trail.id}/activities/${aid}`, { token, method: 'DELETE' })
      setItems((prev) => prev.filter((x) => x.id !== aid))
    } catch (e) {
      report(e)
    }
  }

  const move = async (aid: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === aid)
    if (idx < 0) return
    const swap = idx + dir
    if (swap < 0 || swap >= items.length) return
    const order = items.map((i) => i.id)
    ;[order[idx], order[swap]] = [order[swap], order[idx]]
    try {
      const updated = await apiJson<Activity[]>(`/api/trails/${trail.id}/order`, {
        token,
        method: 'PUT',
        json: order,
      })
      setItems(updated)
    } catch (e) {
      report(e)
    }
  }

  const existingIds = new Set(items.map((a) => a.id))
  const choices = bank.filter((a) => !existingIds.has(a.id))

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--color-lab-rule)' }}>
      <ol style={{ listStyle: 'decimal inside', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {items.map((a, i) => (
          <li key={a.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ flex: 1 }}>{a.title}</span>
            <span style={{ ...kindBadge, background: '#F1EFE8', color: '#555B66' }}>{a.kind}</span>
            <button onClick={() => move(a.id, -1)} disabled={i === 0} style={iconBtn} aria-label="subir">
              ↑
            </button>
            <button onClick={() => move(a.id, 1)} disabled={i === items.length - 1} style={iconBtn} aria-label="descer">
              ↓
            </button>
            <button onClick={() => detach(a.id)} style={dangerBtn}>
              ×
            </button>
          </li>
        ))}
        {items.length === 0 && <li style={small}>trilha vazia</li>}
      </ol>
      {choices.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ ...inputSmall, flex: 1 }}>
            <option value="">— adicionar do banco —</option>
            {choices.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.kind}] {a.title}
              </option>
            ))}
          </select>
          <button onClick={attach} disabled={!sel} style={smallPrimary}>
            +
          </button>
        </div>
      )}
      {choices.length === 0 && bank.length > 0 && (
        <div style={{ ...small, marginTop: 8 }}>todas suas activities já estão nessa trilha</div>
      )}
      {bank.length === 0 && (
        <div style={{ ...small, marginTop: 8 }}>
          seu banco de activities está vazio — crie na aba "Atividades".
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Interactive Lessons
// ═════════════════════════════════════════════════════════════════════════

function LessonsTab({ token, onError }: { token: string; onError: (e: string) => void }) {
  const [items, setItems] = useState<InteractiveLesson[]>([])
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const report = (e: unknown) => onError(e instanceof Error ? e.message : String(e))

  const load = useCallback(() => {
    apiJson<InteractiveLesson[]>('/api/interactive-lessons', { token }).then(setItems).catch(report)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  useEffect(load, [load])

  const create = async () => {
    if (!title.trim() || !slug.trim()) return
    try {
      const il = await apiJson<InteractiveLesson>('/api/interactive-lessons', {
        token,
        method: 'POST',
        json: { title: title.trim(), slug: slug.trim() },
      })
      setItems((prev) => [il, ...prev])
      setTitle('')
      setSlug('')
    } catch (e) {
      report(e)
    }
  }
  const del = async (id: string) => {
    if (!confirm('Deletar aula interativa? O conteúdo em disco não é afetado.')) return
    try {
      await apiJson<void>(`/api/interactive-lessons/${id}`, { token, method: 'DELETE' })
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      report(e)
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
        style={{ display: 'grid', gap: 6, marginTop: 'var(--spacing-lab-4)', maxWidth: 640 }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="título" style={inputSmall} required />
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug (ex.: seminario-tese, atlas-v1)"
            style={{ ...inputSmall, flex: 1 }}
            required
          />
          <button type="submit" style={smallPrimary}>
            +
          </button>
        </div>
        <div style={small}>slug tem que existir em <code>backend/modules/lab/games_content/</code></div>
      </form>

      <ul style={list}>
        {items.map((il) => (
          <li key={il.id} style={classCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...kindBadge, background: '#EEEDFE', color: '#3C3489' }}>aula interativa</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{il.title}</span>
              <Link to={`/lab/preview/${encodeURIComponent(il.slug)}`} style={{ ...small, color: 'var(--color-lab-accent)', textDecoration: 'none' }}>
                preview →
              </Link>
              <button onClick={() => del(il.id)} style={dangerBtn}>
                ×
              </button>
            </div>
            <div style={small}>
              slug: <code>{il.slug}</code>
            </div>
          </li>
        ))}
        {items.length === 0 && <li style={{ ...small, padding: 10 }}>nenhuma aula interativa ainda</li>}
      </ul>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Pequenos helpers
// ═════════════════════════════════════════════════════════════════════════

function InlineCreate({ placeholder, onSubmit }: { placeholder: string; onSubmit: (v: string) => void }) {
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
        +
      </button>
    </form>
  )
}

const formCard: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 14,
  border: '1px solid var(--color-lab-rule, #D8D5CB)',
  borderRadius: 12,
  background: '#FFFEF9',
  marginTop: 'var(--spacing-lab-4)',
}
const formRow: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' }
const iconBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 4,
  border: '1px solid var(--color-lab-rule, #D8D5CB)',
  background: '#FFF',
  cursor: 'pointer',
  fontSize: 13,
}
