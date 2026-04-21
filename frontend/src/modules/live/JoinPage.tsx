/**
 * /lab/join?code=NNNNNN — tela de entrada do aluno.
 *
 * Aluno digita (ou chega com `?code=` pré-preenchido via QR) + nome,
 * submete. Backend devolve session_id + anon_id; persistimos o anon_id
 * em localStorage e redirecionamos pra /lab/session/:sid?role=player&name=...
 *
 * Sem autenticação — código + rate-limit do backend são a defesa.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { SlideShell } from '../lab/components/SlideShell'
import { apiJson } from '../lab/runtime/apiFetch'

const ANON_KEY = 'labprof21:anon_id'
const NAME_KEY = 'labprof21:last_display_name'

interface JoinResp {
  session_id: string
  anon_id: string
  display_name: string
}

export function JoinPage() {
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const [code, setCode] = useState(sp.get('code') ?? '')
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Auto-submit se código e nome já estão preenchidos — fluxo "volta pra mesma aula".
  useEffect(() => {
    if (sp.get('code') && name && !busy) {
      // não auto-submit — o aluno ainda escolhe; só pré-preenche campos
    }
  }, [sp, name, busy])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const cleanCode = code.replace(/\D/g, '')
    if (cleanCode.length !== 6) {
      setErr('código tem 6 dígitos')
      return
    }
    if (!name.trim()) {
      setErr('digite um nome')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const r = await apiJson<JoinResp>('/api/lab/join', {
        method: 'POST',
        json: { code: cleanCode, display_name: name.trim() },
      })
      try {
        localStorage.setItem(ANON_KEY, r.anon_id)
        localStorage.setItem(NAME_KEY, r.display_name)
      } catch {
        /* quota cheia */
      }
      navigate(
        `/lab/session/${r.session_id}?role=player&name=${encodeURIComponent(r.display_name)}`,
        { replace: true },
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SlideShell>
      <div style={{ maxWidth: 420, margin: '0 auto', marginTop: 'var(--spacing-lab-6)' }}>
        <h1 style={{ fontSize: 'var(--text-lab-xl)', margin: 0 }}>Entrar na aula</h1>
        <p style={{ color: '#555B66', marginTop: 6 }}>Use o código que o professor mostrou.</p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, marginTop: 'var(--spacing-lab-5)' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#555B66' }}>código de 6 dígitos</span>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus={!code}
              required
              style={{
                padding: '12px 14px',
                border: '1px solid var(--color-lab-rule)',
                borderRadius: 10,
                fontSize: 28,
                fontFamily: 'var(--font-lab-mono, monospace)',
                textAlign: 'center',
                letterSpacing: 6,
                background: '#FFF',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#555B66' }}>seu nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              autoFocus={!!code}
              style={{
                padding: '10px 12px',
                border: '1px solid var(--color-lab-rule)',
                borderRadius: 8,
                fontSize: 15,
                background: '#FFF',
                fontFamily: 'inherit',
              }}
            />
          </label>

          {err && (
            <div
              style={{
                padding: '10px 12px',
                background: '#FAECE7',
                color: '#993C1D',
                borderRadius: 8,
                fontFamily: 'var(--font-lab-mono)',
                fontSize: 13,
              }}
            >
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-lab-accent)',
              color: '#FFF',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {busy ? 'entrando…' : 'entrar'}
          </button>
        </form>
      </div>
    </SlideShell>
  )
}
