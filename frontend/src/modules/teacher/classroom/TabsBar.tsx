/**
 * Pillbox segmented control com 4 tabs. Em mobile estreito (<480px), esconde
 * o label e mostra só o ícone pra caber na linha.
 */

import type { ReactNode } from 'react'

import { BoltIcon, ChartIcon, ChatIcon } from '../../../components/ui/icons'

export type Tab = 'feed' | 'trails' | 'lessons' | 'performance'

interface Props {
  active: Tab
  onChange: (t: Tab) => void
}

const TABS: Array<{ id: Tab; label: string; icon: () => ReactNode }> = [
  { id: 'feed', label: 'Feed', icon: () => <ChatIcon size={16} /> },
  { id: 'trails', label: 'Trilhas', icon: () => <BoltIcon size={16} /> },
  { id: 'lessons', label: 'Aulas', icon: () => <ChatIcon size={16} /> },
  { id: 'performance', label: 'Desempenho', icon: () => <ChartIcon size={16} /> },
]

export function TabsBar({ active, onChange }: Props) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 4,
        background: 'var(--p21-surface-2)',
        borderRadius: 'var(--p21-radius-md)',
        padding: 4,
        margin: 'var(--p21-sp-5) 0 var(--p21-sp-4)',
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px 12px',
              border: 'none',
              borderRadius: 10,
              background: isActive ? 'var(--p21-surface)' : 'transparent',
              color: isActive ? 'var(--p21-ink)' : 'var(--p21-ink-3)',
              boxShadow: isActive ? 'var(--p21-shadow-sm)' : 'none',
              fontSize: 'var(--p21-text-sm)',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
              minHeight: 40,
            }}
          >
            <span style={{ opacity: isActive ? 1 : 0.6, color: isActive ? 'var(--p21-blue)' : 'inherit', display: 'inline-flex' }}>
              {t.icon()}
            </span>
            <span className="p21-tab-label">{t.label}</span>
          </button>
        )
      })}
      <style>{`
        @media (max-width: 480px) {
          .p21-tab-label { display: none; }
        }
      `}</style>
    </div>
  )
}
