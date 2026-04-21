/**
 * RegisterPage — cria conta de professor. Sucesso vai pra /teacher.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { SlideShell } from '../lab/components/SlideShell'
import { useAuth } from './AuthContext'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await register(email.trim(), password, displayName.trim())
      navigate('/teacher', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SlideShell>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'var(--text-lab-xl)', marginTop: 'var(--spacing-lab-6)' }}>
          Criar conta de professor
        </h1>
        <p style={{ color: '#555B66', marginTop: 4 }}>
          Alunos não têm conta — eles entram por código de sessão (Fase 5).
        </p>

        <form onSubmit={onSubmit} style={form}>
          <Field label="Nome (como aparece pros alunos)">
            <input
              type="text"
              required
              minLength={1}
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={input}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
          </Field>
          <Field label="Senha (mínimo 8)">
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
            />
          </Field>
          {err && <div style={errBox}>{err}</div>}
          <button type="submit" disabled={busy} style={primaryBtn}>
            {busy ? 'criando…' : 'Criar conta'}
          </button>
        </form>

        <div style={{ marginTop: 'var(--spacing-lab-5)', fontSize: 14, color: '#555B66' }}>
          Já tem conta?{' '}
          <Link to="/login" style={{ color: 'var(--color-lab-accent)' }}>
            Entrar
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

const form: React.CSSProperties = { display: 'grid', gap: 14, marginTop: 'var(--spacing-lab-5)' }
const input: React.CSSProperties = {
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
const errBox: React.CSSProperties = {
  padding: '10px 12px',
  background: '#FAECE7',
  color: '#993C1D',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'var(--font-lab-mono, monospace)',
}
