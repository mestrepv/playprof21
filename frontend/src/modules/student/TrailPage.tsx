/**
 * /student/trail/:id — tela da trilha estilo Duolingo (versão stacked
 * vertical). Nós em sequência com status lock/available/completed + estrelas.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { SlideShell } from '../lab/components/SlideShell'
import { apiJson } from '../lab/runtime/apiFetch'
import type { NodeStatus, TrailProgress } from './types'

export function TrailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, token, loading } = useAuth()
  if (loading) return <SlideShell>carregando…</SlideShell>
  if (!user || !token) return <Navigate to="/student/join" replace />
  if (!id) return <Navigate to="/student" replace />
  return <TrailView trailId={id} token={token} />
}

function TrailView({ trailId, token }: { trailId: string; token: string }) {
  const [data, setData] = useState<TrailProgress | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    apiJson<TrailProgress>(`/api/student/trails/${trailId}`, { token })
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [trailId, token])
  useEffect(load, [load])

  if (err) return <SlideShell>erro: {err}</SlideShell>
  if (!data) return <SlideShell>carregando trilha…</SlideShell>

  const completed = data.nodes.filter((n) => n.status === 'completed').length

  return (
    <SlideShell>
      <header style={{ marginBottom: 'var(--spacing-lab-4)' }}>
        <Link to="/student" style={{ fontSize: 14, color: 'var(--color-lab-accent)' }}>
          ← minhas turmas
        </Link>
        <h1 style={{ fontSize: 'var(--text-lab-xl)', margin: '8px 0 4px' }}>{data.trail.title}</h1>
        {data.trail.description && <p style={{ color: '#555B66' }}>{data.trail.description}</p>}
        <div style={{ color: '#555B66', fontFamily: 'var(--font-lab-mono)', fontSize: 13 }}>
          {completed} / {data.nodes.length} concluída{completed === 1 ? '' : 's'}
        </div>
      </header>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 14, maxWidth: 560 }}>
        {data.nodes.map((node, i) => (
          <TrailNodeCard
            key={node.activity.id}
            node={node}
            index={i}
            displayIndex={i + 1}
          />
        ))}
      </ol>
    </SlideShell>
  )
}

function TrailNodeCard({
  node,
  index,
  displayIndex,
}: {
  node: TrailProgress['nodes'][number]
  index: number
  displayIndex: number
}) {
  const { status, stars, activity } = node
  const colors = STATUS_COLORS[status]
  const locked = status === 'locked'
  const completed = status === 'completed'

  const content = (
    <div
      style={{
        display: 'flex',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 14,
        border: `2px solid ${colors.border}`,
        background: colors.bg,
        color: locked ? '#8C93A1' : 'inherit',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          display: 'grid',
          placeItems: 'center',
          background: completed ? '#0F6E56' : colors.border,
          color: '#FFF',
          fontWeight: 700,
          fontFamily: 'var(--font-lab-mono)',
          flexShrink: 0,
        }}
        aria-hidden
      >
        {completed ? '✓' : locked ? '🔒' : displayIndex}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{activity.title}</div>
        <div style={{ fontSize: 12, color: '#555B66', fontFamily: 'var(--font-lab-mono)' }}>
          {activity.kind}
          {node.best_score !== null && node.best_max_score !== null && (
            <> · melhor: {node.best_score}/{node.best_max_score}</>
          )}
        </div>
      </div>
      {completed && <Stars n={stars} />}
      {!locked && !completed && (
        <span style={{ ...chip, background: '#EEEDFE', color: '#3C3489' }}>iniciar →</span>
      )}
      {locked && <span style={chip}>bloqueado</span>}
      {completed && <span style={{ ...chip, background: '#E1F5EE', color: '#085041', marginLeft: 6 }}>revisitar</span>}
    </div>
  )

  if (locked) return <li aria-disabled>{content}</li>
  return (
    <li>
      <Link
        to={`/student/activity/${encodeURIComponent(activity.id)}`}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        {content}
      </Link>
    </li>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <div aria-label={`${n} estrela${n === 1 ? '' : 's'}`} style={{ fontSize: 18, letterSpacing: 2, flexShrink: 0 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ color: i < n ? '#E8A53A' : '#D8D5CB' }}>
          ★
        </span>
      ))}
    </div>
  )
}

const chip: React.CSSProperties = {
  fontSize: 11,
  padding: '4px 8px',
  borderRadius: 6,
  fontFamily: 'var(--font-lab-mono)',
  background: '#F1EFE8',
  color: '#555B66',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  flexShrink: 0,
}

const STATUS_COLORS: Record<NodeStatus, { bg: string; border: string }> = {
  completed: { bg: '#F4FBF8', border: '#0F6E56' },
  available: { bg: '#FFFEF9', border: 'var(--color-lab-accent)' },
  locked: { bg: '#F5F5F0', border: '#D8D5CB' },
}
