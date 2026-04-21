/**
 * /student/join — aluno entra numa turma com código + nome.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageShell } from '../../components/ui/PageShell'
import { useAuth } from '../auth/AuthContext'
import { apiJson } from '../lab/runtime/apiFetch'

interface JoinResp {
  classroom_id: string
  classroom_name: string
  access_token: string
  user_id: string
  display_name: string
}

export function StudentJoinPage() {
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [code, setCode] = useState(sp.get('code') ?? '')
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('labprof21:last_display_name') ?? ''
    } catch {
      return ''
    }
  })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6) return setErr('código tem 6 dígitos')
    if (!name.trim()) return setErr('digite um nome')
    setErr(null)
    setBusy(true)
    try {
      const r = await apiJson<JoinResp>('/api/classrooms/join', {
        method: 'POST',
        json: { code: clean, display_name: name.trim() },
      })
      logout()
      try {
        localStorage.setItem(
          'labprof21:auth',
          JSON.stringify({
            user: {
              id: r.user_id,
              email: null,
              display_name: r.display_name,
              role: 'student',
              created_at: new Date().toISOString(),
            },
            token: r.access_token,
          }),
        )
        localStorage.setItem('labprof21:last_display_name', r.display_name)
      } catch {
        /* quota */
      }
      navigate('/student', { replace: true })
      window.location.reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell variant="narrow">
      <Card padded>
        <h1 style={{ fontSize: 'var(--p21-text-xl)', margin: 0 }}>Entrar numa turma</h1>
        <p style={{ color: 'var(--p21-ink-3)', marginTop: 6 }}>
          Use o código que o professor passou. Sem senha — trocar de dispositivo cria um aluno novo.
        </p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, marginTop: 'var(--p21-sp-6)' }}>
          <Input
            label="código da turma"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoFocus={!code}
            required
            monospaceValue
            style={{ fontSize: 28, textAlign: 'center', letterSpacing: 6, height: 56, padding: '12px 14px' }}
          />
          <Input
            label="seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
            autoFocus={!!code}
            error={err}
          />
          <Button type="submit" disabled={busy} block size="lg">
            {busy ? 'entrando…' : 'Entrar na turma'}
          </Button>
        </form>

        <div style={{ marginTop: 'var(--p21-sp-5)', fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-3)' }}>
          É professor? <Link to="/login">entrar no painel</Link>
        </div>
      </Card>
    </PageShell>
  )
}
