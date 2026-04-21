/**
 * StatsRow — 4 cards clicáveis em grid responsivo.
 * Cada card tem ícone colorido + valor grande + label. Click dispara
 * `onOpen('students'|'activities'|'attempts'|'energy')`.
 */

import type { ReactNode } from 'react'
import { BoltIcon, ChartIcon, PulseIcon, UsersIcon } from '../../../components/ui/icons'
import type { ClassroomStats } from '../types'

export type DrawerKind = 'students' | 'activities' | 'attempts' | 'energy'

interface Props {
  stats: ClassroomStats | null
  onOpen: (kind: DrawerKind) => void
}

export function StatsRow({ stats, onOpen }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
        position: 'relative',
        zIndex: 1,
        marginBottom: 'var(--p21-sp-5)',
      }}
    >
      <StatCard
        color="var(--p21-stat-blue)"
        icon={<UsersIcon size={20} />}
        value={stats?.total_students}
        label="Alunos"
        onClick={() => onOpen('students')}
      />
      <StatCard
        color="var(--p21-purple)"
        icon={<BoltIcon size={20} />}
        value={stats?.total_activities}
        label="Atividades"
        onClick={() => onOpen('activities')}
      />
      <StatCard
        color="var(--p21-stat-pink)"
        icon={<PulseIcon size={20} />}
        value={stats ? `${stats.attempts_pct}%` : undefined}
        label="Tentativas"
        onClick={() => onOpen('attempts')}
      />
      <StatCard
        color="var(--p21-primary)"
        icon={<ChartIcon size={20} />}
        value={stats?.energy_total}
        label="Energia média"
        onClick={() => onOpen('energy')}
      />
    </div>
  )
}

function StatCard({
  color,
  icon,
  value,
  label,
  onClick,
}: {
  color: string
  icon: ReactNode
  value: number | string | undefined
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'var(--p21-surface)',
        border: '1px solid var(--p21-border)',
        borderRadius: 'var(--p21-radius-md)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: 'var(--p21-shadow-sm)',
        transition: 'border-color 0.15s, background 0.15s',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        color: 'var(--p21-ink)',
        width: '100%',
        minHeight: 72,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--p21-border-strong)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--p21-border)'
      }}
    >
      <span
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 'var(--p21-text-lg)', fontWeight: 700, lineHeight: 1.1 }}>
          {value === undefined ? '…' : value}
        </span>
        <span
          style={{
            fontSize: 'var(--p21-text-xs)',
            color: 'var(--p21-ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginTop: 2,
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      </span>
    </button>
  )
}
