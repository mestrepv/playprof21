/**
 * /student/trail/:id — runner linear da trilha.
 *
 * Dentro da trilha a execução é sequencial: aluno faz atividade 1, depois 2,
 * depois 3. A "árvore Duolingo" dos nós acontece um nível acima, entre
 * trilhas da mesma turma (ver StudentDashboard).
 *
 * Estado:
 *   - `idx` = atividade atual (inicialmente a primeira sem `best_score`).
 *     Se todas têm best_score ao carregar, começa do zero pra revisitar.
 *   - `finished` = true quando o aluno passou pela última e viu o resumo.
 *
 * Grava ActivityResult a cada atividade; refetch do TrailProgress atualiza
 * stars agregadas pra mostrar no resumo.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { SlideShell } from '../lab/components/SlideShell'
import { apiJson } from '../lab/runtime/apiFetch'
import { ActivityRunner } from './activities/ActivityRunner'
import type { TrailProgress } from './types'

export function TrailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, token, loading } = useAuth()
  if (loading) return <SlideShell>carregando…</SlideShell>
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
          // primeira atividade sem best_score; se todas têm, começa do zero.
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
        // Refetch pra pegar stars agregadas atualizadas; avança ou termina.
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

  if (err) return <SlideShell>erro: {err}</SlideShell>
  if (!data) return <SlideShell>carregando trilha…</SlideShell>
  if (total === 0) {
    return (
      <SlideShell>
        <h1 style={{ fontSize: 'var(--text-lab-xl)' }}>{data.trail.title}</h1>
        <p style={{ color: '#555B66' }}>Essa trilha ainda não tem atividades.</p>
        <Link to="/student" style={{ color: 'var(--color-lab-accent)' }}>
          ← voltar
        </Link>
      </SlideShell>
    )
  }

  if (finished) {
    return <TrailFinishedScreen progress={data} onRestart={() => refetch({ resetIdx: true })} />
  }

  return (
    <SlideShell>
      <TrailHeader
        title={data.trail.title}
        current={idx + 1}
        total={total}
        stars={data.stars}
      />
      {current && (
        <div style={{ marginTop: 'var(--spacing-lab-4)' }}>
          <ActivityRunner
            key={current.activity.id}  // remount zera estado do runner
            activity={current.activity}
            onComplete={onComplete}
          />
          {saving && <div style={{ marginTop: 12, color: '#555B66' }}>gravando resultado…</div>}
        </div>
      )}
    </SlideShell>
  )
}

// ── Header / progress bar ─────────────────────────────────────────────────

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
      <Link to="/student" style={{ fontSize: 14, color: 'var(--color-lab-accent)' }}>
        ← sair da trilha
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 'var(--text-lab-lg)', margin: 0, flex: 1 }}>{title}</h1>
        <StarBar n={stars} />
        <span style={counter}>
          {current} / {total}
        </span>
      </div>
      <div style={progressBg}>
        <div style={{ ...progressFill, width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StarBar({ n }: { n: number }) {
  return (
    <div aria-label={`${n} estrela${n === 1 ? '' : 's'}`} style={{ fontSize: 20, letterSpacing: 2 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ color: i < n ? '#E8A53A' : '#D8D5CB' }}>
          ★
        </span>
      ))}
    </div>
  )
}

// ── Tela de resumo ────────────────────────────────────────────────────────

function TrailFinishedScreen({
  progress,
  onRestart,
}: {
  progress: TrailProgress
  onRestart: () => void
}) {
  const acertos = progress.nodes.filter((n) => n.best_score !== null && n.best_max_score !== null && n.best_score >= n.best_max_score).length
  return (
    <SlideShell>
      <div style={{ maxWidth: 560, margin: '40px auto 0', textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 20 }} aria-hidden>🎉</div>
        <h1 style={{ fontSize: 'var(--text-lab-2xl)', margin: 0 }}>Trilha concluída</h1>
        <p style={{ color: '#555B66', marginTop: 8 }}>{progress.trail.title}</p>
        <div style={{ fontSize: 56, letterSpacing: 8, margin: '28px 0' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ color: i < progress.stars ? '#E8A53A' : '#D8D5CB' }}>
              ★
            </span>
          ))}
        </div>
        <div style={{ color: '#555B66', fontFamily: 'var(--font-lab-mono)' }}>
          {acertos} de {progress.nodes.length} atividade{progress.nodes.length === 1 ? '' : 's'} com acerto pleno
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
          <Link
            to="/student"
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-lab-accent)',
              color: '#FFF',
              fontSize: 15,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            voltar pras trilhas
          </Link>
          <button
            onClick={onRestart}
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: '1px solid var(--color-lab-rule)',
              background: '#FFF',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 15,
            }}
          >
            refazer trilha
          </button>
        </div>
      </div>
    </SlideShell>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────

const counter: React.CSSProperties = {
  fontFamily: 'var(--font-lab-mono)',
  fontSize: 14,
  color: '#555B66',
}
const progressBg: React.CSSProperties = {
  height: 8,
  borderRadius: 4,
  background: '#F1EFE8',
  marginTop: 12,
  overflow: 'hidden',
}
const progressFill: React.CSSProperties = {
  height: '100%',
  background: 'var(--color-lab-accent)',
  transition: 'width 0.3s ease',
}
