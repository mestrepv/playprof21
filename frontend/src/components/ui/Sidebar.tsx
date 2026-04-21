/**
 * Sidebar lateral. Desktop: 240px expandido ou 60px colapsado (com tooltips).
 * Mobile (<640px): drawer fullscreen com overlay ativado por hamburger no
 * header.
 *
 * Itens filtrados por role; configurações/perfil/sair ficam no rodapé.
 */

import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { useAuth } from '../../modules/auth/AuthContext'
import { Logo } from './Logo'
import {
  BoltIcon,
  ChartIcon,
  ChatIcon,
  UsersIcon,
  XIcon,
} from './icons'

interface Props {
  /** Em mobile, controla drawer. Em desktop, sempre true (ignorado). */
  mobileOpen: boolean
  onCloseMobile: () => void
  /** Estado colapsado em desktop. */
  collapsed: boolean
  onToggleCollapse: () => void
}

interface Item {
  to: string
  label: string
  icon: React.ReactNode
  /** Match exato OR por prefixo (default true = prefixo). */
  end?: boolean
}

export function Sidebar({ mobileOpen, onCloseMobile, collapsed, onToggleCollapse }: Props) {
  const { user, logout } = useAuth()
  const location = useLocation()

  // Fecha drawer ao navegar (mobile)
  useEffect(() => {
    onCloseMobile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const items: Item[] = user?.role === 'student'
    ? [
        { to: '/student', label: 'Minhas turmas', icon: <UsersIcon size={18} />, end: true },
      ]
    : [
        { to: '/teacher', label: 'Turmas', icon: <UsersIcon size={18} />, end: true },
        { to: '/teacher/library', label: 'Banco de conteúdos', icon: <BoltIcon size={18} /> },
      ]

  const bottomItems: Item[] = [
    { to: '/profile', label: 'Meu perfil', icon: <ChatIcon size={18} /> },
    { to: '/settings', label: 'Configurações', icon: <ChartIcon size={18} /> },
  ]

  return (
    <>
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,17,21,0.5)',
            zIndex: 40,
          }}
          className="p21-sidebar-overlay"
          aria-hidden
        />
      )}

      <aside
        className="p21-sidebar"
        data-collapsed={collapsed ? 'true' : 'false'}
        data-mobile-open={mobileOpen ? 'true' : 'false'}
        aria-label="Navegação principal"
        style={sidebarStyle}
      >
        <div style={topSectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div className="p21-sb-logo" style={{ padding: 'var(--p21-sp-2)' }}>
              <Logo label={collapsed ? null : 'labprof21'} size="sm" />
            </div>
            {/* Botão fechar drawer mobile */}
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="fechar"
              className="p21-sb-close-mobile"
              style={{
                width: 36,
                height: 36,
                display: 'none',
                placeItems: 'center',
                borderRadius: 'var(--p21-radius-sm)',
                color: 'var(--p21-ink-3)',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <XIcon size={18} />
            </button>
          </div>

          <div style={sectionLabel}>{collapsed ? '' : 'Menu'}</div>
          <nav style={{ display: 'grid', gap: 2 }}>
            {items.map((it) => (
              <NavItem key={it.to} item={it} collapsed={collapsed} />
            ))}
          </nav>
        </div>

        <div style={bottomSectionStyle}>
          <nav style={{ display: 'grid', gap: 2 }}>
            {bottomItems.map((it) => (
              <NavItem key={it.to} item={it} collapsed={collapsed} />
            ))}
            <button
              type="button"
              onClick={() => logout()}
              className="p21-sb-link p21-sb-link-button"
              title={collapsed ? 'Sair' : undefined}
              style={{
                ...linkStyle,
                border: 'none',
                background: 'transparent',
                width: '100%',
                cursor: 'pointer',
                color: 'var(--p21-coral-ink)',
              }}
            >
              <span style={iconWrap} aria-hidden>
                <XIcon size={18} />
              </span>
              {!collapsed && <span>Sair</span>}
            </button>
          </nav>

          {/* Toggle colapsar (desktop only) */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p21-sb-collapse-toggle"
            aria-label={collapsed ? 'expandir' : 'colapsar'}
            title={collapsed ? 'expandir' : 'colapsar'}
            style={{
              marginTop: 10,
              display: 'none',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-end',
              padding: 'var(--p21-sp-2)',
              background: 'transparent',
              color: 'var(--p21-ink-4)',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              borderRadius: 'var(--p21-radius-sm)',
              border: '1px solid var(--p21-border)',
              width: '100%',
            }}
          >
            {collapsed ? '»' : '« recolher'}
          </button>
        </div>
      </aside>

      <SidebarStyles />
    </>
  )
}

function NavItem({ item, collapsed }: { item: Item; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        isActive ? 'p21-sb-link p21-sb-link--active' : 'p21-sb-link'
      }
      style={({ isActive }) => ({
        ...linkStyle,
        background: isActive ? 'var(--p21-blue-soft)' : 'transparent',
        color: isActive ? 'var(--p21-blue-ink)' : 'var(--p21-ink-2)',
        fontWeight: isActive ? 600 : 500,
      })}
    >
      <span style={iconWrap} aria-hidden>
        {item.icon}
      </span>
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  )
}

// ── estilos ────────────────────────────────────────────────────────────

const sidebarStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  bottom: 0,
  left: 0,
  width: 240,
  background: 'var(--p21-surface)',
  borderRight: '1px solid var(--p21-border)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: 'var(--p21-sp-3)',
  transition: 'width 0.3s cubic-bezier(.4,0,.2,1), transform 0.3s ease',
  zIndex: 50,
}

const topSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--p21-sp-3)',
  flex: 1,
}

const bottomSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--p21-sp-1)',
  borderTop: '1px solid var(--p21-border)',
  paddingTop: 'var(--p21-sp-3)',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  color: 'var(--p21-ink-4)',
  padding: '0 var(--p21-sp-3)',
  fontWeight: 600,
  fontFamily: 'var(--p21-font-mono)',
}

const linkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px var(--p21-sp-3)',
  borderRadius: 'var(--p21-radius-sm)',
  fontSize: 'var(--p21-text-sm)',
  textDecoration: 'none',
  minHeight: 40,
  transition: 'background 0.15s, color 0.15s',
}

const iconWrap: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  flexShrink: 0,
}

// Inject CSS pra media queries
function SidebarStyles() {
  return (
    <style>{`
      /* Desktop colapsado */
      .p21-sidebar[data-collapsed="true"] {
        width: 72px;
      }
      /* Desktop ≥ 1024px: toggle collapse visível */
      @media (min-width: 1024px) {
        .p21-sb-collapse-toggle { display: flex !important; }
      }
      /* Tablet 640-1023px: sempre colapsado */
      @media (min-width: 640px) and (max-width: 1023px) {
        .p21-sidebar { width: 72px !important; }
        .p21-sb-collapse-toggle { display: none !important; }
      }
      /* Mobile: drawer */
      @media (max-width: 639px) {
        .p21-sidebar {
          transform: translateX(-100%);
          width: min(88%, 300px) !important;
          box-shadow: var(--p21-shadow-lg);
        }
        .p21-sidebar[data-mobile-open="true"] {
          transform: translateX(0);
        }
        .p21-sb-close-mobile { display: grid !important; }
        .p21-sb-collapse-toggle { display: none !important; }
      }
      @media (min-width: 640px) {
        .p21-sidebar-overlay { display: none; }
      }
      .p21-sb-link:hover {
        background: var(--p21-surface-2) !important;
        color: var(--p21-ink) !important;
      }
      .p21-sb-link--active:hover {
        background: var(--p21-blue-soft) !important;
        color: var(--p21-blue-ink) !important;
      }
    `}</style>
  )
}
