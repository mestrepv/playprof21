/**
 * Input com label + hint opcional + estado de erro.
 * Mobile-friendly: min-height 44px, font-size 16px pra evitar zoom automático
 * do Safari em iOS.
 */

import type { InputHTMLAttributes, CSSProperties } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string | null
  monospaceValue?: boolean
}

export function Input({ label, hint, error, monospaceValue, style, id, ...rest }: Props) {
  const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: 'var(--p21-tap)',
    padding: '10px 14px',
    border: '2px solid',
    borderColor: error ? 'var(--p21-coral)' : 'var(--p21-border-strong)',
    borderRadius: 'var(--p21-radius-md)',
    fontSize: 16, // evita zoom no iOS
    fontFamily: monospaceValue ? 'var(--p21-font-mono)' : 'inherit',
    background: 'var(--p21-surface)',
    color: 'var(--p21-ink)',
    ...style,
  }
  return (
    <label htmlFor={id} style={{ display: 'grid', gap: 6 }}>
      {label && (
        <span
          style={{
            fontSize: 'var(--p21-text-sm)',
            fontWeight: 500,
            color: 'var(--p21-ink-2)',
          }}
        >
          {label}
        </span>
      )}
      <input id={id} {...rest} style={inputStyle} />
      {(hint || error) && (
        <span
          style={{
            fontSize: 'var(--p21-text-xs)',
            color: error ? 'var(--p21-coral-ink)' : 'var(--p21-ink-3)',
            fontFamily: error ? 'var(--p21-font-mono)' : 'inherit',
          }}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  )
}
