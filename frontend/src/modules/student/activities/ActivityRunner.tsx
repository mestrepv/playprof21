/**
 * ActivityRunner — despacha pro renderer certo por `Activity.kind`.
 *
 * Fase 7 implementa `quiz` de verdade. `external-link` abre a URL numa aba
 * nova e marca como completo manualmente. `simulator`/`animation` ficam com
 * placeholder até o registry TSX entrar numa fase seguinte.
 */

import { useState } from 'react'
import type { Activity } from '../../teacher/types'
import { QuizRenderer } from './QuizRenderer'

interface Props {
  activity: Activity
  onComplete: (score: number) => void
}

export function ActivityRunner({ activity, onComplete }: Props) {
  switch (activity.kind) {
    case 'quiz':
      return (
        <QuizRenderer
          title={activity.title}
          maxScore={activity.max_score}
          config={activity.config}
          onComplete={onComplete}
        />
      )
    case 'external-link':
      return <ExternalLinkRunner activity={activity} onComplete={onComplete} />
    case 'simulator':
    case 'animation':
      return <Stub activity={activity} onComplete={onComplete} />
    default:
      return <Stub activity={activity} onComplete={onComplete} />
  }
}

function ExternalLinkRunner({ activity, onComplete }: Props) {
  const url = typeof activity.config.url === 'string' ? activity.config.url : ''
  const [opened, setOpened] = useState(false)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ fontSize: 'var(--text-lab-lg)', margin: 0 }}>{activity.title}</h2>
      <p style={{ color: '#555B66' }}>Atividade externa — abre em nova aba.</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpened(true)}
          style={{
            display: 'inline-block',
            padding: '12px 18px',
            borderRadius: 10,
            background: 'var(--color-lab-accent)',
            color: '#FFF',
            textDecoration: 'none',
            marginTop: 14,
          }}
        >
          abrir atividade →
        </a>
      ) : (
        <div style={{ color: '#993C1D' }}>URL não configurada.</div>
      )}
      <div style={{ marginTop: 26 }}>
        <button
          type="button"
          onClick={() => onComplete(activity.max_score)}
          disabled={!opened}
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            border: '1px solid var(--color-lab-rule)',
            background: '#FFF',
            cursor: opened ? 'pointer' : 'not-allowed',
            opacity: opened ? 1 : 0.5,
            fontFamily: 'inherit',
          }}
        >
          marcar como concluída
        </button>
      </div>
    </div>
  )
}

function Stub({ activity, onComplete }: Props) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ fontSize: 'var(--text-lab-lg)', margin: 0 }}>{activity.title}</h2>
      <div
        style={{
          padding: '14px 16px',
          marginTop: 16,
          border: '1px dashed var(--color-lab-rule)',
          borderRadius: 10,
          color: '#555B66',
          fontFamily: 'var(--font-lab-mono)',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        kind <code>{activity.kind}</code> ainda não tem renderer — precisa registrar um
        componente TSX para este <code>activityId</code>. Por enquanto, marca como
        concluído sem score pra desbloquear o próximo nó.
      </div>
      <button
        type="button"
        onClick={() => onComplete(0)}
        style={{
          marginTop: 18,
          padding: '10px 18px',
          borderRadius: 10,
          border: '1px solid var(--color-lab-rule)',
          background: '#FFF',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        pular atividade
      </button>
    </div>
  )
}
