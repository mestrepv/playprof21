/**
 * Espelha os tipos do backend/modules/live/schemas.py + mensagens WS.
 */

export type InteractionMode = 'free' | 'master-led'
export type SessionStatus = 'idle' | 'live' | 'ended'
export type Role = 'master' | 'player'

export interface SessionOut {
  id: string
  interactive_lesson_id: string
  master_user_id: string
  current_slide_index: number
  current_activity_id: string | null
  interaction_mode: InteractionMode
  status: SessionStatus
  created_at: string
  started_at: string | null
  ended_at: string | null
}

export interface Participant {
  id: string
  display_name: string
  role: Role
}

export interface SessionSnapshot {
  session: SessionOut
  game_slug: string
  game_title: string
  participants: Participant[]
  my_membership: Participant | null
  my_role: Role
}

// ── Mensagens WebSocket (server → client) ──────────────────────────────────

export interface SnapshotMessage {
  type: 'sessionSnapshot'
  session: {
    id: string
    interactive_lesson_id: string
    current_slide_index: number
    current_activity_id: string | null
    interaction_mode: InteractionMode
    status: SessionStatus
  }
  my_membership: Participant
  my_role: Role
  participants: Participant[]
  ts: string
}

export interface SlideChangeMessage {
  type: 'slideChange'
  index: number
  interaction_mode: InteractionMode
  activity_id: string | null
  status: SessionStatus
  ts: string
}

export interface InteractionModeChangeMessage {
  type: 'interactionModeChange'
  mode: InteractionMode
  ts: string
}

export interface ParticipantUpdateMessage {
  type: 'participantUpdate'
  action: 'joined' | 'left'
  participant?: Participant
  membership_id?: string
  ts: string
}

export interface SessionEndedMessage {
  type: 'sessionEnded'
  ts: string
}

export interface PongMessage {
  type: 'pong'
  ts: string
}

export interface ErrorMessage {
  type: 'error'
  code: string
  message: string
}

export type ServerMessage =
  | SnapshotMessage
  | SlideChangeMessage
  | InteractionModeChangeMessage
  | ParticipantUpdateMessage
  | SessionEndedMessage
  | PongMessage
  | ErrorMessage
