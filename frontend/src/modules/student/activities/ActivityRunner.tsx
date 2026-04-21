/**
 * ActivityRunner — despacha pro renderer certo por `Activity.kind`.
 */

import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
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
    <div>
      <h2 style={{ fontSize: 'var(--p21-text-lg)', margin: 0 }}>{activity.title}</h2>
      <p style={{ color: 'var(--p21-ink-3)', marginTop: 8 }}>
        Essa atividade abre em uma nova aba — volta aqui pra marcar como concluída.
      </p>
      {url ? (
        <Button as="a" href={url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)} size="lg">
          abrir atividade →
        </Button>
      ) : (
        <div style={{ color: 'var(--p21-coral-ink)' }}>URL não configurada.</div>
      )}
      <div style={{ marginTop: 'var(--p21-sp-5)' }}>
        <Button onClick={() => onComplete(activity.max_score)} disabled={!opened} variant="outline" size="lg">
          marcar como concluída
        </Button>
      </div>
    </div>
  )
}

function Stub({ activity, onComplete }: Props) {
  return (
    <div>
      <h2 style={{ fontSize: 'var(--p21-text-lg)', margin: 0 }}>{activity.title}</h2>
      <div
        style={{
          padding: 'var(--p21-sp-4)',
          marginTop: 'var(--p21-sp-4)',
          border: '1px dashed var(--p21-border-strong)',
          borderRadius: 'var(--p21-radius-md)',
          color: 'var(--p21-ink-3)',
          fontFamily: 'var(--p21-font-mono)',
          fontSize: 'var(--p21-text-sm)',
          lineHeight: 1.6,
        }}
      >
        kind <code>{activity.kind}</code> ainda não tem renderer — precisa registrar um
        componente TSX para este <code>activityId</code>.
      </div>
      <Button onClick={() => onComplete(0)} variant="outline" style={{ marginTop: 'var(--p21-sp-4)' }}>
        pular atividade
      </Button>
    </div>
  )
}
