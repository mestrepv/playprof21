/**
 * UUID persistente do aluno anônimo — localStorage `labprof21:anon_id`.
 *
 * Quando o aluno volta numa aba nova, mantém a mesma membership na sessão
 * (a backend dedupa por `(session_id, anonymous_user_id)`).
 */

const KEY = 'labprof21:anon_id'

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback simples (v4-like). Crypto.randomUUID existe em todos browsers modernos.
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => {
    const n = Number(c)
    return (n ^ (Math.floor(Math.random() * 16) >> (n / 4))).toString(16)
  })
}

export function getAnonymousId(): string {
  try {
    const cur = localStorage.getItem(KEY)
    if (cur) return cur
    const next = uuidv4()
    localStorage.setItem(KEY, next)
    return next
  } catch {
    return uuidv4()
  }
}
