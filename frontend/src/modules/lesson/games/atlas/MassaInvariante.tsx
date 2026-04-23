import { useState, useRef, useEffect, useMemo } from 'react'
/*
 * MassaInvariante — cópia adaptada. Activity: event-{N} (master sincroniza
 * qual evento a turma analisa). Filtro pT e análise individual continuam
 * livres ao aluno (não propagam).
 */
import './atlasLab.css'

const MISSION_ID = 'atlas.massainvariante'

function parseSubActivity(activityId: string | null | undefined): string | null {
  if (!activityId) return null
  const prefix = `${MISSION_ID}.`
  if (activityId.startsWith(prefix)) return activityId.slice(prefix.length)
  return null
}

export interface MassaInvarianteProps {
  currentActivityId?: string | null
  onLayerFocused?: (subId: string) => void
  readOnly?: boolean
}

const CW = 640, CH = 640, CX = 320, CY = 320
const HW = 400, HH = 240  // histogram canvas

const PT_CUT = 10 // GeV — threshold for the filter (BAMA/tutorial variant)

const T = {
  canvasBg: '#06060e',
  id: '#2a2a2a', idBorder: '#555',
  ecal: '#6abf4b', ecalDark: '#4a9a30',
  hcal: '#d4726a', hcalDark: '#b85550',
  muon: '#5b8ec9', muonDark: '#3a6a9f',
  muonTrack: '#ff44ff',
  track: '#4dd0e1',      // canonical — tracks carregadas genéricas (igual /assinaturas)
  towerEM: '#dddd00',    // canonical — depósitos no ECAL
  towerHAD: '#ddaa00',   // canonical — depósitos no HCAL
  met: '#ff2222',        // canonical — MET arrow
  pending: '#ffffff',
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

// ================== Data =========================

interface Muon {
  id: string
  pT: number
  eta: number
  phi: number
  charge: 1 | -1
}

type NoiseKind = 'pion' | 'kaon' | 'proton' | 'electron'

interface NoiseTrack {
  id: string
  phi: number
  pT: number
  curveSign: 1 | -1
  kind: NoiseKind
}

const PARTICLE_INFO: Record<NoiseKind | 'muon', {
  symbol: string
  name: string
  hint: string
  desc: string
}> = {
  muon: {
    symbol: 'μ',
    name: 'Múon',
    hint: 'Candidato ao sinal Z→μμ',
    desc: 'Lépton pesado que atravessa todos os calorímetros e chega ao espectrômetro de múons. Passa no corte de pT e é o único tipo relevante para reconstruir a massa do Z.',
  },
  pion: {
    symbol: 'π⁺',
    name: 'Píon',
    hint: 'Hádron — ruído de fundo',
    desc: 'Cerca de 80-85% dos tracks de fundo no LHC são píons (quark–antiquark). De baixa energia, param no calorímetro hadrônico. Abaixo do corte de 10 GeV.',
  },
  kaon: {
    symbol: 'K⁺',
    name: 'Káon',
    hint: 'Hádron estranho — ruído',
    desc: '~10-12% do fundo. Contém um quark estranho. Também fica abaixo do corte de pT para análise de Z.',
  },
  proton: {
    symbol: 'p',
    name: 'Próton',
    hint: 'Bárion — ruído',
    desc: '~5-8% do fundo. Partícula composta. Vem do underlying event ou pileup, não do processo duro.',
  },
  electron: {
    symbol: 'e⁻',
    name: 'Elétron',
    hint: 'Lépton — ruído soft',
    desc: 'Elétron de baixa energia do underlying event. Para no calorímetro EM (verde). Em eventos Z→ee, elétrons teriam pT alto — aqui estão abaixo do corte.',
  },
}

function pickNoiseKind(u: number): NoiseKind {
  // Distribuição real aproximada: π 80%, K 12%, p 5%, e 3%
  if (u < 0.80) return 'pion'
  if (u < 0.92) return 'kaon'
  if (u < 0.97) return 'proton'
  return 'electron'
}

interface ClusterTower {
  id: string
  phi: number
  ring: 'ecal' | 'hcal'
  size: number // fator multiplicativo 0.7–1.3
}

interface Met {
  phi: number
  magnitude: number // comprimento normalizado 0.4–0.9 (× raio muon)
}

interface MassEvent {
  id: string
  muons: Muon[]
  noise: NoiseTrack[]
  towers: ClusterTower[]
  met: Met | null
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rand: () => number, mu: number, sigma: number) {
  const u1 = Math.max(1e-6, rand())
  const u2 = rand()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mu + sigma * z
}

function generateEvents(): MassEvent[] {
  const rand = mulberry32(42)
  const events: MassEvent[] = []
  for (let i = 0; i < 20; i++) {
    // ---- Signal muon pair (Z → μμ) ----
    const mTarget = Math.max(75, Math.min(105, gaussian(rand, 91, 3)))
    const eta = gaussian(rand, 0, 0.15)
    const phi1 = rand() * Math.PI * 2
    const phi2 = phi1 + Math.PI + gaussian(rand, 0, 0.05)
    const dphi = phi2 - phi1
    const factor = 2 * (Math.cosh(0) - Math.cos(dphi))
    const pT1 = 25 + rand() * 50 // 25..75 GeV — sempre acima do corte de 10
    const pT2 = (mTarget * mTarget) / (factor * pT1)

    // ---- Background noise tracks (poucas, pions/hádrons) ----
    // HYPATIA mostra tipicamente 3-5 tracks principais no display (após soft cuts).
    const nNoise = 3 + Math.floor(rand() * 3) // 3..5
    const noise: NoiseTrack[] = []
    for (let j = 0; j < nNoise; j++) {
      const u1 = rand()
      const pT = 0.5 + 7.5 * u1 * u1
      const phi = rand() * Math.PI * 2
      const curveSign: 1 | -1 = rand() < 0.5 ? 1 : -1
      const kind = pickNoiseKind(rand())
      noise.push({ id: `${i}n${j}`, phi, pT, curveSign, kind })
    }

    // ---- Cluster towers (depósitos de energia no ECAL/HCAL) ----
    // Muitos tijolinhos amarelos espalhados ao redor do calorímetro — representam
    // energia medida independente de haver track associada.
    const nTowers = 15 + Math.floor(rand() * 11) // 15..25
    const towers: ClusterTower[] = []
    for (let j = 0; j < nTowers; j++) {
      const phi = rand() * Math.PI * 2
      const ring: 'ecal' | 'hcal' = rand() < 0.7 ? 'ecal' : 'hcal'
      const size = 0.7 + rand() * 0.6
      towers.push({ id: `${i}t${j}`, phi, ring, size })
    }

    // ---- MET ---- (40% dos eventos têm MET visível — resolução do detector)
    const met: Met | null = rand() < 0.4
      ? { phi: rand() * Math.PI * 2, magnitude: 0.4 + rand() * 0.4 }
      : null

    events.push({
      id: `e${i + 1}`,
      muons: [
        { id: `${i}a`, pT: pT1, eta, phi: phi1, charge: 1 },
        { id: `${i}b`, pT: pT2, eta, phi: phi2, charge: -1 },
      ],
      noise,
      towers,
      met,
    })
  }
  return events
}

function invariantMass(a: Muon, b: Muon): number {
  const E1 = a.pT * Math.cosh(a.eta)
  const E2 = b.pT * Math.cosh(b.eta)
  const px1 = a.pT * Math.cos(a.phi), py1 = a.pT * Math.sin(a.phi), pz1 = a.pT * Math.sinh(a.eta)
  const px2 = b.pT * Math.cos(b.phi), py2 = b.pT * Math.sin(b.phi), pz2 = b.pT * Math.sinh(b.eta)
  const Esum = E1 + E2
  const pxs = px1 + px2, pys = py1 + py2, pzs = pz1 + pz2
  const m2 = Esum * Esum - (pxs * pxs + pys * pys + pzs * pzs)
  return Math.sqrt(Math.max(0, m2))
}

// HYPATIA mostra tracks como linhas quase retas — a curvatura do campo magnético
// existe mas é sutil na visualização 2D. Usamos linha reta com pequeno desvio angular.
function noiseReach(pT: number): number {
  // pT=0.5 → 45 px (fica no tracker); 2 → 90; 4 → 145 (ECAL); 6 → 200 (HCAL)
  return Math.min(210, 35 + pT * 28)
}
function noiseBend(pT: number): number {
  // Curvatura total ao longo da trajetória: ~0.02 a 0.12 rad (quase reto)
  return Math.min(0.12, 0.1 / Math.sqrt(Math.max(0.5, pT)))
}

// ================== Histogram ==============================

const HIST_MIN = 60
const HIST_MAX = 120
const HIST_BINS = 15
const BIN_WIDTH = (HIST_MAX - HIST_MIN) / HIST_BINS

function binIndex(m: number): number | null {
  if (m < HIST_MIN || m >= HIST_MAX) return null
  return Math.floor((m - HIST_MIN) / BIN_WIDTH)
}

// ================== Component ==============================

export function MassaInvariante(props: MassaInvarianteProps = {}) {
  const { currentActivityId, onLayerFocused, readOnly = false } = props
  const cvRef = useRef<HTMLCanvasElement | null>(null)
  const hvRef = useRef<HTMLCanvasElement | null>(null)

  const events = useMemo(() => generateEvents(), [])
  const [eventIdx, setEventIdx] = useState(0)

  useEffect(() => {
    const sub = parseSubActivity(currentActivityId)
    if (sub?.startsWith('event-')) {
      const idx = parseInt(sub.slice('event-'.length), 10)
      if (!Number.isNaN(idx) && idx >= 0 && idx < events.length && idx !== eventIdx) {
        setEventIdx(idx)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentActivityId])
  const ev = events[eventIdx]

  const [filterOn, setFilterOn] = useState(false)
  const [filterEverUsed, setFilterEverUsed] = useState(false)
  const [pendingMuonId, setPendingMuonId] = useState<string | null>(null)
  const [doneEvents, setDoneEvents] = useState<Record<string, number>>({})
  const [hist, setHist] = useState<number[]>(new Array(HIST_BINS).fill(0))
  const [lastMass, setLastMass] = useState<number | null>(null)
  const [inspected, setInspected] = useState<
    | { kind: 'muon'; muonId: string }
    | { kind: 'noise'; noiseId: string }
    | null
  >(null)

  // Reset inspeção ao trocar de evento ou aplicar filtro
  useEffect(() => {
    setInspected(null)
  }, [eventIdx, filterOn])

  const analyzed = Object.keys(doneEvents).length
  const allDone = analyzed >= events.length

  // ---- Detector canvas ----
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

    // Background (tracks + towers + MET) somente se o filtro não está ativo
    if (!filterOn) {
      for (const t of ev.towers) drawTower(ctx, t)
      for (const n of ev.noise) {
        const isInspected = inspected?.kind === 'noise' && inspected.noiseId === n.id
        drawNoiseTrack(ctx, n, isInspected)
      }
      if (ev.met) drawMet(ctx, ev.met)
    }

    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(CX, CY, 2.5, 0, Math.PI * 2)
    ctx.fill()

    const isDone = !!doneEvents[ev.id]
    for (const mu of ev.muons) {
      const pending = pendingMuonId === mu.id && !isDone
      const isInspected = inspected?.kind === 'muon' && inspected.muonId === mu.id
      drawMuon(ctx, mu.phi, pending, isDone, isInspected)
    }

    // On-canvas prompt apenas quando não há filtro (visualmente bagunçado)
    if (!filterOn && !pendingMuonId && !isDone) {
      ctx.fillStyle = 'rgba(255,255,255,0.32)'
      ctx.font = "600 13px 'Instrument Sans',sans-serif"
      ctx.textAlign = 'center'
      ctx.fillText('Muitos tracks — aplique o filtro', CX, CY + 8)
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.font = "500 11px 'Instrument Sans',sans-serif"
      ctx.fillText(`pT ≥ ${PT_CUT} GeV acima`, CX, CY + 24)
    }
  }, [ev, pendingMuonId, doneEvents, filterOn])

  // ---- Histogram canvas ----
  useEffect(() => {
    const cv = hvRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    cv.width = HW * dpr
    cv.height = HH * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    drawHistogram(ctx, hist, lastMass)
  }, [hist, lastMass])

  const canvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = cvRef.current!
    const r = cv.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (CW / r.width),
      y: (e.clientY - r.top) * (CH / r.height),
    }
  }

  type HitResult =
    | { kind: 'muon'; muon: Muon }
    | { kind: 'noise'; track: NoiseTrack }
    | null

  const hitAnyTrack = (x: number, y: number): HitResult => {
    const dx = x - CX
    const dy = y - CY
    const r = Math.sqrt(dx * dx + dy * dy)
    if (r < 6) return null
    const theta = Math.atan2(dy, dx)
    const TWO_PI = Math.PI * 2

    // Muons primeiro (se o evento não está "done")
    if (!doneEvents[ev.id] && r <= 330) {
      const curveOffset = 0.18 * Math.pow(Math.min(r, 310) / 310, 2)
      let best: Muon | null = null
      let bestDelta = Infinity
      for (const mu of ev.muons) {
        const expected = mu.phi + curveOffset
        let diff = ((theta - expected) % TWO_PI + TWO_PI) % TWO_PI
        if (diff > Math.PI) diff -= TWO_PI
        const delta = Math.abs(diff)
        if (delta < 0.28 && delta < bestDelta) {
          best = mu
          bestDelta = delta
        }
      }
      if (best) return { kind: 'muon', muon: best }
    }

    // Noise só se filtro estiver off
    if (!filterOn) {
      let bestN: NoiseTrack | null = null
      let bestDN = Infinity
      for (const n of ev.noise) {
        const reach = noiseReach(n.pT)
        if (r > reach + 10) continue
        // O ângulo do track no raio r ≈ phi + totalBend · (r/reach)
        const t = r / reach
        const expected = n.phi + noiseBend(n.pT) * n.curveSign * t
        let diff = ((theta - expected) % TWO_PI + TWO_PI) % TWO_PI
        if (diff > Math.PI) diff -= TWO_PI
        const delta = Math.abs(diff)
        if (delta < 0.08 && delta < bestDN) {
          bestN = n
          bestDN = delta
        }
      }
      if (bestN) return { kind: 'noise', track: bestN }
    }

    return null
  }

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasCoords(e)
    const hit = hitAnyTrack(x, y)
    if (!hit) {
      setInspected(null)
      return
    }

    if (hit.kind === 'noise') {
      setInspected({ kind: 'noise', noiseId: hit.track.id })
      return
    }

    // Muon hit
    const mu = hit.muon
    setInspected({ kind: 'muon', muonId: mu.id })

    // Par-picking funciona apenas com filtro aplicado
    if (!filterOn) return

    if (!pendingMuonId) {
      setPendingMuonId(mu.id)
      return
    }
    if (pendingMuonId === mu.id) {
      setPendingMuonId(null)
      return
    }
    const first = ev.muons.find((m) => m.id === pendingMuonId)!
    const mass = invariantMass(first, mu)
    const bin = binIndex(mass)
    if (bin !== null) {
      setHist((h) => {
        const next = [...h]
        next[bin] += 1
        return next
      })
    }
    setDoneEvents((d) => ({ ...d, [ev.id]: mass }))
    setLastMass(mass)
    setPendingMuonId(null)
  }

  const goNext = () => {
    if (eventIdx + 1 < events.length) {
      if (!readOnly) setEventIdx(eventIdx + 1)
      onLayerFocused?.(`event-${eventIdx + 1}`)
    }
    setPendingMuonId(null)
  }
  const goPrev = () => {
    if (eventIdx > 0) {
      if (!readOnly) setEventIdx(eventIdx - 1)
      onLayerFocused?.(`event-${eventIdx - 1}`)
    }
    setPendingMuonId(null)
  }

  const peakBin = hist.indexOf(Math.max(...hist))
  const peakMass = analyzed > 0 && Math.max(...hist) > 0 ? HIST_MIN + (peakBin + 0.5) * BIN_WIDTH : null
  const showingPeak = analyzed >= 8

  const currentMass = doneEvents[ev.id] ?? null

  return (
    <div className="atlas-lab">
      <div className="atlas-lab-container">
        <div className="atlas-lab-title-block">
          <div className="atlas-lab-step">PASSO 4 · MASSA INVARIANTE</div>
          <h1 className="atlas-lab-title">A aritmética do bóson <span>Z</span></h1>
          <p className="atlas-lab-subtitle">
            Em cada evento, aplique o filtro de energia, identifique os dois múons e registre a massa invariante. Com o tempo, um pico vai emergir no histograma em torno de 91 GeV.
          </p>
        </div>
      <div className="atlas-mass-briefing">
        <div className="atlas-mass-briefing-primary">
          O <strong>bóson Z</strong> é uma partícula fundamental descoberta no CERN em 1983, com
          massa ~91 GeV. Quando um Z decai em dois múons (μ⁺μ⁻) de cargas opostas, podemos medir
          sua massa pela fórmula da massa invariante do par.
        </div>
        <div className="atlas-mass-briefing-note">
          Os 20 eventos abaixo já foram pré-selecionados como candidatos Z→μμ. Cada um contém ruído
          de fundo (pions, kaons, outras partículas de baixa energia). Aplique o filtro
          <strong> pT ≥ {PT_CUT} GeV</strong> para limpar o display antes de analisar.
        </div>
      </div>

      <div className="atlas-mass-toolbar">
        <button
          type="button"
          className={`atlas-mass-filter${filterOn ? ' is-on' : ''}${!filterOn && !filterEverUsed ? ' is-glow' : ''}`}
          onClick={() => {
            setFilterOn((f) => !f)
            setFilterEverUsed(true)
          }}
          title={filterOn ? 'Clique para remover o filtro e ver o evento cru' : 'Clique para aplicar o corte pT'}
        >
          pT ≥ {PT_CUT} GeV
          {filterOn && <span className="atlas-mass-filter-check">{'\u2713'}</span>}
        </button>
        <div className="atlas-mass-toolbar-tag">
          EVENTO {eventIdx + 1}/{events.length}
        </div>
        <div className="atlas-mass-toolbar-nav">
          <button type="button" onClick={goPrev} disabled={eventIdx === 0}>← Anterior</button>
          <button type="button" onClick={goNext} disabled={eventIdx === events.length - 1}>Próximo →</button>
        </div>
      </div>

      <div className="atlas-mass-main">
        <div className="atlas-mass-left">
          <div className="atlas-lab-canvas-frame atlas-mass-canvas-frame">
            <canvas
              ref={cvRef}
              className="atlas-lab-canvas"
              onClick={onCanvasClick}
              style={{ cursor: 'crosshair' }}
            />
          </div>

          {inspected && (() => {
            let info, pT, passes
            if (inspected.kind === 'muon') {
              const mu = ev.muons.find((m) => m.id === inspected.muonId)!
              info = PARTICLE_INFO.muon
              pT = mu.pT
              passes = mu.pT >= PT_CUT
            } else {
              const n = ev.noise.find((n) => n.id === inspected.noiseId)!
              info = PARTICLE_INFO[n.kind]
              pT = n.pT
              passes = n.pT >= PT_CUT
            }
            return (
              <div className={`atlas-mass-inspector${passes ? ' is-pass' : ' is-fail'}`}>
                <div className="atlas-mass-inspector-head">
                  <span className="atlas-mass-inspector-sym">{info.symbol}</span>
                  <div className="atlas-mass-inspector-title">
                    <div className="atlas-mass-inspector-name">{info.name}</div>
                    <div className="atlas-mass-inspector-hint">{info.hint}</div>
                  </div>
                  <div className="atlas-mass-inspector-pt">
                    <span className="atlas-mass-inspector-pt-val">{pT.toFixed(1)}</span>
                    <span className="atlas-mass-inspector-pt-unit">GeV</span>
                  </div>
                </div>
                <div className="atlas-mass-inspector-desc">{info.desc}</div>
                <div className="atlas-mass-inspector-cut">
                  {passes
                    ? `✓ Passa o corte pT ≥ ${PT_CUT} GeV — relevante para análise`
                    : `✗ Abaixo do corte pT ≥ ${PT_CUT} GeV — será removido pelo filtro`}
                </div>
              </div>
            )
          })()}

          <div className="atlas-mass-measure">
            {currentMass !== null ? (
              <>
                <div className="atlas-mass-measure-label">Massa invariante medida</div>
                <div className="atlas-mass-measure-value">
                  m(μμ) = <strong>{currentMass.toFixed(1)}</strong> GeV
                </div>
                <div className="atlas-mass-measure-compare">
                  {Math.abs(currentMass - 91) < 5
                    ? '✓ Próximo de m(Z) = 91 GeV'
                    : 'Fora do esperado para Z'}
                </div>
              </>
            ) : (
              <div className="atlas-mass-measure-empty">
                {filterOn
                  ? pendingMuonId
                    ? 'Clique no segundo múon para calcular a massa'
                    : 'Clique nos dois múons para medir'
                  : `Aplique o filtro pT ≥ ${PT_CUT} GeV antes de selecionar múons`}
              </div>
            )}
          </div>

          <div className="atlas-lab-hint atlas-sig-hint">
            pT dos múons do sinal: {ev.muons.map((m, i) => `μ${i + 1} = ${m.pT.toFixed(1)} GeV`).join(' · ')}
          </div>
        </div>

        <aside className="atlas-mass-right">
          <div className="atlas-mass-hist-wrap">
            <div className="atlas-mass-hist-head">
              <div className="atlas-mass-hist-title">Histograma de m(μμ)</div>
              <div className="atlas-mass-hist-counter">
                <span className="atlas-mass-hist-count">{analyzed}</span>
                <span className="atlas-mass-hist-total">/ {events.length}</span>
              </div>
            </div>
            <canvas ref={hvRef} className="atlas-mass-hist" />
            {showingPeak && peakMass !== null && (
              <div className="atlas-mass-peak">
                Pico emergente em <strong>~{peakMass.toFixed(0)} GeV</strong> — a massa do bóson Z
              </div>
            )}
            {allDone && (
              <div className="atlas-lab-done atlas-mass-done">
                <div className="atlas-lab-done-title">Bóson Z reconstruído</div>
                <p className="atlas-lab-done-text">
                  Você analisou os 20 eventos. A massa medida converge para 91 GeV — assinatura do
                  bóson Z. Você reproduziu o método que físicos do ATLAS usam todo dia para
                  monitorar a produção do Z e medir suas propriedades.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
      </div>
    </div>
  )
}

export default MassaInvariante

// ================== Drawing ================================

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

function drawNoiseTrack(ctx: CanvasRenderingContext2D, n: NoiseTrack, inspected = false) {
  // Canonical estilo jet-track de /assinaturas: cyan + curvatura moderada + width 1.6
  const reach = noiseReach(n.pT)
  // Curvatura na faixa 0.12-0.25 (tracks de baixo pT curvam mais)
  const curvature = (0.12 + Math.min(0.13, 1.0 / Math.max(0.5, n.pT))) * n.curveSign
  const steps = 36

  ctx.save()
  if (inspected) {
    ctx.strokeStyle = '#b084ff' // roxo — padrão HYPATIA online de seleção
    ctx.lineWidth = 2.6
    ctx.shadowColor = 'rgba(176,132,255,0.7)'
    ctx.shadowBlur = 8
  } else {
    ctx.strokeStyle = T.track
    ctx.lineWidth = 1.6
  }
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(CX, CY)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const r = t * reach
    const a = n.phi + curvature * t * t
    ctx.lineTo(CX + r * Math.cos(a), CY + r * Math.sin(a))
  }
  ctx.stroke()
  ctx.restore()
}

