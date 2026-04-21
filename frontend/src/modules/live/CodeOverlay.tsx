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

import { Button } from '../../components/ui/Button'
import { apiJson } from '../lab/runtime/apiFetch'

interface Props {
  /** URL absoluta que o QR aponta — página pública de join correspondente. */
  joinPathBase: string
  /** Endpoint POST que rotaciona o código (owner only). */
  rotatePath: string
  /** Texto do topo. */
  caption: string
  initialCode: string | null
  token: string | null
  onClose: () => void
}

export function CodeOverlay({
  joinPathBase,
  rotatePath,
  caption,
  initialCode,
  token,
  onClose,
}: Props) {
  const [code, setCode] = useState<string | null>(initialCode)
  const [busy, setBusy] = useState(false)

  useEffect(() => setCode(initialCode), [initialCode])

  const rotate = async () => {
    if (!token) return
    setBusy(true)
    try {
      const r = await apiJson<{ code: string }>(rotatePath, { token, method: 'POST' })
      setCode(r.code)
    } finally {
      setBusy(false)
    }
  }

  const joinUrl = code ? `${window.location.origin}${joinPathBase}?code=${code}` : ''

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
        padding: 'var(--p21-sp-4)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--p21-surface)',
          color: 'var(--p21-ink)',
          padding: 'var(--p21-sp-7)',
          borderRadius: 'var(--p21-radius-xl)',
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'var(--p21-font-sans)',
          boxShadow: 'var(--p21-shadow-lg)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--p21-text-xs)',
            color: 'var(--p21-ink-3)',
            letterSpacing: 1,
            textTransform: 'uppercase',
            fontFamily: 'var(--p21-font-mono)',
            fontWeight: 600,
          }}
        >
          {caption}
        </div>
        <div
          style={{
            fontFamily: 'var(--p21-font-mono)',
            fontSize: 'clamp(3rem, 14vw, 5.5rem)',
            fontWeight: 700,
            letterSpacing: 'clamp(6px, 2vw, 14px)',
            margin: 'var(--p21-sp-3) 0 var(--p21-sp-4)',
            color: 'var(--p21-blue)',
            lineHeight: 1,
          }}
        >
          {code ?? '—'}
        </div>
        {code && (
          <div style={{ display: 'grid', placeItems: 'center', marginTop: 'var(--p21-sp-2)' }}>
            <div
              style={{
                background: '#FFF',
                padding: 'var(--p21-sp-3)',
                borderRadius: 'var(--p21-radius-md)',
                border: '1px solid var(--p21-border)',
              }}
            >
              <QRCodeSVG value={joinUrl} size={180} includeMargin={false} />
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 'var(--p21-text-xs)',
                color: 'var(--p21-ink-4)',
                fontFamily: 'var(--p21-font-mono)',
                wordBreak: 'break-all',
              }}
            >
              {joinUrl}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 'var(--p21-sp-6)', flexWrap: 'wrap' }}>
          <Button onClick={onClose} variant="outline" size="md">
            fechar
          </Button>
          <Button onClick={rotate} disabled={busy || !token} variant="primary" size="md">
            {busy ? 'girando…' : 'gerar novo código'}
          </Button>
        </div>
      </div>
    </div>
  )
}
