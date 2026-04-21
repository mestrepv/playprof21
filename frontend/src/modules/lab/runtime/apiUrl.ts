/**
 * Resolve a URL base da API em runtime.
 *
 * Prioridade:
 *   1. VITE_API_URL — útil quando web e api rodam em hostnames distintos
 *      (ex.: produção com `api.prof21.com.br`). Wins se definido em build/dev.
 *   2. window.location.hostname + porta 5105 — default em dev: o browser
 *      acessa tanto a web (5174) quanto a api (5105) no mesmo VPS, então
 *      reaproveitar o hostname funciona pra localhost, 127.0.0.1, IP público
 *      e subdomínios sem reconfigurar.
 *
 * SSR-safe: se `window` não existir, cai no localhost (só afeta testes).
 */

const API_PORT_DEV = 5105

export function apiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (typeof envUrl === 'string' && envUrl.length > 0) return envUrl.replace(/\/$/, '')
  if (typeof window === 'undefined') return `http://localhost:${API_PORT_DEV}`
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:${API_PORT_DEV}`
}
