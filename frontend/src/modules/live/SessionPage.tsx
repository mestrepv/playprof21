/**
 * SessionPage — runtime da aula síncrona.
 *
 * URL: /lesson/session/:sid?role=master|player[&name=<display>]
 *
 * Master (teacher dono): abre logado; token JWT autentica + garante role.
 * Player (qualquer um): abre com ?role=player; usa anon_id persistido no
 * localStorage e pede nome. Fase 5 provê o fluxo de join por código + QR.
 *
 * Fase 4.1: SessionContext passa adapter+state pra SlideRenderer;
 * MissionSlide e QuizSlide são session-aware; MasterActivityControls
 * e ScoreBoard aparecem nas sessões ao vivo.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { SlideRenderer } from '../lesson/components/SlideRenderer'
import { SlideShell } from '../lesson/components/SlideShell'
import { apiJson } from '../lesson/runtime/apiFetch'
import type { Slide } from '../lesson/types/manifest'
import { SessionAdapter, type InternalState } from './adapter'
import { CodeOverlay } from './CodeOverlay'
import { InteractionModeBadge } from './InteractionModeBadge'
import { MasterActivityControls } from './MasterActivityControls'
import { ScoreBoard } from './ScoreBoard'
import { SessionContext } from './SessionContext'
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

  useEffect(() => {
    if (desiredRole === 'master' && !token) return
    let cancelled = false
    Promise.all([
      apiJson<SessionSnapshot>(`/api/lesson/sessions/${sid}`, { token: token ?? undefined }),
      apiJson<ManifestResp>(`/api/lesson/sessions/${sid}/manifest`, { token: token ?? undefined }),
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

  if (desiredRole === 'master' && !token) {
    return <Navigate to={`/login?next=${encodeURIComponent(`/lesson/session/${sid}?role=master`)}`} replace />
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
        if (clamped !== state.slideIndex) adapter.setSlide(clamped)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [adapter, state.role, state.slideIndex, state.snapshotReceived, slides.length])

  const [showCode, setShowCode] = useState(false)
  useEffect(() => {
    if (state.role === 'master' && state.snapshotReceived && state.status === 'idle') {
      setShowCode(true)
    }
  }, [state.role, state.snapshotReceived, state.status])

  if (!state.snapshotReceived) {
    return <SlideShell>conectando…</SlideShell>
  }

  if (desiredRole === 'master' && state.role === 'player') {
    return (
      <SlideShell>
        <div style={{ color: '#993C1D', fontFamily: 'var(--font-lab-mono)' }}>
          você não é o mestre dessa sessão.
        </div>
        <Link to="/" style={{ color: 'var(--color-lab-accent)' }}>voltar</Link>
      </SlideShell>
    )
  }

  const slide = slides[state.slideIndex]
  const isMission = slide?.type === 'mission'

  return (
    <SessionContext.Provider value={{ adapter, state }}>
      <SlideShell variant={isMission ? 'fullbleed' : 'default'}>
        {slide ? (
          <SlideRenderer slide={slide} />
        ) : (
          <div style={{ color: '#555B66' }}>aula sem slides ou índice inválido.</div>
        )}
        {/* Faixa de modo de interação (visível a todos em slides mission) */}
        {isMission && <InteractionModeBadge />}
        {/* Botão toggle master-led (só pro master) */}
        {isMission && <MasterActivityControls />}
        {/* Placar */}
        <ScoreBoard />
        <SessionHUD
          role={state.role}
          status={state.status}
          slideIndex={state.slideIndex}
          total={slides.length}
          participants={state.participants.length}
          title={snapshot.game_title}
          code={snapshot.session.code}
          onPrev={() => adapter.setSlide(state.slideIndex - 1)}
          onNext={() => adapter.setSlide(state.slideIndex + 1)}
          onEnd={() => {
            if (confirm('Encerrar sessão pra todos?')) adapter.send({ type: 'endSession' })
          }}
          onShowCode={() => setShowCode(true)}
        />
        {showCode && state.role === 'master' && (
          <CodeOverlay
            caption="código da aula ao vivo"
            joinPathBase="/lesson/join"
            rotatePath={`/api/lesson/sessions/${sid}/code/rotate`}
            initialCode={snapshot.session.code}
            token={token}
            onClose={() => setShowCode(false)}
          />
        )}
      </SlideShell>
    </SessionContext.Provider>
  )
}

function SessionHUD({
  role,
  status,
  slideIndex,
  total,
  participants,
  title,
  code,
  onPrev,
  onNext,
  onEnd,
  onShowCode,
}: {
  role: 'master' | 'player' | null
  status: string
  slideIndex: number
  total: number
  participants: number
  title: string
  code: string | null
  onPrev: () => void
  onNext: () => void
  onEnd: () => void
  onShowCode: () => void
}) {
  const isMaster = role === 'master'

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 'env(safe-area-inset-bottom, 0) 14px 10px',
        paddingTop: 10,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--p21-border)',
        fontFamily: 'var(--p21-font-mono)',
        fontSize: 'var(--p21-text-xs)',
        flexWrap: 'wrap',
        zIndex: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: 'var(--p21-ink)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: 'var(--p21-font-sans)',
            fontSize: 'var(--p21-text-sm)',
          }}
        >
          {title}
        </div>
        <div style={{ color: 'var(--p21-ink-3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>status {status}</span>
          <span>· {participants} online</span>
        </div>
      </div>
      {isMaster ? (
        <>
          <button onClick={onPrev} disabled={slideIndex === 0} style={hudBtn}>
            ←
          </button>
          <span style={{ fontWeight: 600, color: 'var(--p21-ink)' }}>
            {slideIndex + 1} / {total}
          </span>
          <button onClick={onNext} disabled={slideIndex >= total - 1} style={hudBtn}>
            →
          </button>
          <ScoreBoardInHud />
          <button
            onClick={onShowCode}
            style={{
              ...hudBtn,
              padding: '0 12px',
              background: 'var(--p21-blue)',
              color: '#FFF',
              borderColor: 'var(--p21-blue)',
            }}
            title="mostrar código + QR pros alunos entrarem"
          >
            {code ? `código ${code}` : 'código'}
          </button>
          <button onClick={onEnd} style={{ ...hudBtn, color: 'var(--p21-coral-ink)' }}>
            encerrar
          </button>
        </>
      ) : (
        <span style={{ fontWeight: 600, color: 'var(--p21-ink)' }}>
          slide {slideIndex + 1} / {total}
        </span>
      )}
    </nav>
  )
}

/** Botão de placar embutido no HUD do master (evita componente flutuante). */
function ScoreBoardInHud() {
  // Importa apenas o botão/painel — não duplica o badge do player
  return <ScoreBoard />
}

const hudBtn: React.CSSProperties = {
  minWidth: 44,
  height: 38,
  padding: '0 12px',
  borderRadius: 'var(--p21-radius-sm)',
  border: '2px solid var(--p21-border-strong)',
  background: 'var(--p21-surface)',
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s',
}
