import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { AppShell } from '../../components/ui/AppShell'
import { useAuth } from '../auth/AuthContext'
import { apiJson } from '../lesson/runtime/apiFetch'
import { SLIDE_REGISTRY } from '../lesson/registry'
import type { GameEnvelope, Slide, SlideType } from '../lesson/types/manifest'

interface SlideFile {
  filename: string   // ex: 01-capa.md
  slide: Slide
}

// ── página ────────────────────────────────────────────────────────────────

export function LessonEditorPage() {
  const { user, token, loading } = useAuth()
  const { slug } = useParams<{ slug: string }>()

  if (loading) return <AppShell>carregando…</AppShell>
  if (!user || !token || user.role !== 'teacher') return <Navigate to="/login" replace />
  if (!slug) return <Navigate to="/teacher/library" replace />

  return <Editor slug={slug} token={token} />
}

// ── editor ────────────────────────────────────────────────────────────────

function Editor({ slug, token }: { slug: string; token: string }) {
  const [slides, setSlides] = useState<SlideFile[] | null>(null)
  const [gameTitle, setGameTitle] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showNewSlide, setShowNewSlide] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ game: GameEnvelope; errors: string[] }>(
        `/api/lesson/games/${encodeURIComponent(slug)}`,
        { token }
      )
      const game = data.game
      setGameTitle(game.title)
      const files: SlideFile[] = game.manifest.slides.map((s) => ({
        filename: `${s.id}.md`,
        slide: s,
      }))
      setSlides(files)
      if (files.length > 0 && !selected) {
        setSelected(files[0].filename)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [slug, token])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selected || !slides) return
    const found = slides.find((s) => s.filename === selected)
    if (!found) return
    const s = found.slide
    setContent(buildYaml(s))
    setError(null)
    setSuccess(false)
  }, [selected, slides])

  const save = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await apiJson(`/api/lesson/games/${encodeURIComponent(slug)}/${encodeURIComponent(selected)}`, {
        token,
        method: 'PUT',
        json: { content },
      })
      setSuccess(true)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const deleteSlide = async (filename: string) => {
    if (!confirm(`Apagar ${filename}?`)) return
    try {
      await apiJson(`/api/lesson/games/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}`, {
        token,
        method: 'DELETE',
      })
      if (selected === filename) setSelected(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <AppShell>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/teacher/library" style={{ color: 'var(--p21-ink-3)', textDecoration: 'none', fontSize: 14 }}>
            ← Biblioteca
          </Link>
          <span style={{ color: 'var(--p21-border-strong)' }}>|</span>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'var(--p21-font-display)' }}>
            {gameTitle || slug}
          </h1>
          <span style={slugBadge}>{slug}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={`/lesson/preview/${encodeURIComponent(slug)}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...actionBtn, color: 'var(--p21-ink-2)', textDecoration: 'none' }}
          >
            preview ↗
          </a>
          <button
            onClick={save}
            disabled={saving || !selected}
            style={{ ...actionBtn, background: 'var(--p21-primary)', color: '#fff', borderColor: 'var(--p21-primary)' }}
          >
            {saving ? 'salvando…' : 'salvar'}
          </button>
        </div>
      </div>

      {error && <div style={errorBar}>{error}</div>}
      {success && <div style={successBar}>slide salvo com sucesso</div>}

      <div style={editorLayout}>
        {/* Lista de slides */}
        <aside style={sidebarStyle}>
          <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--p21-border)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--p21-ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              slides ({slides?.length ?? '…'})
            </span>
            <button onClick={() => setShowNewSlide((v) => !v)} style={newSlideBtn}>+ novo</button>
          </div>

          {showNewSlide && (
            <NewSlidePanel
              slug={slug}
              token={token}
              existingCount={slides?.length ?? 0}
              onCreated={async (filename) => {
                setShowNewSlide(false)
                await load()
                setSelected(filename)
              }}
            />
          )}

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {slides === null && <div style={emptyMsg}>carregando…</div>}
            {slides !== null && slides.length === 0 && (
              <div style={emptyMsg}>nenhum slide ainda — crie o primeiro!</div>
            )}
            {slides?.map((sf) => {
              const def = SLIDE_REGISTRY[sf.slide.type as SlideType]
              return (
                <div
                  key={sf.filename}
                  onClick={() => setSelected(sf.filename)}
                  style={{
                    ...slideRowStyle,
                    background: selected === sf.filename ? 'var(--p21-bg)' : 'transparent',
                    borderLeft: selected === sf.filename ? '3px solid var(--p21-primary)' : '3px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{def?.icon ?? '?'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {sf.slide.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--p21-ink-3)', fontFamily: 'var(--p21-font-mono)' }}>
                      {sf.filename}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSlide(sf.filename) }}
                    style={{ ...deleteBtn }}
                    title="apagar slide"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </aside>

        {/* Editor de conteúdo */}
        <main style={mainStyle}>
          {!selected ? (
            <div style={{ color: 'var(--p21-ink-3)', padding: 32, textAlign: 'center' }}>
              selecione um slide na lista para editar
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--p21-ink-3)', padding: '0 4px' }}>
                editando: <strong style={{ fontFamily: 'var(--p21-font-mono)' }}>{selected}</strong>
                {' · '}formato: YAML frontmatter + body markdown
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => { setContent(e.target.value); setSuccess(false) }}
                spellCheck={false}
                style={textareaStyle}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault()
                    save()
                  }
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--p21-ink-3)', padding: '0 4px' }}>
                Ctrl+S para salvar · o backend valida antes de gravar
              </div>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  )
}

// ── Painel "novo slide" ───────────────────────────────────────────────────

const SLIDE_TEMPLATES: Record<SlideType, string> = {
  text: `---\ntype: text\nlabel: "Novo slide"\nnotesForMaster: ""\n---\n\nConteúdo em **markdown** aqui.\n`,
  video: `---\ntype: video\nlabel: "Vídeo"\nsrc: "https://www.youtube.com/watch?v=XXXXXXXXXXX"\n---\n`,
  quiz: `---\ntype: quiz\nlabel: "Quiz"\nquestionId: "q-001"\nstem: "Qual é a resposta correta?"\noptions:\n  - "Opção A"\n  - "Opção B"\n  - "Opção C"\ncorrectIndex: 0\n---\n`,
  'quiz-image': `---\ntype: quiz-image\nlabel: "Quiz com imagem"\nquestionId: "qi-001"\nstem: "O que você vê na imagem?"\nimage: "./images/exemplo.png"\noptions:\n  - "Opção A"\n  - "Opção B"\ncorrectIndex: 0\n---\n`,
  'quiz-fill': `---\ntype: quiz-fill\nlabel: "Complete a lacuna"\nquestionId: "qf-001"\nstem: "A fórmula da energia em repouso é E = ___"\nanswer: "mc²"\nacceptedAnswers:\n  - "mc^2"\nhint: "Einstein"\n---\n`,
  mission: `---\ntype: mission\nlabel: "Missão"\nmissionId: "atlas.reconhecimento"\ninteractionMode: free\n---\n`,
  phet: `---\ntype: phet\nlabel: "Simulação PhET"\nsimUrl: "https://phet.colorado.edu/sims/html/faradays-law/latest/faradays-law_pt_BR.html"\nheight: 560\n---\n`,
  geogebra: `---\ntype: geogebra\nlabel: "GeoGebra"\nmaterialId: "ekgypreh"\nheight: 500\nshowToolbar: false\n---\n`,
  custom: `---\ntype: custom\nlabel: "Customizado"\ncomponentId: "meu-componente"\n---\n`,
}

function NewSlidePanel({
  slug,
  token,
  existingCount,
  onCreated,
}: {
  slug: string
  token: string
  existingCount: number
  onCreated: (filename: string) => void
}) {
  const [type, setType] = useState<SlideType>('text')
  const [filename, setFilename] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const defaultFilename = `${String(existingCount + 1).padStart(2, '0')}-novo.md`

  const create = async () => {
    const fname = (filename.trim() || defaultFilename).replace(/\.md$/, '') + '.md'
    const template = SLIDE_TEMPLATES[type]
    setBusy(true)
    setErr(null)
    try {
      await apiJson(`/api/lesson/games/${encodeURIComponent(slug)}/${encodeURIComponent(fname)}`, {
        token,
        method: 'PUT',
        json: { content: template },
      })
      onCreated(fname)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const categories: Array<[string, SlideType[]]> = [
    ['Conteúdo', ['text', 'video']],
    ['Quiz', ['quiz', 'quiz-image', 'quiz-fill']],
    ['Interativo', ['phet', 'geogebra', 'mission']],
  ]

  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--p21-border)', background: 'var(--p21-bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {err && <div style={{ color: 'var(--p21-coral)', fontSize: 12 }}>{err}</div>}

      {categories.map(([cat, types]) => (
        <div key={cat}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--p21-ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{cat}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {types.map((t) => {
              const def = SLIDE_REGISTRY[t]
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1.5px solid',
                    borderColor: type === t ? 'var(--p21-primary)' : 'var(--p21-border-strong)',
                    background: type === t ? 'rgba(47,110,0,0.08)' : 'var(--p21-surface)',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {def?.icon} {def?.displayName ?? t}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <input
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
        placeholder={defaultFilename}
        style={{ padding: '5px 8px', border: '1px solid var(--p21-border-strong)', borderRadius: 6, fontSize: 12, fontFamily: 'var(--p21-font-mono)' }}
      />
      <button
        onClick={create}
        disabled={busy}
        style={{ ...actionBtn, background: 'var(--p21-primary)', color: '#fff', borderColor: 'var(--p21-primary)', fontSize: 12 }}
      >
        {busy ? 'criando…' : 'criar slide'}
      </button>
    </div>
  )
}

// ── Helper: gera YAML editável a partir de um slide ───────────────────────

function buildYaml(slide: Slide): string {
  const { id: _id, ...rest } = slide as unknown as Record<string, unknown>
  const lines: string[] = ['---']

  const order = ['type', 'label', 'notesForMaster']
  const done = new Set(order)

  for (const key of order) {
    if (key in rest) lines.push(serializeField(key, rest[key]))
  }

  for (const [key, val] of Object.entries(rest)) {
    if (!done.has(key)) lines.push(serializeField(key, val))
  }

  lines.push('---')

  if (slide.type === 'text' && typeof (slide as { body?: string }).body === 'string') {
    lines.push('')
    lines.push((slide as { body: string }).body)
  }

  return lines.join('\n')
}

function serializeField(key: string, val: unknown): string {
  if (typeof val === 'string') {
    if (val.includes('\n')) return `${key}: |\n${val.split('\n').map((l) => `  ${l}`).join('\n')}`
    return `${key}: "${val.replace(/"/g, '\\"')}"`
  }
  if (typeof val === 'number' || typeof val === 'boolean') return `${key}: ${val}`
  if (Array.isArray(val)) {
    const items = val.map((v) =>
      typeof v === 'string' ? `  - "${v}"` : `  - ${JSON.stringify(v)}`
    )
    return `${key}:\n${items.join('\n')}`
  }
  return `${key}: ${JSON.stringify(val)}`
}

