import type { ComponentType } from 'react'

import { Assinaturas } from './Assinaturas'
import { HypatiaReal } from './HypatiaReal'
import { HypatiaTutorial } from './HypatiaTutorial'
import { Identificacao } from './Identificacao'
import { MassaInvariante } from './MassaInvariante'
import { Reconhecimento } from './Reconhecimento'

export interface MissionComponentProps {
  currentActivityId?: string | null
  onLayerFocused?: (layer: string) => void
  readOnly?: boolean
}

export const ATLAS_COMPONENTS: Record<string, ComponentType<MissionComponentProps>> = {
  'atlas.reconhecimento': Reconhecimento as ComponentType<MissionComponentProps>,
  'atlas.assinaturas': Assinaturas as ComponentType<MissionComponentProps>,
  'atlas.identificacao': Identificacao as ComponentType<MissionComponentProps>,
  'atlas.massainvariante': MassaInvariante as ComponentType<MissionComponentProps>,
  'atlas.hypatia.tutorial': HypatiaTutorial as ComponentType<MissionComponentProps>,
  'atlas.hypatia.real': HypatiaReal as ComponentType<MissionComponentProps>,
}
