import { useState, useRef, useEffect } from 'react'

/*
 * Assinaturas — cópia adaptada de src/test/atlas-lab/missoes/Assinaturas.tsx
 * para o runtime do module_lab. Padrão idêntico ao Reconhecimento:
 *   - props opcionais (currentActivityId, onLayerFocused, readOnly)
 *   - wrapper inline (sem AtlasLabLayout)
 *   - standalone continua intocado em /test/atlas-lab/
 */
import './atlasLab.css'

const MISSION_ID = 'atlas.assinaturas'

function parseSubActivity(activityId: string | null | undefined): string | null {
  if (!activityId) return null
  const prefix = `${MISSION_ID}.`
  if (activityId.startsWith(prefix)) return activityId.slice(prefix.length)
  return null
}

export interface AssinaturasProps {
  currentActivityId?: string | null
  onLayerFocused?: (subId: string) => void
  readOnly?: boolean
}

const CW = 640, CH = 640, CX = 320, CY = 320

const T = {
  canvasBg: '#06060e',
  id: '#2a2a2a', idBorder: '#555',
  ecal: '#6abf4b', ecalDark: '#4a9a30',
  hcal: '#d4726a', hcalDark: '#b85550',
  muon: '#5b8ec9', muonDark: '#3a6a9f',
  track: '#4dd0e1',
  muonTrack: '#ff44ff',
  towerEM: '#dddd00',
  towerHAD: '#ddaa00',
  met: '#ff2222',
}

// Layer radii (same as Reconhecimento)
const L = {
  id: { ri: 4, ro: 92 },
  ecal: { ri: 96, ro: 152 },
  hcal: { ri: 156, ro: 222 },
  muon: { ri: 232, ro: 310 },
}

function makeChambers(ri: number, ro: number, n: number, gap: number) {
  const segs: { a1: number; a2: number; ri: number; ro: number }[] = []
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2
    segs.push({ a1, a2: a1 + ((1 - gap) / n) * Math.PI * 2, ri, ro })
  }
  return segs
}

const MU_CH = [
  ...makeChambers(234, 254, 16, 0.25),
  ...makeChambers(262, 280, 20, 0.3),
  ...makeChambers(288, 308, 24, 0.28),
]

type ParticleId = 'muon' | 'electron' | 'photon' | 'jet' | 'neutrino'

interface Particle {
  id: ParticleId
  symbol: string
  label: string
  color: string
  shortRule: string
  explanation: string
  signature: {
    track: string
    em: string
    had: string
    muonCh: string
  }
}

const PARTICLES: Particle[] = [
  {
    id: 'muon', symbol: 'μ', label: 'Múon', color: '#ff44ff',
    shortRule: 'Track curvo + deposito MIP + chega ao espectrômetro azul',
    explanation: 'O múon atravessa todos os calorímetros deixando apenas pequenos depósitos (MIP) e chega ao espectrômetro de múons. É a assinatura mais fácil de reconhecer: se o track sai do tracker e chega ao azul, é múon.',
    signature: { track: '✓ curvo', em: '— (MIP)', had: '— (MIP)', muonCh: '✓' },
  },
  {
    id: 'electron', symbol: 'e⁻', label: 'Elétron', color: '#58cc02',
    shortRule: 'Track curvo + torre EM compacta + para no verde',
    explanation: 'O elétron curva no campo magnético (track no ID) e é completamente absorvido pelo calorímetro EM, gerando uma torre amarela compacta no anel verde. Não chega ao calorímetro hadrônico.',
    signature: { track: '✓ curvo', em: '✓ compacta', had: '—', muonCh: '—' },
  },
  {
    id: 'photon', symbol: 'γ', label: 'Fóton', color: '#ffcc00',
    shortRule: 'SEM track + torre EM compacta',
    explanation: 'Fóton é neutro, então não deixa track no ID. Ele só aparece como torre amarela compacta no calorímetro EM. A ausência de track apontando para a torre é o que diferencia fóton de elétron.',
    signature: { track: '—', em: '✓ compacta', had: '—', muonCh: '—' },
  },
  {
    id: 'jet', symbol: 'jato', label: 'Jato de Hádrons', color: '#ff8f00',
    shortRule: 'Vários tracks + torre EM pequena + torre HAD grande',
    explanation: 'Um jato é um chuveiro de hádrons resultantes de um quark ou glúon. Múltiplos tracks no ID convergem para depósitos espalhados no EM (pequeno) e principalmente no hadrônico (grande). Torre no verde E no vermelho ⇒ jato.',
    signature: { track: '✓ vários', em: '✓ pequeno', had: '✓ grande', muonCh: '—' },
  },
  {
    id: 'neutrino', symbol: 'ν', label: 'Neutrino', color: '#ff2222',
    shortRule: 'Invisível — aparece só como MET',
    explanation: 'Neutrinos não interagem com nenhuma camada. Só sabemos que passaram pelo desequilíbrio de momento transverso: a soma vetorial dos pT dos produtos visíveis não fecha. Essa falta é a MET (Missing Transverse Energy), representada por uma seta vermelha tracejada oposta à direção do neutrino.',
    signature: { track: '—', em: '—', had: '—', muonCh: '— (MET)' },
  },
]

