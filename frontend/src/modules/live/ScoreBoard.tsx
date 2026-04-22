/**
 * ScoreBoard — placar ao vivo dos participantes.
 * Só visível pro master; players podem ver uma versão simplificada (próprio score).
 */

import { useState } from 'react'
import { useSession } from './SessionContext'

export function ScoreBoard() {
  const { state } = useSession()
  const [open, setOpen] = useState(false)
  const isMaster = state.role === 'master'

  // Só mostrar se há alguma pontuação ou master quer acompanhar
  const hasSomeScore = Object.values(state.scores).some((s) => s !== 0)
  if (!isMaster && !hasSomeScore) return null

  const myScore = state.membershipId ? (state.scores[state.membershipId] ?? 0) : null

  // Player: mostra só próprio score
  if (!isMaster) {
    if (myScore === null || myScore === 0) return null
    return (
      <div style={playerBadgeStyle}>
        ⭐ {myScore} pt{myScore !== 1 ? 's' : ''}
      </div>
    )
  }

  // Master: botão que abre painel
  const rows = state.participants
    .filter((p) => p.role === 'player')
    .map((p) => ({ ...p, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Placar"
        style={masterBtnStyle}
      >
        ⭐ placar
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Placar ao vivo</span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
            >
              ×
            </button>
          </div>
          {rows.length === 0 ? (
            <p style={{ color: 'var(--p21-ink-3, #777)', fontSize: 13 }}>nenhum aluno conectado</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {rows.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: i === 0 ? 'rgba(234,179,8,0.10)' : 'var(--p21-surface-2, #F8F7F3)',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: '#888', width: 20, textAlign: 'center' }}>
                    {i + 1}º
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.display_name}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: p.score > 0 ? '#16a34a' : 'var(--p21-ink-3, #777)' }}>
                    {p.score} pt{p.score !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

const playerBadgeStyle: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  zIndex: 40,
  padding: '6px 12px',
  borderRadius: 20,
  background: 'rgba(255,255,255,0.95)',
  border: '1.5px solid var(--p21-border, #E5E3DC)',
  fontFamily: 'var(--p21-font-mono, monospace)',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--p21-ink, #0F1115)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
}

const masterBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 8,
  border: '1.5px solid var(--p21-border-strong, #C5C2B8)',
  background: 'var(--p21-surface, #FFF)',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 72,
  right: 12,
  zIndex: 40,
  width: 260,
  maxHeight: 360,
  overflowY: 'auto',
  background: 'rgba(255,255,255,0.98)',
  border: '1.5px solid var(--p21-border, #E5E3DC)',
  borderRadius: 12,
  padding: '12px 14px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
  fontFamily: 'var(--p21-font-mono, monospace)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
}