// Canonical: torre de energia como barra de histograma (igual /assinaturas).
// Tangencialmente fina, radialmente longa, altura proporcional à energia.
function drawEnergyTower(
  ctx: CanvasRenderingContext2D,
  ring: 'ecal' | 'hcal',
  ang: number,
  energy: number,
  tangentialWidth?: number,
) {
  const isEcal = ring === 'ecal'
  const rIn = isEcal ? L.ecal.ri : L.hcal.ri
  const rOut = isEcal ? L.ecal.ro : L.hcal.ro
  const fullLen = rOut - rIn
  const e = Math.max(0, Math.min(1, energy))
  const len = 10 + (fullLen - 10) * e
  const w = tangentialWidth ?? (4 + e * 3)
  const fill = isEcal ? T.towerEM : T.towerHAD

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

function drawTower(ctx: CanvasRenderingContext2D, tower: ClusterTower) {
  // tower.size (0.7-1.3) interpretado como energia relativa
  // Normaliza para 0-1: size=0.7 → energy 0.25, size=1.3 → energy 0.85
  const energy = Math.max(0, Math.min(1, (tower.size - 0.7) / 0.6 * 0.6 + 0.25))
  drawEnergyTower(ctx, tower.ring, tower.phi, energy)
}

function drawMet(ctx: CanvasRenderingContext2D, met: Met) {
  const len = 210 * met.magnitude
  const x1 = CX + 10 * Math.cos(met.phi)
  const y1 = CY + 10 * Math.sin(met.phi)
  const x2 = CX + len * Math.cos(met.phi)
  const y2 = CY + len * Math.sin(met.phi)
  ctx.save()
  ctx.strokeStyle = T.met
  ctx.lineWidth = 2.5
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
  // arrow head
  const ah = 12
  const aw = 0.45
  ctx.fillStyle = T.met
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - ah * Math.cos(met.phi - aw), y2 - ah * Math.sin(met.phi - aw))
  ctx.lineTo(x2 - ah * Math.cos(met.phi + aw), y2 - ah * Math.sin(met.phi + aw))
  ctx.closePath()
  ctx.fill()
  // label "MET" — canonical /assinaturas
  ctx.fillStyle = T.met
  ctx.font = "700 11px 'JetBrains Mono',monospace"
  ctx.textAlign = 'center'
  const lx = CX + (len + 14) * Math.cos(met.phi)
  const ly = CY + (len + 14) * Math.sin(met.phi)
  ctx.fillText('MET', lx, ly)
  ctx.restore()
}

