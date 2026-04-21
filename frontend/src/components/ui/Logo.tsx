/**
 * Logo P21 — quadrado azul com "P21" branco + nome da plataforma.
 * Espelha o visual do play.prof21 legado adaptado pro labprof21.
 */

import { Link } from 'react-router-dom'

interface Props {
  /** Nome ao lado do mark. Null = só o quadrado. */
  label?: string | null
  /** Link de destino do clique. Default '/'. */
  to?: string
  size?: 'sm' | 'md'
}

export function Logo({ label = 'labprof21', to = '/', size = 'md' }: Props) {
  const box = size === 'sm' ? 28 : 36
  const fs = size === 'sm' ? 11 : 13
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        textDecoration: 'none',
        color: 'var(--p21-ink)',
      }}
      aria-label="labprof21"
    >
      <span
        aria-hidden
        style={{
          width: box,
          height: box,
          borderRadius: 'var(--p21-radius-sm)',
          background: 'var(--p21-blue)',
          color: '#FFF',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--p21-font-display)',
          fontWeight: 700,
          fontSize: fs,
          letterSpacing: -0.5,
          boxShadow: 'var(--p21-shadow-sm)',
        }}
      >
        P21
      </span>
      {label && (
        <span
          style={{
            fontFamily: 'var(--p21-font-display)',
            fontWeight: 600,
            fontSize: size === 'sm' ? 14 : 16,
            letterSpacing: -0.01,
          }}
        >
          {label}
        </span>
      )}
    </Link>
  )
}
