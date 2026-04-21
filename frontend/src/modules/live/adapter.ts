/**
 * WebSocket adapter — encapsula a conexão live/session.
 *
 * Modo portado do module_lab/adapter/websocket.ts (rpgia), simplificado:
 *  - pending queue pra mensagens enviadas antes de OPEN
 *  - reconexão exponencial com cap (1s→30s) em close não-intencional
 *  - emitter tipado por evento
 *
 * Fase 4 não implementa mock adapter. Se precisar dev offline, adiciona
 * depois (o contrato via EventEmitter já comporta um backend alternativo).
 */

import { wsUrl } from '../lab/runtime/wsUrl'
import type {
  InteractionMode,
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
    // Notifica imediatamente pro subscriber pegar estado atual
    fn(this.state, null)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private buildUrl(): string {
    const base = wsUrl()
    const qp = new URLSearchParams()
    if (this.params.token) qp.set('token', this.params.token)
    if (this.params.anonId) qp.set('anon_id', this.params.anonId)
    if (this.params.displayName) qp.set('display_name', this.params.displayName)
    return `${base}/ws/lab/session/${encodeURIComponent(this.params.sessionId)}?${qp.toString()}`
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'sessionSnapshot':
        this.state = {
          slideIndex: msg.session.current_slide_index,
          activityId: msg.session.current_activity_id,
          interactionMode: msg.session.interaction_mode,
          status: msg.session.status,
          role: msg.my_role,
          membershipId: msg.my_membership.id,
          participants: msg.participants,
          snapshotReceived: true,
        }
        break
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
    for (const fn of this.listeners) fn(this.state, msg)
  }
}
