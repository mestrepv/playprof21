/**
 * Splash da fase 1 — confirma que React sobe, API responde /health e
 * WebSocket echo funciona. Próximas fases trocam isso pelo router do lab.
 */

import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5105'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:5105'

type Health = { status: string; db: boolean; db_error?: string } | null

export function App() {
  const [health, setHealth] = useState<Health>(null)
  const [wsEcho, setWsEcho] = useState<string>('aguardando…')

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setHealth({ status: 'error', db: false, db_error: String(e) }))

    const ws = new WebSocket(`${WS_URL}/ws/echo`)
    ws.onopen = () => ws.send('hello from web')
    ws.onmessage = (ev) => {
      setWsEcho(ev.data)
      ws.close()
    }
    ws.onerror = () => setWsEcho('ws erro')

    return () => ws.close()
  }, [])

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#fafaf7',
        color: '#2C2C2A',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: 560, padding: '2rem', textAlign: 'left' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>labprof21</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>
          Aulas interativas síncronas · Fase 1 · smoke test
        </p>

        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 14 }}>
          <dt style={{ color: '#666' }}>API</dt>
          <dd style={{ margin: 0 }}>
            <Status ok={health?.status === 'ok'} label={API_URL} />
          </dd>
          <dt style={{ color: '#666' }}>Postgres</dt>
          <dd style={{ margin: 0 }}>
            <Status ok={health?.db === true} label={health?.db ? 'conectado' : health?.db_error ?? '…'} />
          </dd>
          <dt style={{ color: '#666' }}>WebSocket</dt>
          <dd style={{ margin: 0 }}>
            <Status ok={wsEcho.startsWith('echo:')} label={wsEcho} />
          </dd>
        </dl>
      </div>
    </main>
  )
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        color: ok ? '#0F6E56' : '#993C1D',
      }}
    >
      {ok ? '✓' : '…'} {label}
    </span>
  )
}
