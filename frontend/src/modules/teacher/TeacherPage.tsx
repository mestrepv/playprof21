/**
 * /teacher — lista de turmas do professor.
 *
 * Cada turma é um card clicável que leva pra `/teacher/classroom/:id`.
 * Criação de turma inline no topo. Sem expand inline — o detalhe vive
 * na página dedicada.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppShell } from '../../components/ui/AppShell'
import { PlusIcon } from '../../components/ui/icons'
import { useAuth } from '../auth/AuthContext'
import { apiJson } from '../lab/runtime/apiFetch'
import type { Classroom } from './types'

export function TeacherPage() {
  const { user, token, logout, loading } = useAuth()
  if (loading) return <AppShell>carregando…</AppShell>
  if (!user || !token) return <Navigate to="/login?next=/teacher" replace />
  return <Dashboard token={token} displayName={user.display_name} onLogout={logout} />
}

function Dashboard({
  token,
  displayName,
  onLogout,
}: {
  token: string
  displayName: string
  onLogout: () => void
}) {
  const [classrooms, setClassrooms] = useState<Classroom[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiJson<Classroom[]>('/api/classrooms', { token })
      .then(setClassrooms)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [token])

  useEffect(load, [load])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    try {
      const c = await apiJson<Classroom>('/api/classrooms', {
        token,
        method: 'POST',
        json: { name: newName.trim() },
      })
      setClassrooms((prev) => [c, ...(prev ?? [])])
      setNewName('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // Navegação e logout agora moram na sidebar + dropdown do avatar (AppShell).
  void displayName
  void onLogout

  return (
    <AppShell>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 'var(--p21-sp-4)',
        }}
      >
        <h1 style={{ fontSize: 'var(--p21-text-xl)', margin: 0 }}>Minhas turmas</h1>
      </div>

      {err && <div style={errBox}>{err}</div>}

      <form
        onSubmit={create}
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 'var(--p21-sp-5)',
          maxWidth: 520,
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="nome da turma (ex: 2PGN)"
          maxLength={160}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '2px solid var(--p21-border-strong)',
            borderRadius: 'var(--p21-radius-md)',
            fontSize: 16,
            fontFamily: 'inherit',
            background: 'var(--p21-surface)',
            minHeight: 'var(--p21-tap)',
          }}
        />
        <Button type="submit" disabled={busy || !newName.trim()} size="md">
          <PlusIcon size={16} /> criar
        </Button>
      </form>

      {classrooms === null && <Muted>carregando…</Muted>}
      {classrooms && classrooms.length === 0 && (
        <Card>
          <div style={{ color: 'var(--p21-ink-3)', textAlign: 'center', padding: 'var(--p21-sp-4)' }}>
            Você ainda não tem turmas. Crie uma acima pra começar.
          </div>
        </Card>
      )}

      {classrooms && classrooms.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {classrooms.map((c) => (
            <li key={c.id}>
              <Link
                to={`/teacher/classroom/${c.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <Card interactive>
                  <div style={{ fontSize: 'var(--p21-text-md)', fontWeight: 600 }}>{c.name}</div>
                  <div
                    style={{
                      marginTop: 6,
                      color: 'var(--p21-ink-3)',
                      fontSize: 'var(--p21-text-sm)',
                      fontFamily: 'var(--p21-font-mono)',
                    }}
                  >
                    código <strong style={{ color: 'var(--p21-blue)' }}>{c.code ?? '—'}</strong>
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      color: 'var(--p21-blue)',
                      fontSize: 'var(--p21-text-sm)',
                      fontWeight: 500,
                    }}
                  >
                    abrir turma →
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: 'var(--p21-ink-3)', fontFamily: 'var(--p21-font-mono)', fontSize: 'var(--p21-text-sm)' }}>
      {children}
    </div>
  )
}

const errBox: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--p21-coral-soft)',
  color: 'var(--p21-coral-ink)',
  borderRadius: 'var(--p21-radius-md)',
  fontFamily: 'var(--p21-font-mono)',
  fontSize: 'var(--p21-text-sm)',
  marginBottom: 'var(--p21-sp-4)',
}