// Cada partícula sai do IP numa direção diferente para facilitar comparação visual
const PARTICLE_ANGLE: Record<ParticleId, number> = {
  muon: -Math.PI * 0.28,      // up-right
  electron: -Math.PI * 0.78,  // up-left
  photon: Math.PI * 0.92,     // left (quase horizontal)
  jet: Math.PI * 0.32,        // down-right
  neutrino: Math.PI * 0.68,   // down-left
}

export function Assinaturas(props: AssinaturasProps = {}) {
  const { currentActivityId, onLayerFocused, readOnly = false } = props
  const cvRef = useRef<HTMLCanvasElement | null>(null)
  const [sel, setSel] = useState<ParticleId | null>(null)
  const [visited, setVisited] = useState<Record<string, boolean>>({})

  // Sincronia com o master: currentActivityId força a partícula destacada.
  useEffect(() => {
    const sub = parseSubActivity(currentActivityId)
    const valid: ParticleId[] = ['muon', 'electron', 'photon', 'jet', 'neutrino']
    const forced = sub && (valid as string[]).includes(sub) ? (sub as ParticleId) : null
    if (forced !== sel) setSel(forced)
    if (forced) setVisited((v) => (v[forced] ? v : { ...v, [forced]: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentActivityId])

  const selP = PARTICLES.find((p) => p.id === sel) || null
  const visitedCount = PARTICLES.filter((p) => visited[p.id]).length
  const allDone = visitedCount === PARTICLES.length

  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    cv.width = CW * dpr
    cv.height = CH * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = T.canvasBg
    ctx.fillRect(0, 0, CW, CH)

    // Draw detector layers (dimmed, reference only)
    const layers: [string, string, { ri: number; ro: number }, boolean][] = [
      [T.muon, T.muonDark, L.muon, true],
      [T.hcal, T.hcalDark, L.hcal, false],
      [T.ecal, T.ecalDark, L.ecal, false],
      [T.id, T.idBorder, L.id, false],
    ]
    for (const [fill, border, ring, isMuon] of layers) {
      ctx.globalAlpha = 0.55
      if (isMuon) {
        for (const ch of MU_CH) {
          ctx.fillStyle = fill
          ctx.beginPath()
          ctx.arc(CX, CY, ch.ro, ch.a1, ch.a2)
          ctx.arc(CX, CY, ch.ri, ch.a2, ch.a1, true)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = border
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      } else {
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.arc(CX, CY, ring.ro, 0, Math.PI * 2)
        ctx.arc(CX, CY, ring.ri, 0, Math.PI * 2, true)
        ctx.fill()
        ctx.strokeStyle = border
        ctx.lineWidth = 0.6
        ctx.beginPath()
        ctx.arc(CX, CY, ring.ro, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(CX, CY, ring.ri, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    // IP
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(CX, CY, 2.5, 0, Math.PI * 2)
    ctx.fill()

    if (selP) drawSignature(ctx, selP.id)

    if (!sel) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.font = "500 13px 'Instrument Sans',sans-serif"
      ctx.textAlign = 'center'
      ctx.fillText('Escolha uma partícula', CX, CY - 6)
      ctx.fillText('para ver sua assinatura', CX, CY + 12)
    }
  }, [sel, selP])

  return (
    <div className="atlas-lab">
      <div className="atlas-lab-container">
        <div className="atlas-lab-title-block">
          <div className="atlas-lab-step">PASSO 2 · ASSINATURAS</div>
          <h1 className="atlas-lab-title">Como identificar <span>partículas</span></h1>
          <p className="atlas-lab-subtitle">
            {readOnly
              ? 'Acompanhe a análise conduzida pelo mestre.'
              : 'Cada partícula deixa uma combinação única de sinais — escolha uma para ver sua assinatura no detector.'}
          </p>
        </div>
      <div className="atlas-sig-picker">
        {PARTICLES.map((p) => {
          const active = sel === p.id
          const done = !!visited[p.id]
          return (
            <button
              key={p.id}
              type="button"
              className={`atlas-sig-pill${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
              onClick={() => {
                if (!readOnly) {
                  setSel(sel === p.id ? null : p.id)
                  setVisited((v) => ({ ...v, [p.id]: true }))
                }
                onLayerFocused?.(p.id)
              }}
              style={active ? { borderColor: p.color, background: p.color + '18' } : undefined}
            >
              <span className="atlas-sig-pill-sym" style={{ color: p.color }}>{p.symbol}</span>
              <span className="atlas-sig-pill-label">{p.label}</span>
            </button>
          )
        })}
      </div>

      <div className="atlas-lab-main">
        <div className="atlas-lab-canvas-col">
          <div className="atlas-lab-canvas-frame">
            <canvas ref={cvRef} className="atlas-lab-canvas" />
          </div>
          <div className="atlas-lab-hint atlas-sig-hint">
            Detector em corte transversal — IP (ponto de colisão) no centro
          </div>
        </div>

        <aside className="atlas-lab-info-col" aria-live="polite">
          {selP ? (
            <article key={selP.id} className="atlas-lab-card">
              <div
                className="atlas-lab-card-strip"
                style={{ background: `linear-gradient(135deg, ${selP.color}22, #ffffff)` }}
              >
                <div className="atlas-lab-card-strip-row">
                  <div className="atlas-sig-card-icon" style={{ background: selP.color, color: '#fff' }}>
                    {selP.symbol}
                  </div>
                  <div className="atlas-lab-card-strip-text">
                    <div className="atlas-lab-card-label">{selP.label}</div>
                    <div className="atlas-lab-card-subtitle" style={{ color: selP.color }}>
                      {selP.shortRule}
                    </div>
                  </div>
                </div>
              </div>

              <div className="atlas-lab-card-body">
                <div className="atlas-lab-card-section">
                  <div className="atlas-lab-card-kicker" style={{ color: selP.color }}>
                    <span className="atlas-lab-card-kicker-bar" style={{ background: selP.color }} />
                    POR QUE ESSA ASSINATURA
                  </div>
                  <p className="atlas-lab-card-text">{selP.explanation}</p>
                </div>
                <div className="atlas-lab-card-divider" />
                <div className="atlas-lab-card-section">
                  <div className="atlas-lab-card-kicker" style={{ color: selP.color }}>
                    <span className="atlas-lab-card-kicker-bar" style={{ background: selP.color }} />
                    ONDE DEIXA SINAL
                  </div>
                  <table className="atlas-sig-table">
                    <tbody>
                      <tr><th>Tracker (ID)</th><td>{selP.signature.track}</td></tr>
                      <tr><th>Calorímetro EM</th><td>{selP.signature.em}</td></tr>
                      <tr><th>Calorímetro HAD</th><td>{selP.signature.had}</td></tr>
                      <tr><th>Espectrômetro de Múons</th><td>{selP.signature.muonCh}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          ) : allDone ? (
            <div className="atlas-lab-done">
              <div className="atlas-lab-done-icon"><span>{'\u2713'}</span></div>
              <div className="atlas-lab-done-title">5 assinaturas dominadas</div>
              <p className="atlas-lab-done-text">
                Você já sabe reconhecer as 5 partículas que o ATLAS mede. No próximo passo, você vai
                identificá-las em eventos reais.
              </p>
              <button type="button" className="atlas-lab-done-cta">Próximo passo →</button>
            </div>
          ) : (
            <div className="atlas-lab-empty">
              <div className="atlas-lab-empty-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <circle cx="10" cy="10" r="8" stroke="#999990" strokeWidth="1.5" strokeDasharray="3 3" />
                  <circle cx="10" cy="10" r="2" fill="#999990" />
                </svg>
              </div>
              <div className="atlas-lab-empty-title">Selecione uma partícula</div>
              <p className="atlas-lab-empty-text">
                Clique em μ, e⁻, γ, jato ou ν para ver como cada partícula aparece no detector
              </p>
              <div className="atlas-lab-empty-progress">
                {PARTICLES.map((p) => (
                  <div
                    key={p.id}
                    className={`atlas-lab-empty-progress-bar${visited[p.id] ? ' is-done' : ''}`}
                  />
                ))}
              </div>
              <div className="atlas-lab-empty-count">{visitedCount}/5 partículas</div>
            </div>
          )}
        </aside>
      </div>
      </div>
    </div>
  )
}

export default Assinaturas

// ============================================================
// Signature drawing helpers
// ============================================================

// Canonical: depósito de energia como barra de histograma — tangencialmente fina,
// radialmente longa, com altura proporcional à energia depositada.
// `ring` define raio interno e cor. `energy` é 0..1 (fração do ring thickness).
// `ang` é a direção radial em que a barra aponta (do IP pra fora).
function drawEnergyTower(
  ctx: CanvasRenderingContext2D,
  ring: 'ecal' | 'hcal',
  ang: number,
  energy: number,
  options: { tangentialWidth?: number; color?: string } = {},
) {
  const isEcal = ring === 'ecal'
  const rIn = isEcal ? L.ecal.ri : L.hcal.ri
  const rOut = isEcal ? L.ecal.ro : L.hcal.ro
  const fullLen = rOut - rIn
  const e = Math.max(0, Math.min(1, energy))
  // altura da barra: mínimo visível + fração da espessura do anel
  const len = 10 + (fullLen - 10) * e
  const w = options.tangentialWidth ?? (4 + e * 3)
  const fill = options.color ?? (isEcal ? T.towerEM : T.towerHAD)

  ctx.save()
  ctx.translate(CX, CY)
  ctx.rotate(ang)
  ctx.fillStyle = fill
  ctx.fillRect(rIn, -w / 2, len, w)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 0.6
  ctx.strokeRect(rIn, -w / 2, len, w)
  ctx.restore()
}

function curvedTrack(
  ctx: CanvasRenderingContext2D,
  rMax: number,
  angle: number,
  curvature: number,
  color: string,
  lineWidth = 2.5,
) {
  // Approximate a curved track by a bezier-like polyline
  const steps = 48
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(CX, CY)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const r = t * rMax
    const a = angle + curvature * t * t
    ctx.lineTo(CX + r * Math.cos(a), CY + r * Math.sin(a))
  }
  ctx.stroke()
}

function drawSignature(ctx: CanvasRenderingContext2D, id: ParticleId) {
  const ang = PARTICLE_ANGLE[id]
  if (id === 'muon') {
    curvedTrack(ctx, 310, ang, 0.18, T.muonTrack, 2.8)
    // MIP marker in muon chamber (small bright square)
    const mr = 270
    const mx = CX + mr * Math.cos(ang + 0.18)
    const my = CY + mr * Math.sin(ang + 0.18)
    ctx.fillStyle = T.muonTrack
    ctx.beginPath()
    ctx.arc(mx, my, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.stroke()
    return
  }

  if (id === 'electron') {
    curvedTrack(ctx, 150, ang, 0.25, T.track, 2.5)
    // Chuveiro EM: depósito compacto e de alta energia
    drawEnergyTower(ctx, 'ecal', ang + 0.04, 0.9, { tangentialWidth: 7 })
    return
  }

  if (id === 'photon') {
    // Sem track — só a torre EM (depósito compacto)
    drawEnergyTower(ctx, 'ecal', ang, 0.85, { tangentialWidth: 7 })
    return
  }

  if (id === 'jet') {
    // Múltiplas trajetórias espalhadas
    const spread = 0.22
    for (let i = -3; i <= 3; i++) {
      const a = ang + i * (spread / 6)
      curvedTrack(ctx, 150, a, 0.12 + 0.04 * Math.abs(i), T.track, 1.6)
    }
    // Jato deposita em VÁRIAS torres adjacentes — EM pequeno, HAD grande e espalhado
    for (let i = -2; i <= 2; i++) {
      const a = ang + i * 0.045
      const eEM = 0.45 * (1 - 0.25 * Math.abs(i))
      drawEnergyTower(ctx, 'ecal', a, eEM, { tangentialWidth: 5 })
    }
    for (let i = -3; i <= 3; i++) {
      const a = ang + i * 0.05
      const eHad = 0.85 * (1 - 0.18 * Math.abs(i))
      drawEnergyTower(ctx, 'hcal', a, eHad, { tangentialWidth: 6 })
    }
    return
  }

  if (id === 'neutrino') {
    // MET — dashed red arrow opposite to an implied invisible direction
    const len = 300
    const x1 = CX + 10 * Math.cos(ang)
    const y1 = CY + 10 * Math.sin(ang)
    const x2 = CX + len * Math.cos(ang)
    const y2 = CY + len * Math.sin(ang)
    ctx.strokeStyle = T.met
    ctx.lineWidth = 2.5
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.setLineDash([])
    // Arrow head
    const ah = 12
    const aw = 0.45
    ctx.fillStyle = T.met
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - ah * Math.cos(ang - aw), y2 - ah * Math.sin(ang - aw))
    ctx.lineTo(x2 - ah * Math.cos(ang + aw), y2 - ah * Math.sin(ang + aw))
    ctx.closePath()
    ctx.fill()
    // MET label
    ctx.fillStyle = T.met
    ctx.font = "700 11px 'JetBrains Mono',monospace"
    ctx.textAlign = 'center'
    const lx = CX + (len + 14) * Math.cos(ang)
    const ly = CY + (len + 14) * Math.sin(ang)
    ctx.fillText('MET', lx, ly)
  }
}
