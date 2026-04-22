import { useState, useRef, useEffect } from 'react'

/*
 * Identificacao — cópia adaptada de src/test/atlas-lab/missoes/Identificacao.tsx
 * Activity: event-{0..2} (master controla qual evento a turma analisa).
 */
import './atlasLab.css'

const MISSION_ID = 'atlas.identificacao'

function parseSubActivity(activityId: string | null | undefined): string | null {
  if (!activityId) return null
  const prefix = `${MISSION_ID}.`
  if (activityId.startsWith(prefix)) return activityId.slice(prefix.length)
  return null
}

export interface IdentificacaoProps {
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
  ghost: 'rgba(255,255,255,0.55)',
  wrong: '#ff4444',
  correctGlow: '#4caf50',
}

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

type ParticleKind = 'muon' | 'electron' | 'photon' | 'jet' | 'neutrino'

const PARTICLE_META: Record<ParticleKind, { symbol: string; label: string; color: string }> = {
  muon:     { symbol: 'μ',    label: 'Múon',    color: '#ff44ff' },
  electron: { symbol: 'e⁻',   label: 'Elétron', color: '#58cc02' },
  photon:   { symbol: 'γ',    label: 'Fóton',   color: '#ffcc00' },
  jet:      { symbol: 'jato', label: 'Jato',    color: '#ff8f00' },
  neutrino: { symbol: 'ν',    label: 'Neutrino',color: '#ff2222' },
}

interface EventParticle {
  id: string
  kind: ParticleKind
  angle: number
}

interface AtlasEvent {
  id: string
  name: string
  description: string
  particles: EventParticle[]
}

const EVENTS: AtlasEvent[] = [
  {
    id: 'z-mumu',
    name: 'Z → μ⁺μ⁻',
    description: 'O bóson Z decaiu em um par de múons que saem em direções opostas. Identifique os dois.',
    particles: [
      { id: 'p1', kind: 'muon', angle: -Math.PI * 0.22 },
      { id: 'p2', kind: 'muon', angle: Math.PI * 0.78 },
    ],
  },
  {
    id: 'mixed',
    name: 'Evento misto',
    description: 'Quatro partículas no mesmo evento: um elétron, um fóton, um múon e um jato. Distinga cada uma pela assinatura.',
    particles: [
      { id: 'p1', kind: 'electron', angle: -Math.PI * 0.42 },
      { id: 'p2', kind: 'photon',   angle: -Math.PI * 0.08 },
      { id: 'p3', kind: 'muon',     angle: Math.PI * 0.32 },
      { id: 'p4', kind: 'jet',      angle: Math.PI * 0.82 },
    ],
  },
  {
    id: 'w-enu',
    name: 'W → eν',
    description: 'O bóson W decaiu em um elétron e um neutrino. O neutrino é invisível — você só o detecta pela MET (seta vermelha tracejada oposta ao elétron).',
    particles: [
      { id: 'p1', kind: 'electron', angle: -Math.PI * 0.3 },
      { id: 'p2', kind: 'neutrino', angle: Math.PI * 0.7 },
    ],
  },
]

type Mode = 'ghost' | 'pending' | 'correct' | 'wrong'

