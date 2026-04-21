/**
 * TeacherPage — dashboard do professor.
 *
 * Seleção cascata: turma → trilha → coleção → aula. Cada coluna lista +
 * cria + deleta, sem UI polida. Aulas têm link direto pro preview da Fase 2.
 *
 * State shape intencionalmente simples: quatro listas e três IDs selecionados.
 * Refetch a lista correspondente quando o parent selecionado muda. Se virar
 * gargalo, trocamos por react-query ou SWR.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { SlideShell } from '../lab/components/SlideShell'
import { apiJson } from '../lab/runtime/apiFetch'
import type { Classroom, Collection, Lesson, Track } from './types'

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
  const [tracks, setTracks] = useState<Track[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selClassroom, setSelClassroom] = useState<string | null>(null)
  const [selTrack, setSelTrack] = useState<string | null>(null)
  const [selCollection, setSelCollection] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const reportErr = (e: unknown) => setErr(e instanceof Error ? e.message : String(e))

  const loadClassrooms = useCallback(async () => {
    try {
      setClassrooms(await apiJson<Classroom[]>('/api/classrooms', { token }))
    } catch (e) {
      reportErr(e)
    }
  }, [token])

  useEffect(() => {
    loadClassrooms()
  }, [loadClassrooms])

  useEffect(() => {
    if (!selClassroom) return setTracks([])
    apiJson<Track[]>(`/api/tracks?classroom_id=${selClassroom}`, { token }).then(setTracks).catch(reportErr)
  }, [selClassroom, token])

  useEffect(() => {
    if (!selTrack) return setCollections([])
    apiJson<Collection[]>(`/api/collections?track_id=${selTrack}`, { token })
      .then(setCollections)
      .catch(reportErr)
  }, [selTrack, token])

  useEffect(() => {
    if (!selCollection) return setLessons([])
    apiJson<Lesson[]>(`/api/lessons?collection_id=${selCollection}`, { token }).then(setLessons).catch(reportErr)
  }, [selCollection, token])

  const createClassroom = async (name: string) => {
    try {
      const c = await apiJson<Classroom>('/api/classrooms', { token, method: 'POST', json: { name } })
      setClassrooms((prev) => [c, ...prev])
      setSelClassroom(c.id)
    } catch (e) {
      reportErr(e)
    }
  }
  const deleteClassroom = async (id: string) => {
    if (!confirm('Deletar turma e tudo dentro dela?')) return
    try {
      await apiJson<void>(`/api/classrooms/${id}`, { token, method: 'DELETE' })
      setClassrooms((prev) => prev.filter((c) => c.id !== id))
      if (selClassroom === id) {
        setSelClassroom(null)
        setSelTrack(null)
        setSelCollection(null)
      }
    } catch (e) {
      reportErr(e)
    }
  }

  const createTrack = async (name: string) => {
    if (!selClassroom) return
    try {
      const t = await apiJson<Track>('/api/tracks', {
        token,
        method: 'POST',
        json: { classroom_id: selClassroom, name, order: tracks.length },
      })
      setTracks((prev) => [...prev, t])
      setSelTrack(t.id)
    } catch (e) {
      reportErr(e)
    }
  }
  const deleteTrack = async (id: string) => {
    if (!confirm('Deletar trilha e tudo dentro dela?')) return
    try {
      await apiJson<void>(`/api/tracks/${id}`, { token, method: 'DELETE' })
      setTracks((prev) => prev.filter((t) => t.id !== id))
      if (selTrack === id) {
        setSelTrack(null)
        setSelCollection(null)
      }
    } catch (e) {
      reportErr(e)
    }
  }

  const createCollection = async (name: string) => {
    if (!selTrack) return
    try {
      const c = await apiJson<Collection>('/api/collections', {
        token,
        method: 'POST',
        json: { track_id: selTrack, name, order: collections.length },
      })
      setCollections((prev) => [...prev, c])
      setSelCollection(c.id)
    } catch (e) {
      reportErr(e)
    }
  }
  const deleteCollection = async (id: string) => {
    if (!confirm('Deletar coleção e tudo dentro dela?')) return
    try {
      await apiJson<void>(`/api/collections/${id}`, { token, method: 'DELETE' })
      setCollections((prev) => prev.filter((c) => c.id !== id))
      if (selCollection === id) setSelCollection(null)
    } catch (e) {
      reportErr(e)
    }
  }

  const createLesson = async (slug: string, title: string) => {
    if (!selCollection) return
    try {
      const l = await apiJson<Lesson>('/api/lessons', {
        token,
        method: 'POST',
        json: {
          collection_id: selCollection,
          slug: slug.trim(),
          title: title.trim() || null,
          order: lessons.length,
        },
      })
      setLessons((prev) => [...prev, l])
    } catch (e) {
      reportErr(e)
    }
  }
  const deleteLesson = async (id: string) => {
    if (!confirm('Deletar aula?')) return
    try {
      await apiJson<void>(`/api/lessons/${id}`, { token, method: 'DELETE' })
      setLessons((prev) => prev.filter((l) => l.id !== id))
    } catch (e) {
      reportErr(e)
    }
  }

  return (
    <Shell>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--spacing-lab-4)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-lab-xl)', margin: 0 }}>Painel do professor</h1>
          <p style={{ color: '#555B66', marginTop: 4 }}>
            Olá, <strong>{displayName}</strong>.{' '}
            <Link to="/" style={{ color: 'var(--color-lab-accent)' }}>
              preview de conteúdo
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
            fontFamily: 'var(--font-lab-mono, monospace)',
            marginBottom: 'var(--spacing-lab-4)',
          }}
        >
          {err} <button onClick={() => setErr(null)} style={{ ...linkBtn, color: '#993C1D' }}>(ok)</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Column
          title="Turmas"
          items={classrooms.map((c) => ({ id: c.id, primary: c.name, secondary: `${c.id.slice(0, 8)}…` }))}
          selected={selClassroom}
          onSelect={(id) => {
            setSelClassroom(id)
            setSelTrack(null)
            setSelCollection(null)
          }}
          onDelete={deleteClassroom}
          onCreate={createClassroom}
          createLabel="Nova turma"
        />
        <Column
          title="Trilhas"
          disabled={!selClassroom}
          items={tracks.map((t) => ({ id: t.id, primary: t.name, secondary: `ordem ${t.order}` }))}
          selected={selTrack}
          onSelect={(id) => {
            setSelTrack(id)
            setSelCollection(null)
          }}
          onDelete={deleteTrack}
          onCreate={createTrack}
          createLabel="Nova trilha"
        />
        <Column
          title="Coleções"
          disabled={!selTrack}
          items={collections.map((c) => ({ id: c.id, primary: c.name, secondary: `ordem ${c.order}` }))}
          selected={selCollection}
          onSelect={setSelCollection}
          onDelete={deleteCollection}
          onCreate={createCollection}
          createLabel="Nova coleção"
        />
        <LessonColumn
          disabled={!selCollection}
          lessons={lessons}
          onDelete={deleteLesson}
          onCreate={createLesson}
        />
      </div>
    </Shell>
  )
}

// ── Coluna genérica com input só-de-nome ─────────────────────────────────

interface Item {
  id: string
  primary: string
  secondary: string
}

function Column({
  title,
  disabled = false,
  items,
  selected,
  onSelect,
  onDelete,
  onCreate,
  createLabel,
}: {
  title: string
  disabled?: boolean
  items: Item[]
  selected: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onCreate: (name: string) => void
  createLabel: string
}) {
  const [name, setName] = useState('')
  return (
    <section style={{ ...columnStyle, opacity: disabled ? 0.45 : 1 }}>
      <h2 style={colTitle}>{title}</h2>
      <ul style={list}>
        {items.map((it) => (
          <li key={it.id} style={selected === it.id ? selectedItem : itemStyle}>
            <button
              type="button"
              onClick={() => onSelect(it.id)}
              style={{ ...unbutton, flex: 1, textAlign: 'left' }}
              disabled={disabled}
            >
              <div style={{ fontWeight: 500 }}>{it.primary}</div>
              <div style={{ fontSize: 12, color: '#555B66', fontFamily: 'var(--font-lab-mono)' }}>{it.secondary}</div>
            </button>
            <button onClick={() => onDelete(it.id)} style={dangerBtn} disabled={disabled} aria-label="deletar">
              ×
            </button>
          </li>
        ))}
        {items.length === 0 && <li style={emptyStyle}>vazio</li>}
      </ul>
      {!disabled && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            onCreate(name.trim())
            setName('')
          }}
          style={{ display: 'flex', gap: 6, marginTop: 10 }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nome"
            style={{ ...inputSmall, flex: 1 }}
          />
          <button type="submit" style={smallPrimary}>
            +
          </button>
        </form>
      )}
      {disabled && <div style={{ fontSize: 12, color: '#888' }}>{createLabel} — selecione {title === 'Trilhas' ? 'turma' : title === 'Coleções' ? 'trilha' : '…'}</div>}
    </section>
  )
}

// ── Coluna de lessons: input duplo (slug + título) + link pro preview ────

function LessonColumn({
  disabled,
  lessons,
  onDelete,
  onCreate,
}: {
  disabled: boolean
  lessons: Lesson[]
  onDelete: (id: string) => void
  onCreate: (slug: string, title: string) => void
}) {
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')

  return (
    <section style={{ ...columnStyle, opacity: disabled ? 0.45 : 1 }}>
      <h2 style={colTitle}>Aulas</h2>
      <ul style={list}>
        {lessons.map((l) => (
          <li key={l.id} style={itemStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{l.title ?? l.slug}</div>
              <div style={{ fontSize: 12, color: '#555B66', fontFamily: 'var(--font-lab-mono)' }}>
                <code>{l.slug}</code> · ordem {l.order}
              </div>
              <Link
                to={`/lab/preview/${encodeURIComponent(l.slug)}`}
                style={{ fontSize: 12, color: 'var(--color-lab-accent)' }}
              >
                abrir preview →
              </Link>
            </div>
            <button onClick={() => onDelete(l.id)} style={dangerBtn} aria-label="deletar">
              ×
            </button>
          </li>
        ))}
        {lessons.length === 0 && <li style={emptyStyle}>vazio</li>}
      </ul>
      {!disabled && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!slug.trim()) return
            onCreate(slug.trim(), title.trim())
            setSlug('')
            setTitle('')
          }}
          style={{ display: 'grid', gap: 6, marginTop: 10 }}
        >
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug (ex.: seminario-tese)"
            style={inputSmall}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="título (opcional)"
              style={{ ...inputSmall, flex: 1 }}
            />
            <button type="submit" style={smallPrimary}>
              +
            </button>
          </div>
        </form>
      )}
      {disabled && <div style={{ fontSize: 12, color: '#888' }}>selecione uma coleção</div>}
    </section>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return <SlideShell>{children}</SlideShell>
}

// ── estilos ────────────────────────────────────────────────────────────────
const columnStyle: React.CSSProperties = {
  background: '#FFFEF9',
  border: '1px solid var(--color-lab-rule, #D8D5CB)',
  borderRadius: 12,
  padding: 14,
}
const colTitle: React.CSSProperties = { fontSize: 'var(--text-lab-md)', margin: '0 0 10px' }
const list: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }
const itemStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  padding: '8px 10px',
  border: '1px solid var(--color-lab-rule, #D8D5CB)',
  borderRadius: 8,
  background: '#FFF',
}
const selectedItem: React.CSSProperties = { ...itemStyle, borderColor: 'var(--color-lab-accent)', background: '#EEEDFE' }
const emptyStyle: React.CSSProperties = {
  padding: '8px 10px',
  color: '#888',
  fontSize: 13,
  fontStyle: 'italic',
}
const inputSmall: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--color-lab-rule, #D8D5CB)',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'inherit',
}
const smallPrimary: React.CSSProperties = {
  padding: '0 12px',
  borderRadius: 6,
  border: 'none',
  background: 'var(--color-lab-accent)',
  color: '#FFF',
  fontSize: 18,
  fontWeight: 500,
  cursor: 'pointer',
}
const dangerBtn: React.CSSProperties = {
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
