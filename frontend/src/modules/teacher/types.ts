/**
 * Tipos do banco de conteúdo + turma + assignments.
 * Espelham `backend/modules/domain/schemas.py`.
 */

export type ContentType = 'activity' | 'trail' | 'interactive_lesson'
export type ActivityKind = 'quiz' | 'external-link' | 'simulator' | 'animation'

export const ACTIVITY_KINDS: ActivityKind[] = ['quiz', 'external-link', 'simulator', 'animation']
export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  quiz: 'Quiz',
  'external-link': 'Link externo',
  simulator: 'Simulador',
  animation: 'Animação',
}

export interface Classroom {
  id: string
  owner_id: string
  name: string
  created_at: string
}

export interface Activity {
  id: string
  owner_id: string
  title: string
  kind: string
  config: Record<string, unknown>
  max_score: number
  visibility: string
  created_at: string
}

export interface Trail {
  id: string
  owner_id: string
  title: string
  description: string | null
  visibility: string
  created_at: string
}

export interface InteractiveLesson {
  id: string
  owner_id: string
  title: string
  slug: string
  visibility: string
  created_at: string
}

export interface Assignment {
  id: string
  classroom_id: string
  content_type: ContentType
  content_id: string
  position: number
  due_at: string | null
  created_at: string
}

export interface AssignmentExpanded {
  assignment: Assignment
  activity: Activity | null
  trail: Trail | null
  interactive_lesson: InteractiveLesson | null
}
