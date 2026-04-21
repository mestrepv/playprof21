/**
 * /student/trail/:id — runner linear da trilha. Dentro da trilha a
 * execução é sequencial (atividade 1 → 2 → ... → resumo).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AppShell } from '../../components/ui/AppShell'
import { useAuth } from '../auth/AuthContext'
import { apiJson } from '../lab/runtime/apiFetch'
import { ActivityRunner } from './activities/ActivityRunner'
import type { TrailProgress } from './types'

export function TrailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, token, loading } = useAuth()
  if (loading) return <AppShell>carregando…</AppShell>
  if (!user || !token) return <Navigate to="/student/join" replace />
  if (!id) return <Navigate to="/student" replace />
  return <TrailRunner trailId={id} token={token} />
}

function TrailRunner({ trailId, token }: { trailId: string; token: string }) {
  const [data, setData] = useState<TrailProgress | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [idx, setIdx] = useState<number>(0)
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)

  const refetch = useCallback(
    async (opts?: { resetIdx?: boolean }) => {
      try {
        const p = await apiJson<TrailProgress>(`/api/student/trails/${trailId}`, { token })
        setData(p)
        if (opts?.resetIdx) {
          const firstPending = p.nodes.findIndex((n) => n.best_score === null)
          setIdx(firstPending < 0 ? 0 : firstPending)
          setFinished(false)
        }
        return p
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
        return null
      }
    },
    [trailId, token],
  )

  useEffect(() => {
    refetch({ resetIdx: true })
  }, [refetch])

  const current = useMemo(() => (data ? data.nodes[idx] : null), [data, idx])
  const total = data?.nodes.length ?? 0

  const onComplete = useCallback(
    async (score: number) => {
      if (!current || !data || saving) return
      setSaving(true)
      try {
        await apiJson('/api/student/activity-results', {
          token,
          method: 'POST',
          json: {
            activity_id: current.activity.id,
            score,
            max_score: current.activity.max_score,
          },
        })
        const fresh = await refetch()
        if (!fresh) {
          setSaving(false)
          return
        }
        if (idx + 1 >= fresh.nodes.length) {
          setFinished(true)
        } else {
          setIdx(idx + 1)
        }
      } finally {
        setSaving(false)
      }
    },
    [current, data, token, idx, refetch, saving],
  )

  if (err) {
    return (
      <AppShell>
        <Card>
          <div style={{ color: 'var(--p21-coral-ink)' }}>erro: {err}</div>
        </Card>
      </AppShell>
    )
  }
  if (!data) return <AppShell>carregando trilha…</AppShell>
  if (total === 0) {
    return (
      <AppShell>
        <Card>
          <h1 style={{ fontSize: 'var(--p21-text-xl)' }}>{data.trail.title}</h1>
          <p style={{ color: 'var(--p21-ink-3)' }}>Essa trilha ainda não tem atividades.</p>
          <Button as="a" href="/student" variant="outline" size="sm">
            ← voltar
          </Button>
        </Card>
      </AppShell>
    )
  }

  if (finished) {
    return <TrailFinishedScreen progress={data} onRestart={() => refetch({ resetIdx: true })} />
  }

  return (
    <AppShell variant="reading">
      <TrailHeader
        title={data.trail.title}
        current={idx + 1}
        total={total}
        stars={data.stars}
      />
      {current && (
        <Card padded style={{ marginTop: 'var(--p21-sp-5)' }}>
          <ActivityRunner
            key={current.activity.id}
            activity={current.activity}
            onComplete={onComplete}
          />
          {saving && <div style={{ marginTop: 12, color: 'var(--p21-ink-3)' }}>gravando resultado…</div>}
        </Card>
      )}
    </AppShell>
  )
}

function TrailHeader({
  title,
  current,
  total,
  stars,
}: {
  title: string
  current: number
  total: number
  stars: number
}) {
  const pct = Math.round(((current - 1) / total) * 100)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 'var(--p21-text-lg)', margin: 0, flex: 1, minWidth: 200 }}>{title}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div aria-label={`${stars} estrelas`} style={{ letterSpacing: 2, fontSize: 20 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ color: i < stars ? 'var(--p21-amber)' : '#d8d5cb' }}>
                ★
              </span>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--p21-font-mono)', fontSize: 14, color: 'var(--p21-ink-3)' }}>
            {current} / {total}
          </span>
        </div>
      </div>
      <div style={progressBg}>
        <div style={{ ...progressFill, width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TrailFinishedScreen({
  progress,
  onRestart,
}: {
  progress: TrailProgress
  onRestart: () => void
}) {
  const acertos = progress.nodes.filter(
    (n) => n.best_score !== null && n.best_max_score !== null && n.best_score >= n.best_max_score,
  ).length
  return (
    <AppShell variant="narrow">
      <Card padded style={{ textAlign: 'center', padding: 'var(--p21-sp-8)' }}>
        <div style={{ fontSize: 72, marginBottom: 'var(--p21-sp-3)', lineHeight: 1 }} aria-hidden>
          🎉
        </div>
        <h1 style={{ fontSize: 'var(--p21-text-2xl)', margin: 0 }}>Trilha concluída</h1>
        <p style={{ color: 'var(--p21-ink-3)', marginTop: 8 }}>{progress.trail.title}</p>
        <div
          style={{
            fontSize: 64,
            letterSpacing: 8,
            margin: 'var(--p21-sp-6) 0 var(--p21-sp-4)',
            lineHeight: 1,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ color: i < progress.stars ? 'var(--p21-amber)' : '#d8d5cb' }}>
              ★
            </span>
          ))}
        </div>
        <div
          style={{
            color: 'var(--p21-ink-3)',
            fontFamily: 'var(--p21-font-mono)',
            fontSize: 'var(--p21-text-sm)',
          }}
        >
          {acertos} de {progress.nodes.length} atividade{progress.nodes.length === 1 ? '' : 's'} com acerto pleno
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            marginTop: 'var(--p21-sp-7)',
            flexWrap: 'wrap',
          }}
        >
          <Button as="a" href="/student" variant="primary" size="lg">
            voltar pras trilhas
          </Button>
          <Button onClick={onRestart} variant="outline" size="lg">
            refazer trilha
          </Button>
        </div>
      </Card>
    </AppShell>
  )
}

const progressBg: React.CSSProperties = {
  height: 10,
  borderRadius: 'var(--p21-radius-pill)',
  background: 'var(--p21-surface-2)',
  marginTop: 'var(--p21-sp-3)',
  overflow: 'hidden',
}
const progressFill: React.CSSProperties = {
  height: '100%',
  background: 'var(--p21-primary)',
  transition: 'width 0.3s ease',
  borderRadius: 'inherit',
}
