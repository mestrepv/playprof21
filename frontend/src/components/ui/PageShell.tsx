/**
 * PageShell — wrapper de página com header (logo + ações) opcional + área de
 * conteúdo. Substitui o `SlideShell` nas telas do app (o SlideShell fica
 * escopado pro runtime de slides de aula interativa).
 *
 * Variantes:
 *   `narrow`   — 560px (formulários)
 *   `reading`  — 760px (texto)
 *   padrão     — 960px (dashboards)
 */

import type { ReactNode } from 'react'
import { Logo } from './Logo'

interface Props {
  children: ReactNode
  variant?: 'narrow' | 'reading' | 'default'
  /** Conteúdo à direita do logo — botões, nome do usuário, etc. */
  headerRight?: ReactNode
  /** Esconde o logo (casos raros). */
  hideLogo?: boolean
  /** Link do logo. */
  logoTo?: string
}

export function PageShell({ children, variant = 'default', headerRight, hideLogo, logoTo = '/' }: Props) {
  const cls =
    variant === 'narrow'
      ? 'p21-page p21-page--narrow'
      : variant === 'reading'
        ? 'p21-page p21-page--reading'
        : 'p21-page'
  return (
    <div className="p21-app-root">
      {!hideLogo && (
        <header style={headerStyle}>
          <div style={headerInner}>
            <Logo to={logoTo} />
            {headerRight && <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{headerRight}</div>}
          </div>
        </header>
      )}
      <main className={cls}>{children}</main>
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
  maxWidth: 'var(--p21-container-lg)',
  margin: '0 auto',
  padding: '10px var(--p21-pad-x)',
  minHeight: 56,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}
