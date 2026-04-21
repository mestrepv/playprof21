/**
 * LoginPage — email + senha. Sucesso redireciona pra /teacher (ou `?next`).
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { SlideShell } from '../lab/components/SlideShell'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const next = sp.get('next') ?? '/teacher'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate(next, { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SlideShell>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'var(--text-lab-xl)', marginTop: 'var(--spacing-lab-6)' }}>Entrar</h1>
        <p style={{ color: '#555B66', marginTop: 4 }}>Acesso de professor.</p>

        <form onSubmit={onSubmit} style={formStyle}>
          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </Field>
          {err && <div style={errStyle}>{err}</div>}
          <button type="submit" disabled={busy} style={primaryBtn}>
            {busy ? 'entrando…' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: 'var(--spacing-lab-5)', fontSize: 14, color: '#555B66' }}>
          Ainda não tem conta?{' '}
          <Link to="/register" style={{ color: 'var(--color-lab-accent)' }}>
            Criar conta de professor
          </Link>
        </div>
      </div>
    </SlideShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 13, color: '#555B66' }}>{label}</span>
      {children}
    </label>
  )
}

const formStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  marginTop: 'var(--spacing-lab-5)',
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid var(--color-lab-rule, #D8D5CB)',
  borderRadius: 8,
  fontSize: 15,
  fontFamily: 'inherit',
  background: '#FFF',
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--color-lab-accent, #5B2DB8)',
  color: '#FFF',
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const errStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: '#FAECE7',
  color: '#993C1D',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'var(--font-lab-mono, monospace)',
}