export function Identificacao(props: IdentificacaoProps = {}) {
  const { currentActivityId, onLayerFocused, readOnly = false } = props
  const cvRef = useRef<HTMLCanvasElement | null>(null)
  const [eventIdx, setEventIdx] = useState(0)

  // Master sincroniza qual evento a turma está analisando.
  useEffect(() => {
    const sub = parseSubActivity(currentActivityId)
    if (sub?.startsWith('event-')) {
      const idx = parseInt(sub.slice('event-'.length), 10)
      if (!Number.isNaN(idx) && idx !== eventIdx) {
        setEventIdx(idx)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentActivityId])
  const ev = EVENTS[eventIdx]
  const [identifiedByEvent, setIdentifiedByEvent] = useState<Record<string, Record<string, boolean>>>({})
  const identified = identifiedByEvent[ev.id] || {}
  const setIdentified = (updater: (prev: Record<string, boolean>) => Record<string, boolean>) =>
    setIdentifiedByEvent((state) => ({ ...state, [ev.id]: updater(state[ev.id] || {}) }))
  const [wrongFlash, setWrongFlash] = useState<string | null>(null)
  const [wrongMsg, setWrongMsg] = useState<{ particleId: string; guessed: ParticleKind } | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const total = ev.particles.length
  const doneCount = ev.particles.filter((p) => identified[p.id]).length
  const allDone = doneCount === total

  useEffect(() => {
    if (!wrongFlash) return
    const t = setTimeout(() => setWrongFlash(null), 500)
    return () => clearTimeout(t)
  }, [wrongFlash])

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

    drawDetector(ctx)

    // IP
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(CX, CY, 2.5, 0, Math.PI * 2)
    ctx.fill()

    // Draw each particle in appropriate mode
    for (const p of ev.particles) {
      const mode: Mode =
        identified[p.id] ? 'correct' :
        wrongFlash === p.id ? 'wrong' :
        pendingId === p.id ? 'pending' : 'ghost'
      drawParticle(ctx, p.kind, p.angle, mode)
    }
  }, [identified, wrongFlash, pendingId, ev])

  const canvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = cvRef.current!
    const r = cv.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (CW / r.width),
      y: (e.clientY - r.top) * (CH / r.height),
    }
  }

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasCoords(e)
    const target = hitParticle(x, y, ev.particles, identified)
    if (target) {
      setPendingId(target.id)
      setWrongMsg(null)
    } else {
      setPendingId(null)
    }
  }

  const onPillClick = (kind: ParticleKind) => {
    if (!pendingId) return
    const target = ev.particles.find((p) => p.id === pendingId)
    if (!target) return
    if (target.kind === kind) {
      setIdentified((v) => ({ ...v, [target.id]: true }))
      setPendingId(null)
      setWrongMsg(null)
    } else {
      setWrongFlash(target.id)
      setWrongMsg({ particleId: target.id, guessed: kind })
      setPendingId(null)
    }
  }

  const goNext = () => {
    if (eventIdx + 1 < EVENTS.length) {
      if (!readOnly) {
        setEventIdx(eventIdx + 1)
        setWrongMsg(null)
        setWrongFlash(null)
        setPendingId(null)
      }
      onLayerFocused?.(`event-${eventIdx + 1}`)
    }
  }

  const hasNext = eventIdx + 1 < EVENTS.length

  return (
    <div className="atlas-lab">
      <div className="atlas-lab-container">
        <div className="atlas-lab-title-block">
          <div className="atlas-lab-step">PASSO 3 · IDENTIFICAÇÃO</div>
          <h1 className="atlas-lab-title">Identifique as partículas no <span>evento</span></h1>
          <p className="atlas-lab-subtitle">{ev.description}</p>
        </div>
      <div className="atlas-id-events">
        {EVENTS.map((e, i) => {
          const done = EVENTS[i].particles.every((p) => (identifiedByEvent[e.id] || {})[p.id])
          const active = i === eventIdx
          return (
            <button
              key={e.id}
              type="button"
              className={`atlas-id-event-chip${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
              onClick={() => {
                if (!readOnly) {
                  setEventIdx(i)
                  setWrongMsg(null)
                  setWrongFlash(null)
                  setPendingId(null)
                }
                onLayerFocused?.(`event-${i}`)
              }}
            >
              <span className="atlas-id-event-chip-num">{i + 1}</span>
              <span className="atlas-id-event-chip-name">{e.name}</span>
              {done && <span className="atlas-id-event-chip-check">{'\u2713'}</span>}
            </button>
          )
        })}
      </div>

      <div className="atlas-id-prompt">
        {pendingId
          ? 'Esta trajetória é qual partícula?'
          : 'Clique sobre uma trajetória no detector para identificá-la'}
      </div>

      <div className={`atlas-sig-picker${pendingId ? '' : ' is-idle'}`}>
        {(Object.keys(PARTICLE_META) as ParticleKind[]).map((k) => {
          const m = PARTICLE_META[k]
          return (
            <button
              key={k}
              type="button"
              className="atlas-sig-pill"
              onClick={() => onPillClick(k)}
              disabled={!pendingId}
            >
              <span className="atlas-sig-pill-sym" style={{ color: m.color }}>{m.symbol}</span>
              <span className="atlas-sig-pill-label">{m.label}</span>
            </button>
          )
        })}
      </div>

      <div className="atlas-lab-main">
        <div className="atlas-lab-canvas-col">
          <div className="atlas-lab-canvas-frame">
            <canvas
              ref={cvRef}
              className="atlas-lab-canvas"
              onClick={onCanvasClick}
              style={{ cursor: 'crosshair' }}
            />
          </div>
          <div className="atlas-lab-hint atlas-sig-hint">
            {pendingId
              ? 'Trajetória selecionada — agora escolha a partícula acima'
              : 'Clique em qualquer trajetória branca para começar'}
          </div>
        </div>

        <aside className="atlas-lab-info-col" aria-live="polite">
          {allDone ? (
            <div className="atlas-lab-done">
              <div className="atlas-lab-done-icon"><span>{'\u2713'}</span></div>
              <div className="atlas-lab-done-title">{ev.name} identificado</div>
              <p className="atlas-lab-done-text">
                {hasNext
                  ? 'Você reconheceu todas as partículas deste evento. Vamos para o próximo.'
                  : 'Você identificou todas as partículas em todos os eventos. Missão concluída.'}
              </p>
              {hasNext && (
                <button type="button" className="atlas-lab-done-cta" onClick={goNext}>
                  Próximo evento →
                </button>
              )}
            </div>
          ) : (
            <div className="atlas-id-panel">
              <div className="atlas-id-panel-head">
                <div className="atlas-id-event-tag">EVENTO {eventIdx + 1}/{EVENTS.length}</div>
                <div className="atlas-id-event-name">{ev.name}</div>
              </div>
              <p className="atlas-id-panel-desc">{ev.description}</p>
              <div className="atlas-id-panel-count">
                <span className="atlas-id-count-value">{doneCount}</span>
                <span className="atlas-id-count-total">/ {total}</span>
                <span className="atlas-id-count-label">partículas identificadas</span>
              </div>
              <div className="atlas-id-particles">
                {ev.particles.map((p, i) => (
                  <div
                    key={p.id}
                    className={`atlas-id-slot${identified[p.id] ? ' is-done' : ''}${wrongFlash === p.id ? ' is-wrong' : ''}`}
                  >
                    <span className="atlas-id-slot-num">{i + 1}</span>
                    <span className="atlas-id-slot-label">
                      {identified[p.id] ? PARTICLE_META[p.kind].label : '—'}
                    </span>
                  </div>
                ))}
              </div>
              {wrongMsg && (
                <div className="atlas-id-feedback is-wrong">
                  <strong>Não é {PARTICLE_META[wrongMsg.guessed].label.toLowerCase()}.</strong> Olhe onde a
                  trajetória termina e compare com as assinaturas que você aprendeu — escolha outra pílula
                  e tente de novo.
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
      </div>
    </div>
  )
}

export default Identificacao

// ============================================================
// Drawing
// ============================================================

function drawDetector(ctx: CanvasRenderingContext2D) {
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
}

function drawPendingHalo(ctx: CanvasRenderingContext2D, kind: ParticleKind, ang: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 16
  ctx.lineCap = 'round'
  if (kind === 'neutrino') {
    const len = 300
    const x1 = CX + 10 * Math.cos(ang)
    const y1 = CY + 10 * Math.sin(ang)
    const x2 = CX + len * Math.cos(ang)
    const y2 = CY + len * Math.sin(ang)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  } else if (kind === 'photon') {
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 22
    const r1 = L.ecal.ri - 4
    const r2 = L.ecal.ro + 4
    ctx.beginPath()
    ctx.moveTo(CX + r1 * Math.cos(ang), CY + r1 * Math.sin(ang))
    ctx.lineTo(CX + r2 * Math.cos(ang), CY + r2 * Math.sin(ang))
    ctx.stroke()
  } else {
    const rMax = kind === 'muon' ? 310 : 160
    const steps = 40
    ctx.beginPath()
    ctx.moveTo(CX, CY)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const r = t * rMax
      const curvature = kind === 'electron' ? 0.25 : kind === 'muon' ? 0.18 : 0.14
      const a = ang + curvature * t * t
      ctx.lineTo(CX + r * Math.cos(a), CY + r * Math.sin(a))
    }
    ctx.stroke()
  }
  ctx.restore()
}

function curvedTrack(
  ctx: CanvasRenderingContext2D,
  rMax: number,
  angle: number,
  curvature: number,
  color: string,
  lineWidth: number,
) {
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

// Canonical: torre de energia como barra de histograma (igual /assinaturas).
function drawEnergyTower(
  ctx: CanvasRenderingContext2D,
  ring: 'ecal' | 'hcal',
  ang: number,
  energy: number,
  fill: string,
  stroke: string,
  tangentialWidth?: number,
) {
  const isEcal = ring === 'ecal'
  const rIn = isEcal ? L.ecal.ri : L.hcal.ri
  const rOut = isEcal ? L.ecal.ro : L.hcal.ro
  const fullLen = rOut - rIn
  const e = Math.max(0, Math.min(1, energy))
  const len = 10 + (fullLen - 10) * e
  const w = tangentialWidth ?? (4 + e * 3)

  ctx.save()
  ctx.translate(CX, CY)
  ctx.rotate(ang)
  if (fill !== 'transparent') {
    ctx.fillStyle = fill
    ctx.fillRect(rIn, -w / 2, len, w)
  }
  ctx.strokeStyle = stroke
  ctx.lineWidth = 0.8
  ctx.strokeRect(rIn, -w / 2, len, w)
  ctx.restore()
}

function drawParticle(ctx: CanvasRenderingContext2D, kind: ParticleKind, ang: number, mode: Mode) {
  const pendingColor = '#ffffff'
  const trackColor = mode === 'correct'
    ? (kind === 'muon' ? T.muonTrack : T.track)
    : mode === 'wrong' ? T.wrong
    : mode === 'pending' ? pendingColor
    : T.ghost
  const trackWidth = mode === 'pending' ? 3.2 : 2.4
  const emColor = mode === 'correct' ? T.towerEM : mode === 'wrong' ? T.wrong : 'transparent'
  const emStroke = mode === 'pending' ? pendingColor : mode === 'ghost' ? T.ghost : mode === 'wrong' ? T.wrong : 'rgba(0,0,0,0.3)'
  const hadColor = mode === 'correct' ? T.towerHAD : mode === 'wrong' ? T.wrong : 'transparent'
  const hadStroke = mode === 'pending' ? pendingColor : mode === 'ghost' ? T.ghost : mode === 'wrong' ? T.wrong : 'rgba(0,0,0,0.3)'
  const metColor = mode === 'correct' ? T.met : mode === 'wrong' ? T.wrong : mode === 'pending' ? pendingColor : T.ghost

  // Pending halo — wide faint stroke behind the actual signature
  if (mode === 'pending') {
    drawPendingHalo(ctx, kind, ang)
  }

  if (kind === 'muon') {
    curvedTrack(ctx, 310, ang, 0.18, trackColor, trackWidth + 0.2)
    if (mode === 'correct') {
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
    }
    return
  }

  if (kind === 'electron') {
    curvedTrack(ctx, 150, ang, 0.25, trackColor, trackWidth)
    // Chuveiro EM compacto e alto
    drawEnergyTower(ctx, 'ecal', ang + 0.04, 0.9, emColor, emStroke, 7)
    return
  }

  if (kind === 'photon') {
    drawEnergyTower(ctx, 'ecal', ang, 0.85, emColor, emStroke, 7)
    return
  }

  if (kind === 'jet') {
    const spread = 0.22
    for (let i = -3; i <= 3; i++) {
      const a = ang + i * (spread / 6)
      curvedTrack(ctx, 150, a, 0.12 + 0.04 * Math.abs(i), trackColor, mode === 'pending' ? 2 : 1.5)
    }
    // Jato deposita em múltiplas torres adjacentes — EM pequeno, HAD grande e espalhado
    for (let i = -2; i <= 2; i++) {
      const a = ang + i * 0.045
      const eEM = 0.45 * (1 - 0.25 * Math.abs(i))
      drawEnergyTower(ctx, 'ecal', a, eEM, emColor, emStroke, 5)
    }
    for (let i = -3; i <= 3; i++) {
      const a = ang + i * 0.05
      const eHad = 0.85 * (1 - 0.18 * Math.abs(i))
      drawEnergyTower(ctx, 'hcal', a, eHad, hadColor, hadStroke, 6)
    }
    return
  }

  if (kind === 'neutrino') {
    const len = 300
    const x1 = CX + 10 * Math.cos(ang)
    const y1 = CY + 10 * Math.sin(ang)
    const x2 = CX + len * Math.cos(ang)
    const y2 = CY + len * Math.sin(ang)
    ctx.strokeStyle = metColor
    ctx.lineWidth = 2.5
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.setLineDash([])
    const ah = 12
    const aw = 0.45
    ctx.fillStyle = metColor
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - ah * Math.cos(ang - aw), y2 - ah * Math.sin(ang - aw))
    ctx.lineTo(x2 - ah * Math.cos(ang + aw), y2 - ah * Math.sin(ang + aw))
    ctx.closePath()
    ctx.fill()
    if (mode === 'correct') {
      ctx.fillStyle = T.met
      ctx.font = "700 11px 'JetBrains Mono',monospace"
      ctx.textAlign = 'center'
      const lx = CX + (len + 14) * Math.cos(ang)
      const ly = CY + (len + 14) * Math.sin(ang)
      ctx.fillText('MET', lx, ly)
    }
  }
}

// Angle-based hit test — each particle has an angular "footprint"; nearest unidentified wins
function hitParticle(
  x: number,
  y: number,
  particles: EventParticle[],
  identified: Record<string, boolean>,
): EventParticle | null {
  const dx = x - CX
  const dy = y - CY
  const r = Math.sqrt(dx * dx + dy * dy)
  if (r < 6 || r > 330) return null
  const theta = Math.atan2(dy, dx)
  const tolerance = 0.22 // ~12° wide fan around each particle's angle
  let best: EventParticle | null = null
  let bestDelta = Infinity
  for (const p of particles) {
    if (identified[p.id]) continue
    let delta = Math.abs(theta - p.angle)
    if (delta > Math.PI) delta = Math.PI * 2 - delta
    if (delta < tolerance && delta < bestDelta) {
      best = p
      bestDelta = delta
    }
  }
  return best
}
