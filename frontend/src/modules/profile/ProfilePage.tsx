/**
 * /profile — perfil básico do usuário logado. Dev-mode: display_name
 * editável, email read-only (prof), role badge. Upload de avatar e
 * troca de senha ficam pra iterações futuras.
 */

import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { AppShell } from '../../components/ui/AppShell'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../auth/AuthContext'
import type { AuthUser } from '../auth/types'
import { apiJson } from '../lab/runtime/apiFetch'

export function ProfilePage() {
  const { user, token, loading, refresh } = useAuth()
  if (loading) return <AppShell>carregando…</AppShell>
  if (!user || !token) return <Navigate to="/login?next=/profile" replace />
  return <ProfileForm user={user} token={token} refresh={refresh} />
}

function ProfileForm({
  user,
  token,
  refresh,
}: {
  user: AuthUser
  token: string
  refresh: () => Promise<void>
}) {
  const [name, setName] = useState(user.display_name)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const initials =
    user.display_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean || clean === user.display_name) return
    setBusy(true)
    setMsg(null)
    try {
      await apiJson<AuthUser>('/api/auth/me', {
        token,
        method: 'PATCH',
        json: { display_name: clean },
      })
      await refresh()
      setMsg({ kind: 'ok', text: 'nome atualizado' })
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell variant="narrow">
      <h1 style={{ fontSize: 'var(--p21-text-xl)', margin: '0 0 var(--p21-sp-5)' }}>Meu perfil</h1>

      <Card padded>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 'var(--p21-sp-5)',
            paddingBottom: 'var(--p21-sp-4)',
            borderBottom: '1px solid var(--p21-border)',
          }}
        >
          <div
            aria-hidden
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--p21-stat-blue), var(--p21-blue))',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--p21-text-md)', fontWeight: 600 }}>{user.display_name}</div>
            {user.email && (
              <div
                style={{
                  fontSize: 'var(--p21-text-sm)',
                  color: 'var(--p21-ink-3)',
                  fontFamily: 'var(--p21-font-mono)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.email}
              </div>
            )}
            <span style={roleBadge(user.role)}>{user.role}</span>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <Input
            label="nome que aparece pros alunos"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
            hint={user.role === 'student' ? 'é o nome que o professor vê na turma' : undefined}
          />
          {user.email && (
            <Input
              label="email"
              value={user.email}
              disabled
              hint="edição de email ainda não disponível"
            />
          )}
          {msg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--p21-radius-md)',
                background: msg.kind === 'ok' ? 'var(--p21-teal-soft)' : 'var(--p21-coral-soft)',
                color: msg.kind === 'ok' ? 'var(--p21-teal)' : 'var(--p21-coral-ink)',
                fontFamily: 'var(--p21-font-mono)',
                fontSize: 'var(--p21-text-sm)',
              }}
            >
              {msg.text}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" disabled={busy || !name.trim() || name.trim() === user.display_name}>
              {busy ? 'salvando…' : 'salvar'}
            </Button>
          </div>
        </form>
      </Card>

      <Card padded style={{ marginTop: 'var(--p21-sp-4)' }}>
        <h2 style={{ fontSize: 'var(--p21-text-md)', margin: '0 0 8px' }}>Conta</h2>
        <p style={{ color: 'var(--p21-ink-3)', fontSize: 'var(--p21-text-sm)', lineHeight: 1.55, margin: 0 }}>
          Upload de foto, troca de senha e exclusão de conta vão aparecer aqui em iterações futuras.
          Enquanto isso: display_name edita acima, email e role ficam como estão.
        </p>
      </Card>
    </AppShell>
  )
}

function roleBadge(role: string): React.CSSProperties {
  const palettes: Record<string, { bg: string; fg: string }> = {
    teacher: { bg: 'var(--p21-purple-soft)', fg: 'var(--p21-purple-ink)' },
    student: { bg: 'var(--p21-teal-soft)', fg: 'var(--p21-teal)' },
  }
  const p = palettes[role] ?? { bg: 'var(--p21-surface-2)', fg: 'var(--p21-ink-3)' }
  return {
    display: 'inline-block',
    marginTop: 8,
    padding: '2px 10px',
    borderRadius: 999,
    background: p.bg,
    color: p.fg,
    fontSize: 10,
    fontFamily: 'var(--p21-font-mono)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
}
