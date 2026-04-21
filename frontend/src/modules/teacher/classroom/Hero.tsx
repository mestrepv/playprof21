/**
 * Hero da página da turma: banner azul gradiente com nome, subtítulo,
 * código copiável e botão voltar. Espelha `.td-hero` do play.prof21.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ArrowLeftIcon, CopyIcon } from '../../../components/ui/icons'

interface Props {
  name: string
  subtitle?: string
  code: string | null
}

export function ClassroomHero({ name, subtitle, code }: Props) {
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard bloqueado */
    }
  }

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, var(--p21-stat-blue), color-mix(in srgb, var(--p21-stat-blue) 70%, #000))',
        borderRadius: 'var(--p21-radius-lg)',
        padding: 'var(--p21-sp-6) var(--p21-sp-6) var(--p21-sp-7)',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '-24px', // stats row overlap
      }}
    >
      <div
        aria-hidden
        style={{
          content: '""',
          position: 'absolute',
          top: '-30%',
          right: '-10%',
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--p21-sp-4)',
          position: 'relative',
          gap: 12,
        }}
      >
        <Link to="/teacher" aria-label="voltar" style={backBtn}>
          <ArrowLeftIcon size={18} />
        </Link>
        {code && (
          <button
            type="button"
            onClick={copyCode}
            aria-label="copiar código"
            style={{
              ...badge,
              background: copied ? 'rgba(88,204,2,0.35)' : 'rgba(255,255,255,0.15)',
            }}
          >
            <CopyIcon size={14} />
            <span style={{ fontFamily: 'var(--p21-font-mono)', letterSpacing: '0.12em' }}>{code}</span>
            {copied && <span style={{ fontSize: 11 }}>copiado</span>}
          </button>
        )}
      </div>
      <h1
        style={{
          fontSize: 'var(--p21-text-2xl)',
          margin: 0,
          lineHeight: 1.15,
          position: 'relative',
          fontFamily: 'var(--p21-font-display)',
        }}
      >
        {name}
      </h1>
      {subtitle && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 'var(--p21-text-sm)',
            opacity: 0.8,
            position: 'relative',
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

const backBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.12)',
  color: '#fff',
  textDecoration: 'none',
  transition: 'background 0.15s',
}

const badge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 'var(--p21-text-sm)',
  cursor: 'pointer',
  color: '#fff',
  transition: 'background 0.15s',
  fontFamily: 'inherit',
}
