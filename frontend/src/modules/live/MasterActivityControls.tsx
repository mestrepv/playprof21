/**
 * MasterActivityControls — botão toggle free/master-led visível só pro master
 * em slides tipo mission. Posicionado fixed top-right, acima do HUD.
 */

import { useSession } from './SessionContext'

export function MasterActivityControls() {
  const { adapter, state } = useSession()
  if (state.role !== 'master') return null

  const isMasterLed = state.interactionMode === 'master-led'

  return (
    <button
      onClick={() => adapter.setInteractionMode(isMasterLed ? 'free' : 'master-led')}
      title={
        isMasterLed
          ? 'Devolver exploração livre aos alunos'
          : 'Assumir controle: alunos seguem o que você selecionar'
      }
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 13px',
        borderRadius: 8,
        border: `1.5px solid ${isMasterLed ? 'var(--p21-blue, #2563EB)' : 'var(--p21-border-strong, #C5C2B8)'}`,
        background: isMasterLed ? 'var(--p21-blue, #2563EB)' : 'rgba(255,255,255,0.95)',
        color: isMasterLed ? '#FFF' : 'var(--p21-ink, #0F1115)',
        fontFamily: 'var(--p21-font-mono, monospace)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
    >
      <span>{isMasterLed ? '🔒' : '🔓'}</span>
      <span>{isMasterLed ? 'controle ativo' : 'assumir controle'}</span>
    </button>
  )
}
