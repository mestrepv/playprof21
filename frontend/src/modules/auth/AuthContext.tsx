/**
 * AuthContext — JWT + user cacheado em localStorage, expõe:
 *
 *   const { user, token, login, register, logout, loading } = useAuth()
 *
 * Reidrata do localStorage no mount; valida o token chamando /api/auth/me. Se
 * o backend rejeitar, limpa tudo (token expirou ou foi revogado).
 *
 * `apiFetch` é um helper que adiciona o Authorization header automaticamente
 * e levanta em 401 (chamando logout). Ver src/modules/lesson/runtime/apiFetch.ts.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { LOGOUT_EVENT } from '../lesson/runtime/apiFetch'
import { apiUrl } from '../lesson/runtime/apiUrl'
import type { AuthUser, TokenPayload } from './types'

const API_URL = apiUrl()
const STORAGE_KEY = 'labprof21:auth'

interface AuthState {
  user: AuthUser | null
  token: string | null
  loading: boolean
}

interface AuthContextShape extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextShape | null>(null)

function readStored(): Pick<AuthState, 'user' | 'token'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { user: null, token: null }
    const parsed = JSON.parse(raw) as { user: AuthUser; token: string }
    if (parsed && parsed.token && parsed.user) return parsed
  } catch {
    /* corrupted — ignora */
  }
  return { user: null, token: null }
}

function writeStored(user: AuthUser | null, token: string | null) {
  try {
    if (user && token) localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* quota cheia — ignora */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const { user, token } = readStored()
    return { user, token, loading: Boolean(token) }
  })

  // Valida token no mount (se houver).
  useEffect(() => {
    if (!state.token) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    let cancelled = false
    fetch(`${API_URL}/api/auth/me`, {
      headers: { authorization: `Bearer ${state.token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as AuthUser
      })
      .then((user) => {
        if (cancelled) return
        setState({ user, token: state.token, loading: false })
        writeStored(user, state.token)
      })
      .catch(() => {
        if (cancelled) return
        writeStored(null, null)
        setState({ user: null, token: null, loading: false })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!r.ok) {
      const msg = await r
        .json()
        .then((b: { detail?: string }) => b.detail ?? `HTTP ${r.status}`)
        .catch(() => `HTTP ${r.status}`)
      throw new Error(msg)
    }
    const payload = (await r.json()) as TokenPayload
    writeStored(payload.user, payload.access_token)
    setState({ user: payload.user, token: payload.access_token, loading: false })
  }, [])

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const r = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: displayName }),
    })
    if (!r.ok) {
      const msg = await r
        .json()
        .then((b: { detail?: unknown }) => (typeof b.detail === 'string' ? b.detail : `HTTP ${r.status}`))
        .catch(() => `HTTP ${r.status}`)
      throw new Error(msg)
    }
    const payload = (await r.json()) as TokenPayload
    writeStored(payload.user, payload.access_token)
    setState({ user: payload.user, token: payload.access_token, loading: false })
  }, [])

  const logout = useCallback(() => {
    writeStored(null, null)
    setState({ user: null, token: null, loading: false })
  }, [])

  const refresh = useCallback(async () => {
    // Re-busca o user no backend (útil após PATCH /me). Não renova o token.
    const current = readStored()
    if (!current.token) return
    try {
      const r = await fetch(`${API_URL}/api/auth/me`, {
        headers: { authorization: `Bearer ${current.token}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const user = (await r.json()) as AuthUser
      writeStored(user, current.token)
      setState({ user, token: current.token, loading: false })
    } catch {
      /* silencioso — quem chamou já trata o erro do PATCH */
    }
  }, [])

  // Reage a 401 vindo do apiFetch (token expirado).
  useEffect(() => {
    const onForced = () => logout()
    window.addEventListener(LOGOUT_EVENT, onForced)
    return () => window.removeEventListener(LOGOUT_EVENT, onForced)
  }, [logout])

  const value = useMemo<AuthContextShape>(
    () => ({ ...state, login, register, logout, refresh }),
    [state, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextShape {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
