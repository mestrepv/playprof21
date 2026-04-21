/**
 * Formata timestamp relativo ao "agora", em português.
 *
 * - <1 min  → "agora"
 * - <60 min → "5 min"
 * - <24 h   → "3 h"
 * - <7 d    → "2 d"
 * - este ano→ "15 de mar."
 * - outros  → "15 mar 2025"
 */

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function timeAgo(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.max(0, Math.floor(diffMs / 1000))
  if (diffSec < 60) return 'agora'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} d`
  const day = d.getDate()
  const month = MONTHS_PT[d.getMonth()]
  if (d.getFullYear() === now.getFullYear()) return `${day} de ${month}.`
  return `${day} ${month} ${d.getFullYear()}`
}