// ── Estilos ───────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--p21-sp-3) 0',
  borderBottom: '1px solid var(--p21-border)',
  marginBottom: 'var(--p21-sp-3)',
  gap: 12,
  flexWrap: 'wrap',
}

const slugBadge: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--p21-font-mono)',
  background: 'var(--p21-bg)',
  border: '1px solid var(--p21-border)',
  borderRadius: 4,
  padding: '2px 6px',
  color: 'var(--p21-ink-3)',
}

const actionBtn: React.CSSProperties = {
  padding: '7px 16px',
  borderRadius: 8,
  border: '1.5px solid var(--p21-border-strong)',
  background: 'var(--p21-surface)',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const errorBar: React.CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(212,71,74,0.08)',
  border: '1px solid var(--p21-coral)',
  borderRadius: 8,
  color: 'var(--p21-coral)',
  fontSize: 13,
  marginBottom: 8,
}

const successBar: React.CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(22,163,74,0.08)',
  border: '1px solid #16a34a',
  borderRadius: 8,
  color: '#16a34a',
  fontSize: 13,
  marginBottom: 8,
}

const editorLayout: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  height: 'calc(100vh - 140px)',
  border: '1px solid var(--p21-border)',
  borderRadius: 'var(--p21-radius-md)',
  overflow: 'hidden',
}

