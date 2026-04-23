/**
 * Landing/home pública do labprof21. Lista as aulas interativas disponíveis
 * em `games_content/` e oferece caminhos de entrada (aluno via código,
 * professor via login/register).
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { PageShell } from '../../../components/ui/PageShell'
import { useAuth } from '../../auth/AuthContext'
import { apiUrl } from '../runtime/apiUrl'

const API_URL = apiUrl()

interface GameSummary {
  slug: string
  title: string
  subject?: string | null
  version: number
  slideCount: number
}

interface Health {
  status: string
  db: boolean
  db_error?: string
}

export function IndexPage() {
  const { user } = useAuth()
  const [games, setGames] = useState<GameSummary[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/lesson/games`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ games: GameSummary[]; errors: string[] }>
      })
      .then((p) => setGames(p.games))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error', db: false }))
  }, [])

  const nav = user ? (
    <Button as="a" href={user.role === 'student' ? '/student' : '/teacher'} variant="outline" size="sm">
      {user.display_name} →
    </Button>
  ) : (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button as="a" href="/student/join" variant="primary" size="sm">
        entrar como aluno
      </Button>
      <Button as="a" href="/login" variant="ghost" size="sm">
        professor
      </Button>
    </div>
  )

  return (
    <PageShell headerRight={nav}>
      <section style={{ marginBottom: 'var(--p21-sp-8)' }}>
        <h1
          style={{
            fontSize: 'var(--p21-text-3xl)',
            margin: 0,
            fontFamily: 'var(--p21-font-display)',
          }}
        >
          Aulas interativas <span style={{ color: 'var(--p21-primary)' }}>do prof21</span>
        </h1>
        <p style={{ color: 'var(--p21-ink-3)', marginTop: 'var(--p21-sp-3)', maxWidth: 560 }}>
          Síncrono ao vivo ou assíncrono em trilhas. Entre com o código da sua
          turma; professores montam conteúdo no painel.
        </p>
      </section>

      <h2 style={{ fontSize: 'var(--p21-text-lg)', marginBottom: 'var(--p21-sp-4)' }}>
        Aulas disponíveis pra preview
      </h2>

      {err && (
        <Card>
          <div style={{ color: 'var(--p21-coral-ink)', fontFamily: 'var(--p21-font-mono)' }}>
            erro carregando lista: {err}
          </div>
        </Card>
      )}
      {!err && games === null && (
        <div style={{ color: 'var(--p21-ink-3)', fontFamily: 'var(--p21-font-mono)' }}>carregando…</div>
      )}
      {games && games.length === 0 && (
        <Card>
          <div style={{ color: 'var(--p21-ink-3)' }}>
            nenhuma aula em <code>backend/modules/lesson/games_content/</code>
          </div>
        </Card>
      )}
      {games && games.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: 'var(--p21-sp-3)',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {games.map((g) => (
            <li key={g.slug}>
              <Link
                to={`/lesson/preview/${encodeURIComponent(g.slug)}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <Card interactive>
                  <div style={{ fontSize: 'var(--p21-text-md)', fontWeight: 600 }}>{g.title}</div>
                  <div
                    style={{
                      marginTop: 6,
                      color: 'var(--p21-ink-3)',
                      fontSize: 'var(--p21-text-sm)',
                      fontFamily: 'var(--p21-font-mono)',
                    }}
                  >
                    {g.subject ? `${g.subject} · ` : ''}
                    {g.slideCount} slides · v{g.version}
                  </div>
                  <div style={{ marginTop: 12, color: 'var(--p21-blue)', fontSize: 'var(--p21-text-sm)', fontWeight: 500 }}>
                    abrir preview →
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer
        style={{
          marginTop: 'var(--p21-sp-9)',
          paddingTop: 'var(--p21-sp-5)',
          borderTop: '1px dashed var(--p21-border)',
          color: 'var(--p21-ink-4)',
          fontFamily: 'var(--p21-font-mono)',
          fontSize: 12,
        }}
      >
        API {API_URL} · db {health?.db ? 'ok' : '…'} · {health?.status ?? '…'}
      </footer>
    </PageShell>
  )
}
