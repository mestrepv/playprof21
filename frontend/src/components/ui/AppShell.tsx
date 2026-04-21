/**
 * AppShell — layout das páginas autenticadas (sidebar + header + main).
 *
 * Desktop ≥1024: sidebar 240px fixa (ou 72px se colapsada por preferência).
 * Tablet 640-1023: sidebar 72px sempre (ícones + tooltip).
 * Mobile <640: sidebar vira drawer ativado por hamburger no header.
 *
 * O main area respeita o offset da sidebar via padding-left responsivo.
 */

import { useEffect, useState, type ReactNode } from 'react'

import { HeaderDropdown } from './HeaderDropdown'
import { Logo } from './Logo'
import { Sidebar } from './Sidebar'

interface Props {
  children: ReactNode
  /** `narrow` = formulários (560px), `reading` = texto (760px), default = 960px. */
  variant?: 'narrow' | 'reading' | 'default'
}

const COLLAPSE_KEY = 'labprof21:sidebar-collapsed'

export function AppShell({ children, variant = 'default' }: Props) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* quota */
    }
  }, [collapsed])

  const mainMaxWidth =
    variant === 'narrow' ? 'var(--p21-container-sm)' : variant === 'reading' ? 'var(--p21-container-md)' : 'var(--p21-container-lg)'

  return (
    <div className="p21-appshell" style={{ minHeight: '100dvh', background: 'var(--p21-bg)' }}>
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />

      <div
        className="p21-appshell-main"
        data-collapsed={collapsed ? 'true' : 'false'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100dvh',
        }}
      >
        <header style={headerStyle}>
          <div style={headerInner}>
            {/* Hamburger (mobile) */}
            <button
              type="button"
              className="p21-hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="abrir menu"
              style={hamburgerBtn}
            >
              <span style={hamburgerIcon}>
                <span style={hamBar} />
                <span style={hamBar} />
                <span style={hamBar} />
              </span>
            </button>

            {/* Em mobile, o logo fica no header (sidebar fechada) */}
            <div className="p21-mobile-logo">
              <Logo size="sm" />
            </div>

            <div style={{ flex: 1 }} />

            <HeaderDropdown />
          </div>
        </header>

        <main
          style={{
            flex: 1,
            width: '100%',
            maxWidth: mainMaxWidth,
            margin: '0 auto',
            padding: 'var(--p21-pad-y) var(--p21-pad-x)',
          }}
        >
          {children}
        </main>
      </div>

      <AppShellStyles />
    </div>
  )
}

const headerStyle: React.CSSProperties = {
  background: 'var(--p21-surface)',
  borderBottom: '1px solid var(--p21-border)',
  position: 'sticky',
  top: 0,
  zIndex: 20,
}
const headerInner: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px var(--p21-pad-x)',
  minHeight: 56,
}
const hamburgerBtn: React.CSSProperties = {
  display: 'none',
  width: 40,
  height: 40,
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  borderRadius: 'var(--p21-radius-sm)',
  background: 'transparent',
  border: 'none',
  color: 'var(--p21-ink)',
}
const hamburgerIcon: React.CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: 4,
  width: 20,
  height: 14,
  justifyContent: 'space-between',
}
const hamBar: React.CSSProperties = {
  display: 'block',
  height: 2,
  width: '100%',
  background: 'currentColor',
  borderRadius: 2,
}

function AppShellStyles() {
  return (
    <style>{`
      /* Offset da main pelo sidebar */
      @media (min-width: 1024px) {
        .p21-appshell-main {
          padding-left: 240px;
          transition: padding-left 0.3s cubic-bezier(.4,0,.2,1);
        }
        .p21-appshell-main[data-collapsed="true"] {
          padding-left: 72px;
        }
        .p21-mobile-logo { display: none; }
      }
      @media (min-width: 640px) and (max-width: 1023px) {
        .p21-appshell-main {
          padding-left: 72px;
        }
        .p21-mobile-logo { display: none; }
      }
      @media (max-width: 639px) {
        .p21-appshell-main { padding-left: 0; }
        .p21-hamburger { display: inline-flex !important; }
      }
    `}</style>
  )
}
