/**
 * Button — clean, sem look 3D. Variants primary/secondary/outline/ghost/
 * danger; tamanhos sm/md/lg; suporta `as="a"` pra âncora/link.
 *
 * Tap target ≥44px em md/lg pra mobile.
 */

import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode, CSSProperties } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface BaseProps {
  variant?: Variant
  size?: Size
  block?: boolean
  children: ReactNode
}

type AsButton = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' }
type AsAnchor = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a' }

export function Button(props: AsButton | AsAnchor) {
  const { variant = 'primary', size = 'md', block, children, style, ...rest } = props
  const s: CSSProperties = {
    ...baseStyle,
    ...sizes[size],
    ...palette[variant],
    width: block ? '100%' : undefined,
    opacity: (rest as { disabled?: boolean }).disabled ? 0.55 : 1,
    cursor: (rest as { disabled?: boolean }).disabled ? 'not-allowed' : 'pointer',
    ...style,
  }
  if ('as' in props && props.as === 'a') {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} style={s}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} style={s}>
      {children}
    </button>
  )
}

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontFamily: 'var(--p21-font-sans)',
  fontWeight: 600,
  letterSpacing: 0.1,
  textDecoration: 'none',
  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  borderRadius: 'var(--p21-radius-md)',
  border: '1px solid transparent',
  lineHeight: 1,
  whiteSpace: 'nowrap',
}

const sizes: Record<Size, CSSProperties> = {
  sm: { height: 36, padding: '0 14px', fontSize: 'var(--p21-text-sm)', borderRadius: 'var(--p21-radius-sm)' },
  md: { minHeight: 'var(--p21-tap)', padding: '0 18px', fontSize: 'var(--p21-text-base)' },
  lg: { minHeight: 52, padding: '0 22px', fontSize: 'var(--p21-text-md)' },
}

const palette: Record<Variant, CSSProperties> = {
  primary: {
    background: 'var(--p21-primary)',
    color: '#FFF',
    borderColor: 'var(--p21-primary)',
  },
  secondary: {
    background: 'var(--p21-blue)',
    color: '#FFF',
    borderColor: 'var(--p21-blue)',
  },
  outline: {
    background: 'var(--p21-surface)',
    color: 'var(--p21-ink)',
    borderColor: 'var(--p21-border-strong)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--p21-blue)',
    borderColor: 'transparent',
  },
  danger: {
    background: 'var(--p21-coral)',
    color: '#FFF',
    borderColor: 'var(--p21-coral)',
  },
}
