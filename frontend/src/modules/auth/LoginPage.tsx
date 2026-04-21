/**
 * LoginPage — email + senha pro professor.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageShell } from '../../components/ui/PageShell'
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
    <PageShell variant="narrow">
      <Card padded>
        <h1 style={{ fontSize: 'var(--p21-text-xl)', margin: 0 }}>Entrar como professor</h1>
        <p style={{ color: 'var(--p21-ink-3)', marginTop: 6 }}>
          Conta do painel do labprof21.
        </p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, marginTop: 'var(--p21-sp-6)' }}>
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Senha"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={err}
          />
          <Button type="submit" disabled={busy} block size="lg">
            {busy ? 'entrando…' : 'Entrar'}
          </Button>
        </form>

        <div style={{ marginTop: 'var(--p21-sp-5)', fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-3)' }}>
          Novo por aqui?{' '}
          <Link to="/register">criar conta de professor</Link>
        </div>
        <div style={{ marginTop: 'var(--p21-sp-3)', fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-3)' }}>
          É aluno?{' '}
          <Link to="/student/join">entrar com código da turma</Link>
        </div>
      </Card>
    </PageShell>
  )
}
