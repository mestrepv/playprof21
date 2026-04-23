/**
 * Resolve URL base do WebSocket do backend.
 *
 * Segue a mesma filosofia do apiUrl.ts: deriva do window.location pra funcionar
 * de qualquer host (localhost, VPS, domínio futuro) sem rebuild.
 */

const WS_PORT_DEV = 5105

export function wsUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL
  if (typeof envUrl === 'string' && envUrl.length > 0) return envUrl.replace(/\/$/, '')
  if (typeof window === 'undefined') return `ws://localhost:${WS_PORT_DEV}`
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.hostname}:${WS_PORT_DEV}`
}
