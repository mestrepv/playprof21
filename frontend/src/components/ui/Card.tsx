import type { HTMLAttributes, ReactNode } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
  interactive?: boolean
  children: ReactNode
}

export function Card({ padded = true, interactive = false, className, style, children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={[interactive ? 'p21-card-interactive' : '', className].filter(Boolean).join(' ')}
      style={{
        background: 'var(--p21-surface)',
        border: '0.5px solid rgba(0,0,0,.1)',
        borderRadius: 'var(--p21-radius-lg)',
        padding: padded ? 'var(--p21-sp-5)' : 0,
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        cursor: interactive ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
