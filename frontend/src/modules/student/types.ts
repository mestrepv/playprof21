/**
 * Tipos específicos do runtime do aluno (Fase 7).
 * Espelham backend/modules/domain/schemas.py.
 */

import type { Activity, Trail } from '../teacher/types'

export interface ActivityResult {
  id: string
  activity_id: string
  user_id: string
  score: number
  max_score: number
  is_best: boolean
  attempted_at: string
}

export type NodeStatus = 'locked' | 'available' | 'completed'

export interface TrailNode {
  activity: Activity
  position: number
  status: NodeStatus
  best_score: number | null
  best_max_score: number | null
  stars: number
}

export interface TrailProgress {
  trail: Trail
  nodes: TrailNode[]
}
