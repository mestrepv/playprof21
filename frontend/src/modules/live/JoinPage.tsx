/**
 * /lesson/join — aluno entra em sessão ao vivo por código (fase 5).
 */

import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageShell } from '../../components/ui/PageShell'
import { apiJson } from '../lesson/runtime/apiFetch'

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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const cleanCode = code.replace(/\D/g, '')
    if (cleanCode.length !== 6) return setErr('código tem 6 dígitos')
    if (!name.trim()) return setErr('digite um nome')
    setErr(null)
    setBusy(true)
    try {
      const r = await apiJson<JoinResp>('/api/lesson/join', {
        method: 'POST',
        json: { code: cleanCode, display_name: name.trim() },
      })
      try {
        localStorage.setItem(ANON_KEY, r.anon_id)
        localStorage.setItem(NAME_KEY, r.display_name)
      } catch {
        /* quota */
      }
      navigate(
        `/lesson/session/${r.session_id}?role=player&name=${encodeURIComponent(r.display_name)}`,
        { replace: true },
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell variant="narrow">
      <Card padded>
        <h1 style={{ fontSize: 'var(--p21-text-xl)', margin: 0 }}>Entrar na aula ao vivo</h1>
        <p style={{ color: 'var(--p21-ink-3)', marginTop: 6 }}>
          Use o código que o professor mostrou.
        </p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, marginTop: 'var(--p21-sp-6)' }}>
          <Input
            label="código de 6 dígitos"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoFocus={!code}
            required
            monospaceValue
            style={{ fontSize: 28, textAlign: 'center', letterSpacing: 6, height: 56 }}
          />
          <Input
            label="seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus={!!code}
            error={err}
          />
          <Button type="submit" disabled={busy} block size="lg">
            {busy ? 'entrando…' : 'entrar'}
          </Button>
        </form>
      </Card>
    </PageShell>
  )
}
