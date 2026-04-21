/**
 * Overlay que mostra o código de 6 dígitos + QR pros alunos entrarem.
 *
 * QR aponta pra /lab/join?code=NNNNNN, que pré-preenche o campo. O aluno
 * só precisa digitar o nome.
 *
 * Master pode rotacionar o código se suspeitar que vazou.
 */

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

import { apiJson } from '../lab/runtime/apiFetch'

interface Props {
  sessionId: string
  initialCode: string | null
  token: string | null
  onClose: () => void
}

export function CodeOverlay({ sessionId, initialCode, token, onClose }: Props) {
  const [code, setCode] = useState<string | null>(initialCode)
  const [busy, setBusy] = useState(false)

  useEffect(() => setCode(initialCode), [initialCode])

  const rotate = async () => {
    if (!token) return
    setBusy(true)
    try {
      const r = await apiJson<{ code: string }>(`/api/lab/sessions/${sessionId}/code/rotate`, {
        token,
        method: 'POST',
      })
      setCode(r.code)
    } finally {
      setBusy(false)
    }
  }

  const joinUrl = code ? `${window.location.origin}/lab/join?code=${code}` : ''

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,17,21,0.85)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FAFAF7',
          color: '#0F1115',
          padding: 'var(--spacing-lab-6, 3rem)',
          borderRadius: 16,
          maxWidth: 520,
          width: '92vw',
          textAlign: 'center',
          fontFamily: 'var(--font-lab-sans)',
        }}
      >
        <div style={{ fontSize: 13, color: '#555B66', letterSpacing: 1, textTransform: 'uppercase' }}>
          código de entrada
        </div>
        <div
          style={{
            fontFamily: 'var(--font-lab-mono, monospace)',
            fontSize: 'clamp(3.5rem, 10vw, 6rem)',
            fontWeight: 600,
            letterSpacing: 'clamp(8px, 2vw, 18px)',
            margin: '12px 0',
            color: 'var(--color-lab-accent)',
          }}
        >
          {code ?? '—'}
        </div>
        {code && (
          <div style={{ display: 'grid', placeItems: 'center', marginTop: 12 }}>
            <div style={{ background: '#FFF', padding: 12, borderRadius: 12, border: '1px solid var(--color-lab-rule)' }}>
              <QRCodeSVG value={joinUrl} size={200} includeMargin={false} />
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#555B66', fontFamily: 'var(--font-lab-mono)' }}>
              {joinUrl}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 'var(--spacing-lab-5)', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid var(--color-lab-rule)',
              background: '#FFF',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 14,
            }}
          >
            fechar
          </button>
          <button
            type="button"
            onClick={rotate}
            disabled={busy || !token}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-lab-accent)',
              color: '#FFF',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 14,
            }}
            title="invalida o código atual e gera outro — use se suspeitar que vazou"
          >
            {busy ? 'girando…' : 'gerar novo código'}
          </button>
        </div>
      </div>
    </div>
  )
}
