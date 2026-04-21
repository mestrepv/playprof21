/**
 * Dropdown do avatar no header. Abre com click; fecha com click fora/Esc.
 * Porta o padrão do play.prof21 (nome + email + role badge + 3 itens).
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../modules/auth/AuthContext'

export function HeaderDropdown() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  if (!user) return null

  const initials =
    user.display_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="menu do usuário"
        aria-expanded={open}
        style={avatarBtn}
      >
        {initials}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 240,
            background: 'var(--p21-surface)',
            border: '1px solid var(--p21-border)',
            borderRadius: 'var(--p21-radius-md)',
            boxShadow: 'var(--p21-shadow-lg)',
            padding: 'var(--p21-sp-2)',
            zIndex: 60,
          }}
        >
          <div
            style={{
              padding: 'var(--p21-sp-3)',
              borderBottom: '1px solid var(--p21-border)',
              marginBottom: 'var(--p21-sp-2)',
            }}
          >
            <div style={{ fontSize: 'var(--p21-text-sm)', fontWeight: 600 }}>{user.display_name}</div>
            {user.email && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--p21-ink-3)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.email}
              </div>
            )}
            <span style={roleBadge(user.role)}>{user.role}</span>
          </div>
          <Link to="/profile" style={itemStyle} onClick={() => setOpen(false)}>
            meu perfil
          </Link>
          <Link to="/settings" style={itemStyle} onClick={() => setOpen(false)}>
            configurações
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              logout()
            }}
            style={{ ...itemStyle, color: 'var(--p21-coral-ink)', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            sair
          </button>
        </div>
      )}
    </div>
  )
}

const avatarBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: 'var(--p21-blue-soft)',
  color: 'var(--p21-blue-ink)',
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: 0.5,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  border: '2px solid transparent',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}

const itemStyle: React.CSSProperties = {
  display: 'block',
  padding: '10px 12px',
  borderRadius: 'var(--p21-radius-sm)',
  color: 'var(--p21-ink-2)',
  fontSize: 'var(--p21-text-sm)',
  textDecoration: 'none',
}

function roleBadge(role: string): React.CSSProperties {
  const palettes: Record<string, { bg: string; fg: string }> = {
    teacher: { bg: 'var(--p21-purple-soft)', fg: 'var(--p21-purple-ink)' },
    student: { bg: 'var(--p21-teal-soft)', fg: 'var(--p21-teal)' },
  }
  const p = palettes[role] ?? { bg: 'var(--p21-surface-2)', fg: 'var(--p21-ink-3)' }
  return {
    display: 'inline-block',
    marginTop: 6,
    padding: '2px 8px',
    borderRadius: 999,
    background: p.bg,
    color: p.fg,
    fontSize: 10,
    fontFamily: 'var(--p21-font-mono)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
}
