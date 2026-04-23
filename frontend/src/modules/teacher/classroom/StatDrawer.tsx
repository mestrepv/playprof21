/**
 * StatDrawer — drawer lateral (desktop) / bottom-sheet (mobile) com detalhe
 * do stat clicado. Conteúdo varia por `kind`:
 *
 *   students    — lista de alunos matriculados (só nome + data)
 *   activities  — total + breakdown por tipo
 *   attempts    — % + ranking por aluno
 *   energy      — soma total + ranking por aluno
 */

import { useEffect, useState } from 'react'

import { XIcon } from '../../../components/ui/icons'
import { apiJson } from '../../lesson/runtime/apiFetch'
import type { ClassroomStats, EnrollmentMember, StudentStat } from '../types'
import type { DrawerKind } from './StatsRow'

interface Props {
  classroomId: string
  token: string
  stats: ClassroomStats | null
  kind: DrawerKind
  onClose: () => void
}

export function StatDrawer({ classroomId, token, stats, kind, onClose }: Props) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,17,21,0.55)',
        zIndex: 80,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="p21-drawer-panel"
        style={{
          background: 'var(--p21-surface)',
          width: '100%',
          maxWidth: 480,
          minHeight: '60dvh',
          maxHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--p21-shadow-lg)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--p21-sp-4) var(--p21-sp-5)',
            borderBottom: '1px solid var(--p21-border)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 'var(--p21-text-lg)' }}>{TITLES[kind]}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="fechar"
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--p21-radius-sm)',
              background: 'transparent',
              color: 'var(--p21-ink-3)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <XIcon size={20} />
          </button>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--p21-sp-5)' }}>
          {kind === 'students' && <StudentsPanel classroomId={classroomId} token={token} />}
          {kind === 'activities' && <ActivitiesPanel stats={stats} />}
          {kind === 'attempts' && <AttemptsPanel classroomId={classroomId} token={token} stats={stats} />}
          {kind === 'energy' && <EnergyPanel classroomId={classroomId} token={token} stats={stats} />}
        </div>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .p21-drawer-panel {
            max-width: 100% !important;
            max-height: 85dvh;
            border-top-left-radius: 18px;
            border-top-right-radius: 18px;
            margin-top: auto;
          }
        }
      `}</style>
    </div>
  )
}

const TITLES: Record<DrawerKind, string> = {
  students: 'Participantes',
  activities: 'Atividades atribuídas',
  attempts: 'Tentativas',
  energy: 'Energia média',
}

// ── Painéis por tipo ─────────────────────────────────────────────────────

function StudentsPanel({ classroomId, token }: { classroomId: string; token: string }) {
  const [data, setData] = useState<EnrollmentMember[] | null>(null)
  useEffect(() => {
    apiJson<EnrollmentMember[]>(`/api/classrooms/${classroomId}/enrollments`, { token })
      .then(setData)
      .catch(() => setData([]))
  }, [classroomId, token])

  if (data === null) return <Muted>carregando…</Muted>
  if (data.length === 0) return <Muted>nenhum aluno matriculado ainda.</Muted>
  return (
    <ul style={listStyle}>
      {data.map((m) => (
        <li key={m.user_id} style={rowStyle}>
          <Avatar name={m.display_name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{m.display_name}</div>
            <div style={metaStyle}>entrou em {formatDate(m.joined_at)}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ActivitiesPanel({ stats }: { stats: ClassroomStats | null }) {
  if (!stats) return <Muted>carregando…</Muted>
  const pills = [
    { label: 'trilhas', value: stats.assignments_by_type.trail, tone: 'var(--p21-primary-ink)' },
    { label: 'aulas', value: stats.assignments_by_type.interactive_lesson, tone: 'var(--p21-purple)' },
    { label: 'atividades avulsas', value: stats.assignments_by_type.activity, tone: 'var(--p21-stat-blue)' },
  ]
  return (
    <div>
      <Big value={stats.total_activities} unit="total atribuído" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'var(--p21-sp-4)' }}>
        {pills.map((p) => (
          <span
            key={p.label}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              background: `color-mix(in srgb, ${p.tone} 12%, transparent)`,
              color: p.tone,
              fontSize: 'var(--p21-text-sm)',
              fontWeight: 600,
              fontFamily: 'var(--p21-font-mono)',
            }}
          >
            {p.value} {p.label}
          </span>
        ))}
      </div>
      <p style={{ marginTop: 'var(--p21-sp-5)', color: 'var(--p21-ink-3)', fontSize: 'var(--p21-text-sm)' }}>
        Conteúdo pro aluno consumir. Trilha conta como 1 atividade (contém N quizzes dentro).
      </p>
    </div>
  )
}

function AttemptsPanel({
  classroomId,
  token,
  stats,
}: {
  classroomId: string
  token: string
  stats: ClassroomStats | null
}) {
  const [rows, setRows] = useState<StudentStat[] | null>(null)
  useEffect(() => {
    apiJson<StudentStat[]>(`/api/classrooms/${classroomId}/stats/students`, { token })
      .then(setRows)
      .catch(() => setRows([]))
  }, [classroomId, token])

  return (
    <div>
      <Big value={stats ? `${stats.attempts_pct}%` : '…'} unit="do total tentado pelos alunos" />
      {stats && (
        <p style={{ marginTop: 8, color: 'var(--p21-ink-3)', fontSize: 'var(--p21-text-sm)' }}>
          {stats.attempts_total} de {stats.attempts_expected} tentativas possíveis cumpridas.
        </p>
      )}
      <h3 style={{ fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-3)', textTransform: 'uppercase', letterSpacing: 1, margin: '20px 0 8px' }}>
        por aluno
      </h3>
      {rows === null ? (
        <Muted>carregando…</Muted>
      ) : rows.length === 0 ? (
        <Muted>sem dados ainda.</Muted>
      ) : (
        <ul style={listStyle}>
          {[...rows]
            .sort((a, b) => b.attempts_pct - a.attempts_pct)
            .map((s) => (
              <li key={s.user_id} style={rowStyle}>
                <Avatar name={s.display_name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{s.display_name}</div>
                  <div style={metaStyle}>
                    {s.attempts_count}/{s.attempts_expected} concluídas
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--p21-font-mono)', fontWeight: 700 }}>
                  {s.attempts_pct}%
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

function EnergyPanel({
  classroomId,
  token,
  stats,
}: {
  classroomId: string
  token: string
  stats: ClassroomStats | null
}) {
  const [rows, setRows] = useState<StudentStat[] | null>(null)
  useEffect(() => {
    apiJson<StudentStat[]>(`/api/classrooms/${classroomId}/stats/students`, { token })
      .then(setRows)
      .catch(() => setRows([]))
  }, [classroomId, token])

  return (
    <div>
      <Big value={stats?.energy_total ?? '…'} unit="pontos totais somados" />
      <h3 style={{ fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-3)', textTransform: 'uppercase', letterSpacing: 1, margin: '20px 0 8px' }}>
        ranking por aluno
      </h3>
      {rows === null ? (
        <Muted>carregando…</Muted>
      ) : rows.length === 0 ? (
        <Muted>sem dados ainda.</Muted>
      ) : (
        <ul style={listStyle}>
          {rows.map((s, i) => (
            <li key={s.user_id} style={rowStyle}>
              <span style={rankStyle}>{i + 1}</span>
              <Avatar name={s.display_name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{s.display_name}</div>
                <div style={metaStyle}>{s.attempts_count} atividades</div>
              </div>
              <div
                style={{
                  fontFamily: 'var(--p21-font-mono)',
                  fontWeight: 700,
                  color: 'var(--p21-primary-ink)',
                }}
              >
                {s.energy}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── UI helpers ────────────────────────────────────────────────────────────

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, var(--p21-stat-blue), var(--p21-blue))`,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: size < 32 ? 11 : 13,
        letterSpacing: 0.5,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: 'var(--p21-ink-3)', fontSize: 'var(--p21-text-sm)', fontFamily: 'var(--p21-font-mono)' }}>
      {children}
    </div>
  )
}

function Big({ value, unit }: { value: number | string; unit: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--p21-text-2xl)', fontWeight: 700, fontFamily: 'var(--p21-font-display)' }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-3)' }}>{unit}</div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 8,
}
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  borderRadius: 'var(--p21-radius-md)',
  border: '1px solid var(--p21-border)',
  background: 'var(--p21-surface)',
}
const metaStyle: React.CSSProperties = {
  fontSize: 'var(--p21-text-xs)',
  color: 'var(--p21-ink-3)',
  fontFamily: 'var(--p21-font-mono)',
}
const rankStyle: React.CSSProperties = {
  width: 24,
  textAlign: 'center',
  fontFamily: 'var(--p21-font-mono)',
  color: 'var(--p21-ink-3)',
  fontWeight: 700,
}
