/**
 * WebSocket adapter — encapsula a conexão live/session.
 *
 * Fase 4: setSlide, setInteractionMode, event, ping
 * Fase 4.1: setActivity, quizOpen/Close/Reset/Answer, adjustScore,
 *           activityChange, quizState, scoreUpdate no handleMessage
 */

import { wsUrl } from '../lab/runtime/wsUrl'
import type {
  InteractionMode,
  QuizStateLocal,
  Role,
  ServerMessage,
  SessionStatus,
} from './types'

export interface InternalState {
  slideIndex: number
  activityId: string | null
  interactionMode: InteractionMode
  status: SessionStatus
  role: Role | null
  membershipId: string | null
  participants: Array<{ id: string; display_name: string; role: Role }>
  snapshotReceived: boolean
  quizzes: Record<string, QuizStateLocal>       // questionId → estado local
  scores: Record<string, number>                // membershipId → total
}

interface AdapterParams {
  sessionId: string
  token?: string | null
  anonId?: string | null
  displayName?: string
}

type Listener = (state: InternalState, lastMessage: ServerMessage | null) => void

export class SessionAdapter {
  private ws: WebSocket | null = null
  private params: AdapterParams
  private pending: string[] = []
  private backoff = 1000
  private closedByUs = false
  private listeners = new Set<Listener>()
  state: InternalState = {
    slideIndex: 0,
    activityId: null,
    interactionMode: 'free',
    status: 'idle',
    role: null,
    membershipId: null,
    participants: [],
    snapshotReceived: false,
    quizzes: {},
    scores: {},
  }

  constructor(params: AdapterParams) {
    this.params = params
  }

  connect(): void {
    this.closedByUs = false
    const url = this.buildUrl()
    const ws = new WebSocket(url)
    this.ws = ws
    ws.onopen = () => {
      this.backoff = 1000
      for (const msg of this.pending) ws.send(msg)
      this.pending.length = 0
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerMessage
        this.handleMessage(msg)
      } catch {
        /* ignora payload inválido */
      }
    }
    ws.onclose = () => {
      this.ws = null
      if (this.closedByUs) return
      const delay = Math.min(this.backoff, 30000)
      this.backoff = Math.min(this.backoff * 2, 30000)
      setTimeout(() => this.connect(), delay)
    }
    ws.onerror = () => {
      /* onclose sucede onerror; o backoff cuida */
    }
  }

  close(): void {
    this.closedByUs = true
    this.ws?.close()
    this.ws = null
  }

  send(msg: unknown): void {
    const serialized = JSON.stringify(msg)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serialized)
    } else {
      this.pending.push(serialized)
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.state, null)
    return () => {
      this.listeners.delete(fn)
    }
  }

  // ── Comandos master ──────────────────────────────────────────────────────

  setSlide(index: number): void {
    this.send({ type: 'setSlide', index })
  }

  setInteractionMode(mode: InteractionMode): void {
    this.send({ type: 'setInteractionMode', mode })
  }

  setActivity(activityId: string | null): void {
    this.send({ type: 'setActivity', activityId })
  }

  openQuiz(questionId: string, options: string[], correctIndex: number): void {
    this.send({ type: 'quizOpen', questionId, options, correctIndex })
  }

  closeQuiz(questionId: string): void {
    this.send({ type: 'quizClose', questionId })
  }

  resetQuiz(questionId: string): void {
    this.send({ type: 'quizReset', questionId })
  }

  adjustScore(membershipId: string, delta: number, reason?: string): void {
    this.send({ type: 'adjustScore', membershipId, delta, reason })
  }

  // ── Comandos player ──────────────────────────────────────────────────────

  submitAnswer(questionId: string, answerIndex: number): void {
    // Otimismo local: registra myAnswer antes da confirmação servidor
    const existing = this.state.quizzes[questionId]
    if (existing && existing.myAnswer === null) {
      this.state = {
        ...this.state,
        quizzes: {
          ...this.state.quizzes,
          [questionId]: { ...existing, myAnswer: answerIndex },
        },
      }
      this.notify(null)
    }
    this.send({ type: 'quizAnswer', questionId, answerIndex })
  }

  // ── Log de telemetria ────────────────────────────────────────────────────

  logEvent(name: string, payload?: Record<string, unknown>): void {
    this.send({ type: 'event', event: { name, payload: payload ?? {} } })
  }

  // ── Internos ─────────────────────────────────────────────────────────────

  private buildUrl(): string {
    const base = wsUrl()
    const qp = new URLSearchParams()
    if (this.params.token) qp.set('token', this.params.token)
    if (this.params.anonId) qp.set('anon_id', this.params.anonId)
    if (this.params.displayName) qp.set('display_name', this.params.displayName)
    return `${base}/ws/lab/session/${encodeURIComponent(this.params.sessionId)}?${qp.toString()}`
  }

  private notify(msg: ServerMessage | null): void {
    for (const fn of this.listeners) fn(this.state, msg)
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'sessionSnapshot': {
        const quizzes: Record<string, QuizStateLocal> = {}
        for (const q of msg.quizzes ?? []) {
          quizzes[q.questionId] = {
            questionId: q.questionId,
            status: q.status,
            distribution: q.distribution,
            responses: q.responses,
            correctIndex: q.correctIndex,
            myAnswer: null,
          }
        }
        const scores: Record<string, number> = {}
        for (const s of msg.scores ?? []) {
          scores[s.membershipId] = s.total
        }
        this.state = {
          slideIndex: msg.session.current_slide_index,
          activityId: msg.session.current_activity_id,
          interactionMode: msg.session.interaction_mode,
          status: msg.session.status,
          role: msg.my_role,
          membershipId: msg.my_membership.id,
          participants: msg.participants,
          snapshotReceived: true,
          quizzes,
          scores,
        }
        break
      }
      case 'slideChange':
        this.state = {
          ...this.state,
          slideIndex: msg.index,
          interactionMode: msg.interaction_mode,
          activityId: msg.activity_id,
          status: msg.status,
        }
        break
      case 'interactionModeChange':
        this.state = { ...this.state, interactionMode: msg.mode }
        break
      case 'activityChange':
        this.state = { ...this.state, activityId: msg.activityId }
        break
      case 'quizState': {
        const existing = this.state.quizzes[msg.questionId]
        this.state = {
          ...this.state,
          quizzes: {
            ...this.state.quizzes,
            [msg.questionId]: {
              questionId: msg.questionId,
              status: msg.status,
              distribution: msg.distribution,
              responses: msg.responses,
              correctIndex: msg.correctIndex,
              myAnswer: existing?.myAnswer ?? null,
            },
          },
        }
        break
      }
      case 'scoreUpdate': {
        const scores = { ...this.state.scores }
        for (const d of msg.deltas) {
          scores[d.membershipId] = (scores[d.membershipId] ?? 0) + d.delta
        }
        this.state = { ...this.state, scores }
        break
      }
      case 'participantUpdate':
        if (msg.action === 'joined' && msg.participant) {
          const p = msg.participant
          if (!this.state.participants.some((x) => x.id === p.id)) {
            this.state = { ...this.state, participants: [...this.state.participants, p] }
          }
        } else if (msg.action === 'left' && msg.membership_id) {
          this.state = {
            ...this.state,
            participants: this.state.participants.filter((x) => x.id !== msg.membership_id),
          }
        }
        break
      case 'sessionEnded':
        this.state = { ...this.state, status: 'ended' }
        break
      case 'pong':
      case 'error':
        break
    }
    this.notify(msg)
  }
}
