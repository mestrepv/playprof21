/**
 * Tipos específicos do runtime do aluno (Fase 7).
 * Espelham backend/modules/domain/schemas.py.
 */

import type { Activity, InteractiveLesson, Trail } from '../teacher/types'

export interface ActivityResult {
  id: string
  activity_id: string
  user_id: string
  score: number
  max_score: number
  is_best: boolean
  attempted_at: string
}

export interface TrailNode {
  activity: Activity
  position: number
  best_score: number | null
  best_max_score: number | null
}

export interface TrailProgress {
  trail: Trail
  nodes: TrailNode[]
  stars: number
  activities_total: number
  activities_attempted: number
  completed: boolean
}

export type TrailStatus = 'locked' | 'available' | 'completed'

export interface TrailSummary {
  trail: Trail
  classroom_id: string
  classroom_name: string
  position: number
  activities_total: number
  activities_attempted: number
  stars: number
  status: TrailStatus
}

export interface StudentInteractiveLessonItem {
  interactive_lesson: InteractiveLesson
  classroom_id: string
  classroom_name: string
}
