/**
 * Lib pequena de SVGs inline. Tamanho default 20; `size` prop ajusta.
 * `stroke="currentColor"` herda cor do parent (útil pra ícones coloridos
 * dentro dos stat cards via `--stat-color`).
 */

import type { SVGProps } from 'react'

interface Props extends SVGProps<SVGSVGElement> {
  size?: number
}

const defaults = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function UsersIcon({ size = 20, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...rest}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function BoltIcon({ size = 20, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...rest}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

export function PulseIcon({ size = 20, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...rest}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

export function ChartIcon({ size = 20, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...rest}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

export function ChatIcon({ size = 20, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...rest}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function HeartIcon({ size = 20, filled = false, ...rest }: Props & { filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...defaults}
      fill={filled ? 'currentColor' : 'none'}
      {...rest}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

export function ArrowLeftIcon({ size = 20, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...rest}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

export function CopyIcon({ size = 16, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...rest}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function PlusIcon({ size = 18, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...rest}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function XIcon({ size = 20, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...rest}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  )
}

export function TrashIcon({ size = 16, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...rest}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
