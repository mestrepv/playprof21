/**
 * Contexto de sessão ao vivo. Provê adapter + estado para componentes
 * filho sem prop drilling. Usado por MissionSlide, QuizSlide, ScoreBoard.
 */

import { createContext, useContext } from 'react'
import type { SessionAdapter, InternalState } from './adapter'

export interface SessionContextValue {
  adapter: SessionAdapter
  state: InternalState
}

export const SessionContext = createContext<SessionContextValue | null>(null)

/** Hook com erro se usado fora do provider. */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession usado fora de SessionContext.Provider')
  return ctx
}

/** Hook seguro — retorna null fora do provider (modo preview). */
export function useSessionOptional(): SessionContextValue | null {
  return useContext(SessionContext)
}
