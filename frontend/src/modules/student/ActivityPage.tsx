/**
 * /student/activity/:id — executa uma activity do banco.
 *
 * Carrega via `/api/student/activities/{id}` (autoriza por enrollment).
 * Despacha pro ActivityRunner; onComplete → POST activity-results → back.
 *
 * `?trail=:tid` no query opcional pra saber pra onde voltar; se ausente,
 * volta pra /student.
 */

import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { SlideShell } from '../lab/components/SlideShell'
import { apiJson } from '../lab/runtime/apiFetch'
import type { Activity } from '../teacher/types'
import { ActivityRunner } from './activities/ActivityRunner'

export function ActivityPage() {
  const { id } = useParams<{ id: string }>()
  const [sp] = useSearchParams()
  const trailId = sp.get('trail')
  const { user, token, loading } = useAuth()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id || !token) return
    apiJson<Activity>(`/api/student/activities/${id}`, { token })
      .then(setActivity)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [id, token])

  const onComplete = useCallback(
    async (score: number) => {
      if (!activity || !token || saving) return
      setSaving(true)
      try {
        await apiJson('/api/student/activity-results', {
          token,
          method: 'POST',
          json: {
            activity_id: activity.id,
            score,
            max_score: activity.max_score,
          },
        })
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
        setSaving(false)
        return
      }
      navigate(trailId ? `/student/trail/${trailId}` : '/student', { replace: true })
    },
    [activity, token, navigate, trailId, saving],
  )

  if (loading) return <SlideShell>carregando…</SlideShell>
  if (!user || !token) return <Navigate to="/student/join" replace />
  if (!id) return <Navigate to="/student" replace />
  if (err) return <SlideShell>erro: {err}</SlideShell>
  if (!activity) return <SlideShell>carregando atividade…</SlideShell>

  return (
    <SlideShell>
      <button
        onClick={() => navigate(trailId ? `/student/trail/${trailId}` : '/student')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-lab-accent)',
          fontSize: 14,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 14,
        }}
      >
        ← voltar
      </button>
      <ActivityRunner activity={activity} onComplete={onComplete} />
      {saving && <div style={{ marginTop: 12, color: '#555B66' }}>gravando resultado…</div>}
    </SlideShell>
  )
}
