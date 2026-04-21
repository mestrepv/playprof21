/**
 * PreviewPage — render de aula sem sessão, só pra revisão de conteúdo.
 *
 * Navegação:
 *   Seta →  / Space / PgDown  → próximo slide
 *   Seta ←  / PgUp            → slide anterior
 *   Home / End                → primeiro / último
 *   /preview/:slug            → começa no slide 0
 *   /preview/:slug?s=N        → começa no slide N (1-indexed, útil pra compartilhar)
 *
 * Adapter mock: nada de WebSocket. A Fase 4 pluga o runtime ao vivo.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'

import { SlideRenderer } from '../components/SlideRenderer'
import { SlideShell } from '../components/SlideShell'
import { apiUrl } from '../runtime/apiUrl'
import type { GameEnvelope } from '../types/manifest'

const API_URL = apiUrl()

type Fetch<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'error'; message: string }

function useManifest(slug: string | undefined): Fetch<GameEnvelope> {
  const [state, setState] = useState<Fetch<GameEnvelope>>({ status: 'idle' })
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setState({ status: 'loading' })
    fetch(`${API_URL}/api/lab/games/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as { game: GameEnvelope; errors: string[] }
      })
      .then((payload) => {
        if (cancelled) return
        setState({ status: 'ok', data: payload.game })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [slug])
  return state
}

export function PreviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const manifest = useManifest(slug)

  const total =
    manifest.status === 'ok' ? manifest.data.manifest.slides.length : 0

  const initialIdx = (() => {
    const raw = searchParams.get('s')
    const n = raw ? Number.parseInt(raw, 10) : 1
    if (!Number.isFinite(n) || n < 1) return 0
    return Math.min(n - 1, Math.max(0, total - 1))
  })()

  const [idx, setIdx] = useState<number>(initialIdx)

  useEffect(() => {
    if (manifest.status !== 'ok') return
    const clamped = Math.min(Math.max(0, initialIdx), total - 1)
    setIdx(clamped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest.status, total])

  const goTo = useCallback(
    (next: number) => {
      if (manifest.status !== 'ok') return
      const clamped = Math.min(Math.max(0, next), total - 1)
      setIdx(clamped)
      const sp = new URLSearchParams(searchParams)
      sp.set('s', String(clamped + 1))
      setSearchParams(sp, { replace: true })
    },
    [manifest.status, total, searchParams, setSearchParams],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (manifest.status !== 'ok') return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        goTo(idx + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goTo(idx - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        goTo(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        goTo(total - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [manifest.status, idx, total, goTo])

  if (manifest.status === 'idle' || manifest.status === 'loading') {
    return (
      <SlideShell>
        <div style={{ fontFamily: 'var(--font-lab-mono)', color: '#555B66' }}>
          carregando manifest de <code>{slug}</code>…
        </div>
      </SlideShell>
    )
  }

  if (manifest.status === 'error') {
    return (
      <SlideShell>
        <div style={{ fontFamily: 'var(--font-lab-mono)', color: '#993C1D' }}>
          erro carregando aula <code>{slug}</code>: {manifest.message}
        </div>
        <p>
          <Link to="/">voltar</Link>
        </p>
      </SlideShell>
    )
  }

  const game = manifest.data
  const slide = game.manifest.slides[idx]
  if (!slide) {
    return (
      <SlideShell>
        <div>aula {game.title} não tem slides.</div>
      </SlideShell>
    )
  }

  return (
    <SlideShell>
      <SlideRenderer slide={slide} />
      <NavBar
        idx={idx}
        total={total}
        title={game.title}
        slideLabel={slide.label}
        onPrev={() => goTo(idx - 1)}
        onNext={() => goTo(idx + 1)}
      />
    </SlideShell>
  )
}

function NavBar({
  idx,
  total,
  title,
  slideLabel,
  onPrev,
  onNext,
}: {
  idx: number
  total: number
  title: string
  slideLabel: string
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <nav
      aria-label="Navegação de slides"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--color-lab-rule, #D8D5CB)',
        fontFamily: 'var(--font-lab-mono, monospace)',
        fontSize: 12,
      }}
    >
      <div style={{ color: '#555B66', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Link to="/" style={{ color: '#555B66', textDecoration: 'none' }}>
          ← aulas
        </Link>
        <span style={{ margin: '0 8px', color: '#D8D5CB' }}>·</span>
        <strong style={{ color: '#0F1115' }}>{title}</strong>
        <span style={{ margin: '0 8px', color: '#D8D5CB' }}>·</span>
        <span>{slideLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={onPrev} disabled={idx === 0} style={navBtn}>
          ←
        </button>
        <span style={{ minWidth: 60, textAlign: 'center' }}>
          {idx + 1} / {total}
        </span>
        <button onClick={onNext} disabled={idx >= total - 1} style={navBtn}>
          →
        </button>
      </div>
    </nav>
  )
}

const navBtn: React.CSSProperties = {
  minWidth: 44,
  height: 36,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid #D8D5CB',
  background: '#FFF',
  fontFamily: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
}
