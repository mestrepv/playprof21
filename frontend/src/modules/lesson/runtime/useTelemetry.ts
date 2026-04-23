/**
 * useTelemetry — roteia eventos de interação com slides.
 *
 * Dentro de uma sessão ao vivo: envia via WebSocket (já tratado pelo adapter).
 * Fora de sessão (preview / standalone): POST /api/lesson/events com JWT.
 *
 * Uso:
 *   const track = useTelemetry({ lessonSlug: slug, slideId: slide.id })
 *   track('quiz_fill_submit', { answer: 'mc²', correct: true })
 */

import { useCallback } from 'react'

import { useSessionOptional } from '../../live/SessionContext'
import { useAuth } from '../../auth/AuthContext'
import { apiUrl } from './apiUrl'

type Payload = Record<string, unknown>

function slugFromUrl(): string {
  const m = window.location.pathname.match(/\/lesson\/preview\/([^/?]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export function useTelemetry({ lessonSlug, slideId }: { lessonSlug?: string; slideId: string }) {
  const session = useSessionOptional()
  const { token } = useAuth()

  const track = useCallback(
    (eventType: string, payload: Payload = {}) => {
      if (session) {
        return
      }

      if (!token) return

      fetch(`${apiUrl()}/api/lesson/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lesson_slug: lessonSlug ?? slugFromUrl(), slide_id: slideId, event_type: eventType, payload }),
      }).catch(() => {})
    },
    [session, token, lessonSlug, slideId]
  )

  return track
}
