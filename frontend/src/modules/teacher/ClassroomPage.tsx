/**
 * /teacher/classroom/:id — página dedicada de uma turma.
 * Hero + stats cards clicáveis + tabs (Feed | Trilhas | Aulas | Desempenho).
 */

import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { AppShell } from '../../components/ui/AppShell'
import { useAuth } from '../auth/AuthContext'
import { apiJson } from '../lesson/runtime/apiFetch'
import { AssignmentsTab } from './classroom/AssignmentsTab'
import { FeedTab } from './classroom/FeedTab'
import { ClassroomHero } from './classroom/Hero'
import { PerformanceTab } from './classroom/PerformanceTab'
import { StatDrawer } from './classroom/StatDrawer'
import { StatsRow, type DrawerKind } from './classroom/StatsRow'
import { TabsBar, type Tab } from './classroom/TabsBar'
import type { Classroom, ClassroomStats } from './types'

export function ClassroomPage() {
  const { id } = useParams<{ id: string }>()
  const { user, token, logout, loading } = useAuth()
  if (loading) return <AppShell>carregando…</AppShell>
  if (!user || !token) return <Navigate to={`/login?next=/teacher/classroom/${id ?? ''}`} replace />
  if (!id) return <Navigate to="/teacher" replace />
  return <View classroomId={id} user={user} token={token} onLogout={logout} />
}

function View({
  classroomId,
  user,
  token,
  onLogout,
}: {
  classroomId: string
  user: { id: string; display_name: string; role: string }
  token: string
  onLogout: () => void
}) {
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [stats, setStats] = useState<ClassroomStats | null>(null)
  const [tab, setTab] = useState<Tab>('feed')
  const [drawer, setDrawer] = useState<DrawerKind | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    apiJson<Classroom>(`/api/classrooms/${classroomId}`, { token })
      .then(setClassroom)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [classroomId, token])

  // Stats recarregam quando drawer abre ou ao voltar pra Feed depois de mexer
  // em assignments (atribuir/remover muda total_activities).
  useEffect(() => {
    apiJson<ClassroomStats>(`/api/classrooms/${classroomId}/stats`, { token })
      .then(setStats)
      .catch(() => {})
  }, [classroomId, token, tab, drawer])

  const isOwner = Boolean(classroom && classroom.owner_id === user.id)

  void onLogout

  if (err) {
    return (
      <AppShell>
        <div style={errBox}>{err}</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      {classroom && (
        <ClassroomHero name={classroom.name} code={classroom.code} />
      )}
      <StatsRow stats={stats} onOpen={(k) => setDrawer(k)} />
      <TabsBar active={tab} onChange={setTab} />
      {tab === 'feed' && (
        <FeedTab
          classroomId={classroomId}
          token={token}
          currentUserId={user.id}
          currentUserName={user.display_name}
          isOwner={isOwner}
        />
      )}
      {tab === 'trails' && (
        <AssignmentsTab classroomId={classroomId} token={token} contentType="trail" />
      )}
      {tab === 'lessons' && (
        <AssignmentsTab classroomId={classroomId} token={token} contentType="interactive_lesson" />
      )}
      {tab === 'performance' && <PerformanceTab />}
      {drawer && (
        <StatDrawer
          classroomId={classroomId}
          token={token}
          stats={stats}
          kind={drawer}
          onClose={() => setDrawer(null)}
        />
      )}
    </AppShell>
  )
}

const errBox: React.CSSProperties = {
  padding: '14px 16px',
  background: 'var(--p21-coral-soft)',
  color: 'var(--p21-coral-ink)',
  borderRadius: 'var(--p21-radius-md)',
  fontFamily: 'var(--p21-font-mono)',
}
