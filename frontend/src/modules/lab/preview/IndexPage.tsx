/**
 * Lista de aulas — GET /api/lab/games. Cada aula linka pra /lab/preview/:slug.
 *
 * Também carrega o smoke de health (herdado da Fase 1) como sanity rodapé —
 * assim abrir a raiz em dev continua sendo um atalho pro status do stack.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../auth/AuthContext'
import { SlideShell } from '../components/SlideShell'
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
    fetch(`${API_URL}/api/lab/games`)
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

  return (
    <SlideShell>
      <header
        style={{
          marginBottom: 'var(--spacing-lab-5, 2rem)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-lab-2xl)', margin: 0 }}>labprof21</h1>
          <p style={{ color: '#555B66', marginTop: 4 }}>
            Aulas interativas síncronas · preview de conteúdo
          </p>
        </div>
        <nav style={{ display: 'flex', gap: 14, fontSize: 14, flexWrap: 'wrap' }}>
          {user ? (
            <Link
              to={user.role === 'student' ? '/student' : '/teacher'}
              style={{ color: 'var(--color-lab-accent)' }}
            >
              painel ({user.display_name})
            </Link>
          ) : (
            <>
              <Link to="/student/join" style={{ color: 'var(--color-lab-accent)' }}>
                entrar como aluno
              </Link>
              <span style={{ color: '#D8D5CB' }}>·</span>
              <Link to="/login" style={{ color: 'var(--color-lab-accent)' }}>
                professor
              </Link>
              <Link to="/register" style={{ color: 'var(--color-lab-accent)' }}>
                criar conta
              </Link>
            </>
          )}
        </nav>
      </header>

      <h2 style={{ fontSize: 'var(--text-lab-lg)' }}>Aulas disponíveis</h2>

      {err && (
        <div style={{ color: '#993C1D', fontFamily: 'var(--font-lab-mono)' }}>
          erro carregando lista: {err}
        </div>
      )}
      {!err && games === null && (
        <div style={{ color: '#555B66', fontFamily: 'var(--font-lab-mono)' }}>carregando…</div>
      )}
      {games && games.length === 0 && (
        <div style={{ color: '#555B66' }}>
          nenhuma aula em <code>backend/modules/lab/games_content/</code>
        </div>
      )}
      {games && games.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 'var(--spacing-lab-4)' }}>
          {games.map((g) => (
            <li
              key={g.slug}
              style={{
                marginBottom: 12,
                padding: '14px 18px',
                border: '1px solid var(--color-lab-rule, #D8D5CB)',
                borderRadius: 12,
                background: '#FFFEF9',
              }}
            >
              <Link
                to={`/lab/preview/${encodeURIComponent(g.slug)}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontSize: 'var(--text-lab-md)', fontWeight: 500 }}>{g.title}</div>
                <div
                  style={{
                    marginTop: 4,
                    color: '#555B66',
                    fontSize: 'var(--text-lab-sm)',
                    fontFamily: 'var(--font-lab-mono)',
                  }}
                >
                  {g.subject ? `${g.subject} · ` : ''}
                  {g.slideCount} slides · v{g.version} · <code>{g.slug}</code>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer
        style={{
          marginTop: 'var(--spacing-lab-7, 3rem)',
          paddingTop: 'var(--spacing-lab-4)',
          borderTop: '1px dashed var(--color-lab-rule, #D8D5CB)',
          color: '#555B66',
          fontFamily: 'var(--font-lab-mono)',
          fontSize: 12,
        }}
      >
        API {API_URL} · db {health?.db ? 'ok' : '…'} · {health?.status ?? '…'}
      </footer>
    </SlideShell>
  )
}
