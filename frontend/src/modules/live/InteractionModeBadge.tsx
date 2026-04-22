/**
 * InteractionModeBadge — faixa no topo indicando o modo de interação atual.
 * Visível para todos os participantes.
 *   master-led → "Professor no controle"  (azul, chamativo)
 *   free       → "Exploração livre"        (verde, discreto)
 */

import { useSession } from './SessionContext'

export function InteractionModeBadge() {
  const { state } = useSession()
  const isMasterLed = state.interactionMode === 'master-led'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 45,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '6px 16px',
        background: isMasterLed
          ? 'var(--p21-blue, #2563EB)'
          : 'rgba(22,163,74,0.85)',
        color: '#FFF',
        fontFamily: 'var(--p21-font-mono, monospace)',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.03em',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transition: 'background 0.3s',
        pointerEvents: 'none',
      }}
    >
      <span>{isMasterLed ? '🔒' : '🔓'}</span>
      <span>{isMasterLed ? 'Professor no controle' : 'Exploração livre'}</span>
    </div>
  )
}
