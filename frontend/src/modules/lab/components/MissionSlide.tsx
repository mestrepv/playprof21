/**
 * MissionSlide — resolve missionId → componente TSX.
 *
 * Funciona em dois modos:
 *   Preview (sem SessionContext): currentActivityId=null, readOnly=false
 *   Ao vivo (com SessionContext): lê interactionMode e activityId do adapter;
 *     master em master-led propaga setActivity; player fica readOnly.
 */

import { useSessionOptional } from '../../live/SessionContext'
import { ATLAS_COMPONENTS } from '../games/atlas/components'
import type { MissionSlide as MissionSlideModel } from '../types/manifest'

interface Props {
  slide: MissionSlideModel
}

export function MissionSlide({ slide }: Props) {
  const Component = ATLAS_COMPONENTS[slide.missionId]
  const session = useSessionOptional()

  if (!Component) {
    return (
      <div style={{ padding: 24, color: '#D4474A', fontFamily: 'monospace', fontSize: 14 }}>
        missionId desconhecido: <code>{slide.missionId}</code>
      </div>
    )
  }

  // ── Modo preview (sem sessão) ─────────────────────────────────────────────
  if (!session) {
    return <Component currentActivityId={null} readOnly={false} />
  }

  // ── Modo sessão ao vivo ───────────────────────────────────────────────────
  const { adapter, state } = session
  const isMaster = state.role === 'master'
  const isMasterLed = state.interactionMode === 'master-led'
  const forcedActivityId = isMasterLed ? state.activityId : null
  const readOnly = !isMaster && isMasterLed

  function handleLayerFocused(layer: string): void {
    const composedId = `${slide.missionId}.${layer}`
    if (isMaster && isMasterLed) {
      adapter.setActivity(composedId)
    }
    adapter.logEvent(`${slide.missionId}.layerFocused`, { layer, interactionMode: state.interactionMode })
  }

  return (
    <Component
      currentActivityId={forcedActivityId}
      onLayerFocused={handleLayerFocused}
      readOnly={readOnly}
    />
  )
}