const sidebarStyle: React.CSSProperties = {
  width: 220,
  flexShrink: 0,
  borderRight: '1px solid var(--p21-border)',
  background: 'var(--p21-surface)',
  display: 'flex',
  flexDirection: 'column',
}

const mainStyle: React.CSSProperties = {
  flex: 1,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--p21-bg)',
  minWidth: 0,
}

const textareaStyle: React.CSSProperties = {
  flex: 1,
  fontFamily: 'var(--p21-font-mono)',
  fontSize: 13,
  lineHeight: 1.6,
  padding: 12,
  border: '1px solid var(--p21-border-strong)',
  borderRadius: 8,
  resize: 'none',
  background: 'var(--p21-surface)',
  color: 'var(--p21-ink)',
  outline: 'none',
}

const slideRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  cursor: 'pointer',
  borderBottom: '1px solid var(--p21-border)',
  transition: 'background 0.1s',
}

const newSlideBtn: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 8px',
  border: '1.5px solid var(--p21-primary)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--p21-primary)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const deleteBtn: React.CSSProperties = {
  width: 20,
  height: 20,
  border: 'none',
  background: 'transparent',
  color: 'var(--p21-ink-3)',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
  flexShrink: 0,
  borderRadius: 4,
}

const emptyMsg: React.CSSProperties = {
  padding: 16,
  fontSize: 12,
  color: 'var(--p21-ink-3)',
  textAlign: 'center',
}
