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
  code: string | null
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

// ── Stats da turma (Fase 7.3) ──────────────────────────────────────────────

export interface ClassroomStats {
  total_students: number
  total_activities: number
  assignments_by_type: { activity: number; trail: number; interactive_lesson: number }
  attempts_total: number
  attempts_expected: number
  attempts_pct: number
  energy_total: number
}

export interface EnrollmentMember {
  user_id: string
  display_name: string
  joined_at: string
}

export interface StudentStat {
  user_id: string
  display_name: string
  attempts_count: number
  attempts_expected: number
  attempts_pct: number
  energy: number
}

// ── Feed ───────────────────────────────────────────────────────────────────

export interface PostAuthor {
  id: string
  display_name: string
}

export interface FeedPost {
  id: string
  classroom_id: string
  author: PostAuthor
  content: string
  created_at: string
  updated_at: string
  comment_count: number
  like_count: number
  user_liked: boolean
}

export interface FeedPostsPage {
  posts: FeedPost[]
  total: number
  has_more: boolean
}

export interface FeedComment {
  id: string
  post_id: string
  author: PostAuthor
  content: string
  created_at: string
}
