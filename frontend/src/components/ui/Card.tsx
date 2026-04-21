/**
 * Card — superfície branca com border 1px arredondada. Variant `interactive`
 * adiciona shadow-3D + hover elevação. `padded` default true.
 */

import type { HTMLAttributes, ReactNode } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
  interactive?: boolean
  children: ReactNode
}

export function Card({ padded = true, interactive = false, style, children, ...rest }: Props) {
  return (
    <div
      {...rest}
      style={{
        background: 'var(--p21-surface)',
        border: '1px solid var(--p21-border)',
        borderRadius: 'var(--p21-radius-lg)',
        padding: padded ? 'var(--p21-sp-5)' : 0,
        boxShadow: 'var(--p21-shadow-sm)',
        transition: interactive ? 'border-color 0.15s ease, box-shadow 0.15s ease' : undefined,
        cursor: interactive ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
