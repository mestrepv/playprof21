/**
 * RegisterPage — criação de conta de professor.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageShell } from '../../components/ui/PageShell'
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
    <PageShell variant="narrow">
      <Card padded>
        <h1 style={{ fontSize: 'var(--p21-text-xl)', margin: 0 }}>Criar conta de professor</h1>
        <p style={{ color: 'var(--p21-ink-3)', marginTop: 6 }}>
          Alunos não têm conta — eles entram por código da turma.
        </p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, marginTop: 'var(--p21-sp-6)' }}>
          <Input
            label="Nome (como aparece pros alunos)"
            type="text"
            required
            minLength={1}
            maxLength={120}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="mínimo 8 caracteres"
            error={err}
          />
          <Button type="submit" disabled={busy} block size="lg">
            {busy ? 'criando…' : 'Criar conta'}
          </Button>
        </form>

        <div style={{ marginTop: 'var(--p21-sp-5)', fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-3)' }}>
          Já tem conta? <Link to="/login">entrar</Link>
        </div>
      </Card>
    </PageShell>
  )
}
