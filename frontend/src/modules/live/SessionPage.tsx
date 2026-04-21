/**
 * SessionPage — runtime da aula síncrona.
 *
 * URL: /lab/session/:sid?role=master|player[&name=<display>]
 *
 * Master (teacher dono): abre logado; token JWT autentica + garante role.
 * Player (qualquer um): abre com ?role=player; usa anon_id persistido no
 * localStorage e pede nome. Quando a Fase 5 chegar, o aluno entrará por
 * código + QR — aqui vai continuar funcionando porque o backend aceita
 * tanto JWT quanto anon_id.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { SlideRenderer } from '../lab/components/SlideRenderer'
import { SlideShell } from '../lab/components/SlideShell'
import { apiJson } from '../lab/runtime/apiFetch'
import type { Slide } from '../lab/types/manifest'
import { SessionAdapter, type InternalState } from './adapter'
import type { SessionSnapshot } from './types'
import { getAnonymousId } from './useAnonymousId'

interface ManifestResp {
  game: {
    slug: string
    title: string
    subject?: string | null
    manifest: { slides: Slide[] }
  }
  errors: string[]
}

export function SessionPage() {
  const { sid } = useParams<{ sid: string }>()
  const [sp] = useSearchParams()
  const roleParam = sp.get('role') === 'master' ? 'master' : 'player'
  const nameParam = sp.get('name') ?? ''

  if (!sid) return <Navigate to="/" replace />
  return <SessionResolver sid={sid} desiredRole={roleParam} initialName={nameParam} />
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'need-name'; snapshot: SessionSnapshot; slides: Slide[] }
  | { kind: 'live'; snapshot: SessionSnapshot; slides: Slide[]; displayName: string }
  | { kind: 'error'; message: string }

function SessionResolver({
  sid,
  desiredRole,
  initialName,
}: {
  sid: string
  desiredRole: 'master' | 'player'
  initialName: string
}) {
  const { user, token } = useAuth()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

  // 1) Busca snapshot REST (público). Se master, exige login.
  useEffect(() => {
    if (desiredRole === 'master' && !token) return
    let cancelled = false
    Promise.all([
      apiJson<SessionSnapshot>(`/api/lab/sessions/${sid}`, { token: token ?? undefined }),
      apiJson<ManifestResp>(`/api/lab/sessions/${sid}/manifest`, { token: token ?? undefined }),
    ])
      .then(([snap, manifest]) => {
        if (cancelled) return
        const slides = manifest.game.manifest.slides
        if (desiredRole === 'player') {
          const stored = localStorage.getItem('labprof21:last_display_name') ?? ''
          const name = initialName || stored
          if (!name) {
            setPhase({ kind: 'need-name', snapshot: snap, slides })
            return
          }
          setPhase({ kind: 'live', snapshot: snap, slides, displayName: name })
          return
        }
        const masterName = user?.display_name ?? 'Mestre'
        setPhase({ kind: 'live', snapshot: snap, slides, displayName: masterName })
      })
      .catch((e) => {
        if (cancelled) return
        setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [sid, token, desiredRole, initialName, user?.display_name])

  // Master sem token → manda pra login
  if (desiredRole === 'master' && !token) {
    return <Navigate to={`/login?next=${encodeURIComponent(`/lab/session/${sid}?role=master`)}`} replace />
  }

  if (phase.kind === 'loading') return <SlideShell>carregando sessão…</SlideShell>
  if (phase.kind === 'error') return <SlideShell>erro: {phase.message}</SlideShell>
  if (phase.kind === 'need-name') {
    return (
      <PlayerNameGate
        onSubmit={(name) => {
          localStorage.setItem('labprof21:last_display_name', name)
          setPhase({ kind: 'live', snapshot: phase.snapshot, slides: phase.slides, displayName: name })
        }}
      />
    )
  }

  return (
    <SessionLive
      sid={sid}
      desiredRole={desiredRole}
      token={token}
      displayName={phase.displayName}
      snapshot={phase.snapshot}
      slides={phase.slides}
    />
  )
}

function PlayerNameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <SlideShell>
      <div style={{ maxWidth: 420, margin: '0 auto', marginTop: 'var(--spacing-lab-6)' }}>
        <h1 style={{ fontSize: 'var(--text-lab-xl)', margin: 0 }}>Entrar na aula</h1>
        <p style={{ color: '#555B66', marginTop: 6 }}>Seu nome aparece pra turma e pro professor.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim().length < 1) return
            onSubmit(name.trim())
          }}
          style={{ display: 'grid', gap: 12, marginTop: 'var(--spacing-lab-4)' }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="seu nome (qualquer)"
            style={{
              padding: '10px 12px',
              border: '1px solid var(--color-lab-rule)',
              borderRadius: 8,
              fontSize: 15,
              fontFamily: 'inherit',
              background: '#FFF',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-lab-accent)',
              color: '#FFF',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            entrar
          </button>
        </form>
      </div>
    </SlideShell>
  )
}

function SessionLive({
  sid,
  desiredRole,
  token,
  displayName,
  snapshot,
  slides,
}: {
  sid: string
  desiredRole: 'master' | 'player'
  token: string | null
  displayName: string
  snapshot: SessionSnapshot
  slides: Slide[]
}) {
  const adapter = useMemo(() => {
    return new SessionAdapter({
      sessionId: sid,
      token: desiredRole === 'master' ? token : null,
      anonId: desiredRole === 'player' ? getAnonymousId() : null,
      displayName,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, desiredRole])

  const [state, setState] = useState<InternalState>(adapter.state)

  useEffect(() => {
    const unsub = adapter.subscribe((s) => setState(s))
    adapter.connect()
    return () => {
      unsub()
      adapter.close()
    }
  }, [adapter])

  // Atalhos de teclado — só pro master
  useEffect(() => {
    if (state.role !== 'master' || !state.snapshotReceived) return
    const onKey = (e: KeyboardEvent) => {
      const total = slides.length
      if (!total) return
      let next: number | null = null
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') next = state.slideIndex + 1
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') next = state.slideIndex - 1
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = total - 1
      if (next !== null) {
        e.preventDefault()
        const clamped = Math.min(Math.max(0, next), total - 1)
        if (clamped !== state.slideIndex) adapter.send({ type: 'setSlide', index: clamped })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [adapter, state.role, state.slideIndex, state.snapshotReceived, slides.length])

  if (!state.snapshotReceived) {
    return <SlideShell>conectando…</SlideShell>
  }

  // Role divergente: URL pedia master mas backend disse player (não é dono).
  if (desiredRole === 'master' && state.role === 'player') {
    return (
      <SlideShell>
        <div style={{ color: '#993C1D', fontFamily: 'var(--font-lab-mono)' }}>
          você não é o mestre dessa sessão. Peça o link como player ou faça login com a conta dona da aula.
        </div>
        <Link to="/" style={{ color: 'var(--color-lab-accent)' }}>voltar</Link>
      </SlideShell>
    )
  }

  const slide = slides[state.slideIndex]

  return (
    <SlideShell>
      {slide ? (
        <SlideRenderer slide={slide} />
      ) : (
        <div style={{ color: '#555B66' }}>aula sem slides ou índice inválido.</div>
      )}
      <SessionHUD
        role={state.role}
        status={state.status}
        slideIndex={state.slideIndex}
        total={slides.length}
        participants={state.participants.length}
        title={snapshot.game_title}
        onPrev={() => adapter.send({ type: 'setSlide', index: state.slideIndex - 1 })}
        onNext={() => adapter.send({ type: 'setSlide', index: state.slideIndex + 1 })}
        onEnd={() => {
          if (confirm('Encerrar sessão pra todos?')) adapter.send({ type: 'endSession' })
        }}
        sid={sid}
      />
    </SlideShell>
  )
}

function SessionHUD({
  role,
  status,
  slideIndex,
  total,
  participants,
  title,
  onPrev,
  onNext,
  onEnd,
  sid,
}: {
  role: 'master' | 'player' | null
  status: string
  slideIndex: number
  total: number
  participants: number
  title: string
  onPrev: () => void
  onNext: () => void
  onEnd: () => void
  sid: string
}) {
  const isMaster = role === 'master'
  const playerLink = `${window.location.origin}/lab/session/${sid}?role=player`

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--color-lab-rule)',
        fontFamily: 'var(--font-lab-mono)',
        fontSize: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#0F1115', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        <div style={{ color: '#555B66' }}>
          <span style={{ marginRight: 8 }}>status: {status}</span>
          <span style={{ marginRight: 8 }}>role: {role ?? '?'}</span>
          <span>{participants} online</span>
        </div>
      </div>
      {isMaster ? (
        <>
          <button onClick={onPrev} disabled={slideIndex === 0} style={btn}>
            ←
          </button>
          <span>{slideIndex + 1} / {total}</span>
          <button onClick={onNext} disabled={slideIndex >= total - 1} style={btn}>
            →
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(playerLink).catch(() => {})}
            style={{ ...btn, minWidth: 0, padding: '0 8px' }}
            title="copiar link do aluno"
          >
            copiar link aluno
          </button>
          <button onClick={onEnd} style={{ ...btn, color: '#993C1D' }}>
            encerrar
          </button>
        </>
      ) : (
        <span>
          slide {slideIndex + 1} / {total}
        </span>
      )}
    </nav>
  )
}

const btn: React.CSSProperties = {
  minWidth: 44,
  height: 36,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--color-lab-rule)',
  background: '#FFF',
  fontFamily: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
}
