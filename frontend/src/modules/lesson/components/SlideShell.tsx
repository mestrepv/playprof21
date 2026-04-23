/**
 * SlideShell — wrapper comum de slide.
 *
 * Aplica padding, fundo de token e marca [data-lab-root] (escopo de tokens
 * e helpers CSS). Componentes concretos (TextSlide, VideoSlide, ...) ficam
 * dentro do children.
 */

import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** fullbleed = sem container central (missions que usam canvas inteiro). */
  variant?: 'default' | 'fullbleed'
}

export function SlideShell({ children, variant = 'default' }: Props) {
  return (
    <div
      data-lab-root
      style={{
        minHeight: '100dvh',
        width: '100%',
        background: '#FAFAF7',
        color: '#0F1115',
        fontFamily: 'var(--font-lab-sans, system-ui, sans-serif)',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 72,
      }}
    >
      {variant === 'fullbleed' ? (
        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      ) : (
        <div
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 'min(960px, 100%)',
            margin: '0 auto',
            padding: 'var(--spacing-lab-4, 1rem) var(--spacing-lab-3, 0.875rem)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
