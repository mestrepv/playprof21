/**
 * apiFetch — fetch com Authorization header injetado e tratamento de 401.
 *
 * Uso:
 *   const res = await apiFetch('/api/classrooms', { token })
 *   if (!res.ok) throw new Error(await res.text())
 *   const data = await res.json()
 *
 * Em 401 dispara o evento `labprof21:logout` no window — quem estiver ouvindo
 * (AuthProvider) limpa o storage. Evita acoplar o fetcher ao contexto React.
 */

import { apiUrl } from './apiUrl'

const API_URL = apiUrl()

export const LOGOUT_EVENT = 'labprof21:logout'

interface Options extends Omit<RequestInit, 'body'> {
  token?: string | null
  json?: unknown
}

export async function apiFetch(path: string, opts: Options = {}): Promise<Response> {
  const { token, json, headers, ...rest } = opts
  const h = new Headers(headers)
  if (token) h.set('authorization', `Bearer ${token}`)
  let body: BodyInit | undefined
  if (json !== undefined) {
    h.set('content-type', 'application/json')
    body = JSON.stringify(json)
  }
  const r = await fetch(`${API_URL}${path}`, { ...rest, headers: h, body })
  if (r.status === 401) {
    window.dispatchEvent(new CustomEvent(LOGOUT_EVENT))
  }
  return r
}

export async function apiJson<T>(path: string, opts: Options = {}): Promise<T> {
  const r = await apiFetch(path, opts)
  if (!r.ok) {
    let detail = `HTTP ${r.status}`
    try {
      const b = (await r.json()) as { detail?: unknown }
      if (typeof b.detail === 'string') detail = b.detail
    } catch {
      /* body não-JSON */
    }
    throw new Error(detail)
  }
  if (r.status === 204) return undefined as T
  return (await r.json()) as T
}