function drawMuon(
  ctx: CanvasRenderingContext2D,
  phi: number,
  pending: boolean,
  done: boolean,
  inspected = false,
) {
  if (pending || inspected) {
    ctx.save()
    ctx.strokeStyle = inspected && !pending
      ? 'rgba(176,132,255,0.28)'
      : 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 16
    ctx.lineCap = 'round'
    const steps = 40
    ctx.beginPath()
    ctx.moveTo(CX, CY)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const r = t * 310
      const a = phi + 0.18 * t * t
      ctx.lineTo(CX + r * Math.cos(a), CY + r * Math.sin(a))
    }
    ctx.stroke()
    ctx.restore()
  }

  const color = done ? T.muonTrack : inspected && !pending ? '#b084ff' : T.pending
  const width = pending ? 3 : inspected ? 2.8 : 2.4
  const alpha = done ? 1 : pending || inspected ? 1 : 0.85
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  const steps = 48
  ctx.beginPath()
  ctx.moveTo(CX, CY)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const r = t * 310
    const a = phi + 0.18 * t * t
    ctx.lineTo(CX + r * Math.cos(a), CY + r * Math.sin(a))
  }
  ctx.stroke()
  ctx.restore()

  if (done) {
    const mr = 270
    const mx = CX + mr * Math.cos(phi + 0.18)
    const my = CY + mr * Math.sin(phi + 0.18)
    ctx.fillStyle = T.muonTrack
    ctx.beginPath()
    ctx.arc(mx, my, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
}

function drawHistogram(ctx: CanvasRenderingContext2D, hist: number[], lastMass: number | null) {
  const pad = { l: 48, r: 16, t: 20, b: 40 }
  const plotW = HW - pad.l - pad.r
  const plotH = HH - pad.t - pad.b
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, HW, HH)

  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad.l, pad.t)
  ctx.lineTo(pad.l, pad.t + plotH)
  ctx.lineTo(pad.l + plotW, pad.t + plotH)
  ctx.stroke()

  const maxCount = Math.max(1, ...hist)
  const barW = plotW / HIST_BINS
  ctx.fillStyle = '#1a4a7a'
  for (let i = 0; i < HIST_BINS; i++) {
    const count = hist[i]
    if (count === 0) continue
    const h = (count / maxCount) * plotH
    ctx.fillRect(pad.l + i * barW + 1, pad.t + plotH - h, barW - 2, h)
  }

  if (lastMass !== null) {
    const bin = binIndex(lastMass)
    if (bin !== null) {
      ctx.fillStyle = 'rgba(45,122,30,0.35)'
      const count = hist[bin]
      const h = (count / maxCount) * plotH
      ctx.fillRect(pad.l + bin * barW + 1, pad.t + plotH - h, barW - 2, h)
    }
  }

  const zX = pad.l + ((91 - HIST_MIN) / (HIST_MAX - HIST_MIN)) * plotW
  ctx.strokeStyle = '#d32f2f'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.moveTo(zX, pad.t)
  ctx.lineTo(zX, pad.t + plotH)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#d32f2f'
  ctx.font = "700 10px 'JetBrains Mono',monospace"
  ctx.textAlign = 'left'
  ctx.fillText('m(Z) = 91', zX + 4, pad.t + 12)

  ctx.fillStyle = '#555550'
  ctx.font = "500 11px 'JetBrains Mono',monospace"
  ctx.textAlign = 'center'
  for (let v = HIST_MIN; v <= HIST_MAX; v += 15) {
    const x = pad.l + ((v - HIST_MIN) / (HIST_MAX - HIST_MIN)) * plotW
    ctx.fillText(`${v}`, x, pad.t + plotH + 16)
    ctx.strokeStyle = '#e2e0d8'
    ctx.beginPath()
    ctx.moveTo(x, pad.t + plotH)
    ctx.lineTo(x, pad.t + plotH + 4)
    ctx.stroke()
  }
  ctx.fillText('m(μμ) [GeV]', pad.l + plotW / 2, pad.t + plotH + 32)

  ctx.save()
  ctx.translate(14, pad.t + plotH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = '#555550'
  ctx.font = "500 11px 'JetBrains Mono',monospace"
  ctx.textAlign = 'center'
  ctx.fillText('nº de pares μμ', 0, 0)
  ctx.restore()

  ctx.fillStyle = '#555550'
  ctx.textAlign = 'right'
  for (let i = 0; i <= maxCount; i++) {
    const y = pad.t + plotH - (i / maxCount) * plotH
    ctx.fillText(`${i}`, pad.l - 6, y + 3)
    ctx.strokeStyle = '#e2e0d8'
    ctx.beginPath()
    ctx.moveTo(pad.l - 3, y)
    ctx.lineTo(pad.l, y)
    ctx.stroke()
  }
}
