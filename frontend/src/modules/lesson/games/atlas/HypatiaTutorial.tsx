import { useState, useRef, useEffect } from 'react'

/*
 * HypatiaTutorial — cópia adaptada. Activity: step-{0..6} (master pode
 * pular a turma pra um passo específico). Filtro/pick continuam livres.
 */
import './atlasLab.css'

const MISSION_ID = 'atlas.hypatia.tutorial'

function parseSubActivity(activityId: string | null | undefined): string | null {
  if (!activityId) return null
  const prefix = `${MISSION_ID}.`
  if (activityId.startsWith(prefix)) return activityId.slice(prefix.length)
  return null
}

export interface HypatiaTutorialProps {
  currentActivityId?: string | null
  onLayerFocused?: (subId: string) => void
  readOnly?: boolean
}

// Smaller side-by-side canvases
const TW = 400, TH = 400, TX = 200, TY = 200  // transversal
const LW = 440, LH = 260, LX = 220, LY = 130  // longitudinal

const T = {
  canvasBg: '#06060e',
  id: '#2a2a2a', idBorder: '#555',
  ecal: '#6abf4b', ecalDark: '#4a9a30',
  hcal: '#d4726a', hcalDark: '#b85550',
  muon: '#5b8ec9', muonDark: '#3a6a9f',
  muonTrack: '#ff44ff',
  track: '#4dd0e1',
  noise: 'rgba(200,200,220,0.45)',
  pending: '#ffffff',
}

// Transversal layer radii (scaled for 400px canvas → half of 640)
const LT = {
  id: { ri: 3, ro: 58 },
  ecal: { ri: 60, ro: 95 },
  hcal: { ri: 97, ro: 138 },
  muon: { ri: 145, ro: 193 },
}

// Longitudinal geometry (scaled down from the 700x480 we used in Reconhecimento)
const LG = {
  idBarrelW: 70, idBarrelH: 26,
  emBarrelW: 80, emBarrelH1: 30, emBarrelH2: 48,
  emEndcapX1: 86, emEndcapX2: 115, emEndcapH2: 48,
  hadBarrelW: 105, hadBarrelH1: 52, hadBarrelH2: 72,
  hadEndcapX1: 112, hadEndcapX2: 160, hadEndcapH2: 72,
  muBarrelY: 82, muBarrelH: 10,
  muEndcapX: 170, muEndcapW: 8, muEndcapY2: 90,
}

// ================== Event data ============================

interface Track {
  id: string
  kind: 'muon' | 'noise'
  phi: number      // direction in 2D
  pT: number       // GeV
  eta: number      // pseudo-rapidity (for longitudinal projection)
}

const MUON1: Track = { id: 'mu1', kind: 'muon', phi: -Math.PI * 0.22, pT: 45, eta: 0.05 }
const MUON2: Track = { id: 'mu2', kind: 'muon', phi:  Math.PI * 0.78, pT: 45, eta: -0.08 }

const NOISE_TRACKS: Track[] = [
  { id: 'n1', kind: 'noise', phi:  Math.PI * 0.18, pT: 2.1, eta: 0.4 },
  { id: 'n2', kind: 'noise', phi: -Math.PI * 0.55, pT: 3.4, eta: -0.6 },
  { id: 'n3', kind: 'noise', phi:  Math.PI * 0.4,  pT: 1.8, eta: 0.2 },
  { id: 'n4', kind: 'noise', phi: -Math.PI * 0.82, pT: 2.7, eta: -0.3 },
]

// ================== Steps =================================

interface Step {
  title: string
  body: string
  hint?: string
}

const STEPS: Step[] = [
  {
    title: 'Duas vistas para o mesmo evento',
    body: 'O HYPATIA mostra sempre duas vistas: transversal (como se olhasse o feixe de frente) e longitudinal (de lado). Antes de classificar qualquer partícula, olhe as duas — uma sozinha pode enganar.',
    hint: 'Clique em “Próximo passo” quando estiver pronto.',
  },
  {
    title: 'Aplique o filtro de energia mínima',
    body: 'Sem filtro, o display mostra tracks de baixa energia que são ruído. Aplique o corte pT ≥ 10 GeV para ficar só com as partículas relevantes para análise de Z/W.',
    hint: 'Clique no botão “pT ≥ 10 GeV” na barra de ferramentas.',
  },
  {
    title: 'Localize os múons',
    body: 'Com o ruído filtrado, sobraram os dois tracks principais. Veja que eles saem do ponto de colisão e atravessam todas as camadas até chegar ao espectrômetro azul: essa é a assinatura do múon.',
    hint: 'Confirme que você viu os dois múons.',
  },
  {
    title: 'Ative a ferramenta Pick',
    body: 'A ferramenta Pick permite selecionar tracks individuais para medir massa invariante. Ative-a antes de clicar em qualquer track.',
    hint: 'Clique no botão “Pick Tool”.',
  },
  {
    title: 'Insira o primeiro múon',
    body: 'Com o Pick ativo, clique sobre um dos múons. Ele fica marcado e entra na lista de partículas analisadas.',
    hint: 'Clique em qualquer múon no canvas da esquerda ou da direita.',
  },
  {
    title: 'Insira o segundo múon',
    body: 'Agora clique no outro múon para formar o par. Quando dois múons estão selecionados, o HYPATIA calcula a massa invariante automaticamente.',
    hint: 'Clique no múon restante.',
  },
  {
    title: 'Leia o resultado',
    body: 'A massa invariante aparece no painel de resultados. Se os dois múons vieram do bóson Z, o valor fica próximo de 91 GeV. Esse é o protocolo completo — você acabou de fazer o que físicos do ATLAS fazem 50 eventos por dia.',
    hint: 'Tutorial concluído.',
  },
]

// ================== Component =============================

export function HypatiaTutorial(props: HypatiaTutorialProps = {}) {
  const { currentActivityId, onLayerFocused, readOnly = false } = props
  const cvT = useRef<HTMLCanvasElement | null>(null)
  const cvL = useRef<HTMLCanvasElement | null>(null)

  const [step, setStep] = useState(0)

  useEffect(() => {
    const sub = parseSubActivity(currentActivityId)
    if (sub?.startsWith('step-')) {
      const n = parseInt(sub.slice('step-'.length), 10)
      if (!Number.isNaN(n) && n >= 0 && n !== step) setStep(n)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentActivityId])
  const [filterOn, setFilterOn] = useState(false)
  const [pickOn, setPickOn] = useState(false)
  const [picked, setPicked] = useState<string[]>([])

  const muon1Picked = picked.includes('mu1')
  const muon2Picked = picked.includes('mu2')
  const bothPicked = muon1Picked && muon2Picked

  const mass = bothPicked ? invariantMass(MUON1, MUON2) : null

  const visibleNoise = filterOn ? [] : NOISE_TRACKS
  const visibleMuons = [MUON1, MUON2]

  // --- Step-driven UI expectations -----------------------------
  const canClickFilter = step === 1 && !filterOn
  const canClickPick = step === 3 && !pickOn
  const canClickTrackFor = (id: string) => {
    if (!pickOn) return false
    if (step === 4 && picked.length === 0) return true
    if (step === 5 && picked.length === 1 && !picked.includes(id)) return true
    return false
  }

  // Auto-advance on completing key actions
  useEffect(() => {
    if (step === 1 && filterOn) setStep(2)
  }, [step, filterOn])
  useEffect(() => {
    if (step === 3 && pickOn) setStep(4)
  }, [step, pickOn])
  useEffect(() => {
    if (step === 4 && picked.length === 1) setStep(5)
    if (step === 5 && picked.length === 2) setStep(6)
  }, [step, picked])

  // --- Transversal canvas -------------------------------------
  useEffect(() => {
    const cv = cvT.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    cv.width = TW * dpr
    cv.height = TH * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = T.canvasBg
    ctx.fillRect(0, 0, TW, TH)
    drawTrans(ctx)

    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(TX, TY, 2, 0, Math.PI * 2)
    ctx.fill()

    // Noise first
    for (const t of visibleNoise) drawTransTrack(ctx, t, false, false, false)
    // Muons
    for (const t of visibleMuons) {
      const isPicked = picked.includes(t.id)
      const highlightSuggested = step === 2 && !isPicked
      drawTransTrack(ctx, t, isPicked, highlightSuggested, false)
    }

    if (step === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.font = "500 12px 'Instrument Sans',sans-serif"
      ctx.textAlign = 'center'
      ctx.fillText('Vista transversal', TX, 22)
    }
  }, [step, filterOn, pickOn, picked])

  // --- Longitudinal canvas ------------------------------------
  useEffect(() => {
    const cv = cvL.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    cv.width = LW * dpr
    cv.height = LH * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = T.canvasBg
    ctx.fillRect(0, 0, LW, LH)
    drawLong(ctx)

    // Beam line
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, LY)
    ctx.lineTo(LW, LY)
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(LX, LY, 2, 0, Math.PI * 2)
    ctx.fill()

    for (const t of visibleNoise) drawLongTrack(ctx, t, false, false)
    for (const t of visibleMuons) {
      const isPicked = picked.includes(t.id)
      const highlightSuggested = step === 2 && !isPicked
      drawLongTrack(ctx, t, isPicked, highlightSuggested)
    }

    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.font = "500 11px 'Instrument Sans',sans-serif"
    ctx.textAlign = 'left'
    ctx.fillText('Vista longitudinal', 10, 18)
  }, [step, filterOn, pickOn, picked])

  // --- Hit testing --------------------------------------------
  const hitTrans = (x: number, y: number): Track | null => {
    const dx = x - TX, dy = y - TY
    const r = Math.sqrt(dx * dx + dy * dy)
    if (r < 4 || r > 200) return null
    const theta = Math.atan2(dy, dx)
    const curveOffset = 0.18 * Math.pow(r / 200, 2)
    const tracks = [...visibleMuons, ...visibleNoise]
    let best: Track | null = null
    let bestD = Infinity
    for (const t of tracks) {
      const expected = t.phi + (t.kind === 'muon' ? curveOffset : 0)
      let diff = ((theta - expected) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
      if (diff > Math.PI) diff -= 2 * Math.PI
      const d = Math.abs(diff)
      if (d < 0.3 && d < bestD) { best = t; bestD = d }
    }
    return best
  }

  const onTransClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = cvT.current!
    const r = cv.getBoundingClientRect()
    const x = (e.clientX - r.left) * (TW / r.width)
    const y = (e.clientY - r.top) * (TH / r.height)
    const t = hitTrans(x, y)
    if (!t || t.kind !== 'muon') return
    if (!canClickTrackFor(t.id)) return
    if (!picked.includes(t.id)) setPicked((p) => [...p, t.id])
  }

  // Longitudinal: simple horizontal slab detection
  const hitLong = (x: number, _y: number): Track | null => {
    const dx = x - LX
    // Rough: muon1 goes to +x, muon2 to -x (since they're back-to-back)
    // Use sign of cos(phi) as rough indicator
    if (!visibleMuons.length) return null
    let best: Track | null = null
    let bestD = Infinity
    for (const t of visibleMuons) {
      const expectedX = Math.cos(t.phi) * 150  // 150 pixel "arm"
      const d = Math.abs(dx - expectedX)
      if (d < 60 && d < bestD) { best = t; bestD = d }
    }
    return best
  }

  const onLongClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = cvL.current!
    const r = cv.getBoundingClientRect()
    const x = (e.clientX - r.left) * (LW / r.width)
    const y = (e.clientY - r.top) * (LH / r.height)
    const t = hitLong(x, y)
    if (!t) return
    if (!canClickTrackFor(t.id)) return
    if (!picked.includes(t.id)) setPicked((p) => [...p, t.id])
  }

  const current = STEPS[step]

  return (
    <div className="atlas-lab">
      <div className="atlas-lab-container">
        <div className="atlas-lab-title-block">
          <div className="atlas-lab-step">PASSO 5 · TUTORIAL HYPATIA</div>
          <h1 className="atlas-lab-title">Aprenda a operar o <span>HYPATIA</span></h1>
          <p className="atlas-lab-subtitle">
            {readOnly
              ? 'Acompanhe os passos conduzidos pelo mestre.'
              : '7 passos guiados para usar a ferramenta que você vai encontrar na próxima missão.'}
          </p>
        </div>
      <div className="atlas-tut-stepper">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`atlas-tut-step-dot${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      <div className="atlas-tut-instruction">
        <div className="atlas-tut-instruction-head">
          <span className="atlas-tut-step-num">Passo {step + 1}/7</span>
          <h2>{current.title}</h2>
        </div>
        <p className="atlas-tut-body">{current.body}</p>
        {current.hint && <p className="atlas-tut-hint">{current.hint}</p>}
      </div>

      <div className="atlas-tut-ui">
        <aside className="atlas-tut-toolbar">
          <div className="atlas-tut-toolbar-head">FERRAMENTAS</div>
          <button
            type="button"
            className={`atlas-tut-tool${filterOn ? ' is-on' : ''}${canClickFilter ? ' is-glow' : ''}`}
            onClick={() => canClickFilter && setFilterOn(true)}
            disabled={!canClickFilter && !filterOn}
          >
            pT ≥ 10 GeV
            {filterOn && <span className="atlas-tut-tool-on">●</span>}
          </button>
          <button
            type="button"
            className={`atlas-tut-tool${pickOn ? ' is-on' : ''}${canClickPick ? ' is-glow' : ''}`}
            onClick={() => canClickPick && setPickOn(true)}
            disabled={!canClickPick && !pickOn}
          >
            Pick Tool
            {pickOn && <span className="atlas-tut-tool-on">●</span>}
          </button>
          <button
            type="button"
            className="atlas-tut-tool"
            disabled
            title="Ativado automaticamente ao clicar no track"
          >
            Insert Track
          </button>

          <div className="atlas-tut-toolbar-head" style={{ marginTop: 18 }}>RESULTADOS</div>
          <div className="atlas-tut-results">
            <div className="atlas-tut-result-row">
              <span className="atlas-tut-result-label">Tracks inseridos</span>
              <span className="atlas-tut-result-value">{picked.length}/2</span>
            </div>
            <div className="atlas-tut-result-row">
              <span className="atlas-tut-result-label">m(μμ)</span>
              <span className="atlas-tut-result-value">
                {mass !== null ? `${mass.toFixed(1)} GeV` : '—'}
              </span>
            </div>
            {mass !== null && (
              <div className="atlas-tut-result-comment">
                Massa do bóson Z: 91 GeV. Seu valor está {Math.abs(mass - 91) < 5 ? '✓ dentro do esperado' : 'fora do esperado'}.
              </div>
            )}
          </div>
        </aside>

        <div className="atlas-tut-views">
          <div
            className={`atlas-tut-view${step === 4 || step === 5 ? ' is-interactive' : ''}`}
          >
            <canvas
              ref={cvT}
              onClick={onTransClick}
              style={{ cursor: pickOn && (step === 4 || step === 5) ? 'crosshair' : 'default' }}
            />
          </div>
          <div
            className={`atlas-tut-view${step === 4 || step === 5 ? ' is-interactive' : ''}`}
          >
            <canvas
              ref={cvL}
              onClick={onLongClick}
              style={{ cursor: pickOn && (step === 4 || step === 5) ? 'crosshair' : 'default' }}
            />
          </div>
        </div>
      </div>

      <div className="atlas-tut-nav">
        {step === 0 && (
          <button type="button" className="atlas-lab-done-cta" onClick={() => { if (!readOnly) setStep(1); onLayerFocused?.('step-1') }}>
            Próximo passo →
          </button>
        )}
        {step === 2 && (
          <button type="button" className="atlas-lab-done-cta" onClick={() => { if (!readOnly) setStep(3); onLayerFocused?.('step-3') }}>
            Próximo passo →
          </button>
        )}
        {step === 6 && (
          <div className="atlas-lab-done atlas-tut-done">
            <div className="atlas-lab-done-icon"><span>{'\u2713'}</span></div>
            <div className="atlas-lab-done-title">Tutorial concluído</div>
            <p className="atlas-lab-done-text">
              Você aprendeu o protocolo completo: duas vistas, filtro, Pick, Insert, leitura de massa.
              Na próxima missão, o HYPATIA real com dados reais.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

export default HypatiaTutorial

// ================== Physics ==================

function invariantMass(a: Track, b: Track): number {
  const E1 = a.pT * Math.cosh(a.eta)
  const E2 = b.pT * Math.cosh(b.eta)
  const px1 = a.pT * Math.cos(a.phi), py1 = a.pT * Math.sin(a.phi), pz1 = a.pT * Math.sinh(a.eta)
  const px2 = b.pT * Math.cos(b.phi), py2 = b.pT * Math.sin(b.phi), pz2 = b.pT * Math.sinh(b.eta)
  const Esum = E1 + E2
  const pxs = px1 + px2, pys = py1 + py2, pzs = pz1 + pz2
  const m2 = Esum * Esum - (pxs * pxs + pys * pys + pzs * pzs)
  return Math.sqrt(Math.max(0, m2))
}

// ================== Drawing ==================

function drawTrans(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = 0.55
  // muon ring
  ctx.fillStyle = T.muon
  ctx.beginPath()
  ctx.arc(TX, TY, LT.muon.ro, 0, Math.PI * 2)
  ctx.arc(TX, TY, LT.muon.ri, 0, Math.PI * 2, true)
  ctx.fill()
  // hcal
  ctx.fillStyle = T.hcal
  ctx.beginPath()
  ctx.arc(TX, TY, LT.hcal.ro, 0, Math.PI * 2)
  ctx.arc(TX, TY, LT.hcal.ri, 0, Math.PI * 2, true)
  ctx.fill()
  // ecal
  ctx.fillStyle = T.ecal
  ctx.beginPath()
  ctx.arc(TX, TY, LT.ecal.ro, 0, Math.PI * 2)
  ctx.arc(TX, TY, LT.ecal.ri, 0, Math.PI * 2, true)
  ctx.fill()
  // id
  ctx.fillStyle = T.id
  ctx.beginPath()
  ctx.arc(TX, TY, LT.id.ro, 0, Math.PI * 2)
  ctx.arc(TX, TY, LT.id.ri, 0, Math.PI * 2, true)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawTransTrack(
  ctx: CanvasRenderingContext2D,
  t: Track,
  picked: boolean,
  suggested: boolean,
  _pending: boolean,
) {
  const isMuon = t.kind === 'muon'
  // Canonical: noise tracks em cyan (#4dd0e1) como em /assinaturas (jet tracks)
  const color = picked ? T.muonTrack : isMuon ? T.pending : T.track
  const rMax = isMuon ? 193 : 70
  const curvature = isMuon ? 0.18 : 0.2
  const width = picked ? 3 : isMuon ? 2.2 : 1.6
  const alpha = picked ? 1 : isMuon ? 0.85 : 0.75

  if (suggested) {
    // pulsing halo to suggest clicking
    ctx.save()
    ctx.strokeStyle = 'rgba(255,204,0,0.35)'
    ctx.lineWidth = 12
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(TX, TY)
    for (let i = 1; i <= 40; i++) {
      const tt = i / 40
      const r = tt * rMax
      const a = t.phi + curvature * tt * tt
      ctx.lineTo(TX + r * Math.cos(a), TY + r * Math.sin(a))
    }
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(TX, TY)
  for (let i = 1; i <= 48; i++) {
    const tt = i / 48
    const r = tt * rMax
    const a = t.phi + curvature * tt * tt
    ctx.lineTo(TX + r * Math.cos(a), TY + r * Math.sin(a))
  }
  ctx.stroke()
  ctx.restore()

  if (picked && isMuon) {
    const mr = 170
    const mx = TX + mr * Math.cos(t.phi + 0.18)
    const my = TY + mr * Math.sin(t.phi + 0.18)
    ctx.fillStyle = T.muonTrack
    ctx.beginPath()
    ctx.arc(mx, my, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawLong(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = 0.55

  // Muon slab (outer)
  ctx.fillStyle = T.muon
  for (const sy of [1, -1]) {
    ctx.fillRect(LX - LG.muEndcapX, LY + sy * LG.muBarrelY - LG.muBarrelH / 2, LG.muEndcapX * 2, LG.muBarrelH)
  }
  // HCal
  ctx.fillStyle = T.hcal
  for (const sy of [1, -1]) {
    ctx.fillRect(LX - LG.hadBarrelW, LY + sy * LG.hadBarrelH1, LG.hadBarrelW * 2, sy * (LG.hadBarrelH2 - LG.hadBarrelH1))
    ctx.fillRect(LX + LG.hadEndcapX1, LY - LG.hadEndcapH2, LG.hadEndcapX2 - LG.hadEndcapX1, LG.hadEndcapH2 * 2)
    ctx.fillRect(LX - LG.hadEndcapX2, LY - LG.hadEndcapH2, LG.hadEndcapX2 - LG.hadEndcapX1, LG.hadEndcapH2 * 2)
  }
  // ECal
  ctx.fillStyle = T.ecal
  for (const sy of [1, -1]) {
    ctx.fillRect(LX - LG.emBarrelW, LY + sy * LG.emBarrelH1, LG.emBarrelW * 2, sy * (LG.emBarrelH2 - LG.emBarrelH1))
    ctx.fillRect(LX + LG.emEndcapX1, LY - LG.emEndcapH2, LG.emEndcapX2 - LG.emEndcapX1, LG.emEndcapH2 * 2)
    ctx.fillRect(LX - LG.emEndcapX2, LY - LG.emEndcapH2, LG.emEndcapX2 - LG.emEndcapX1, LG.emEndcapH2 * 2)
  }
  // ID
  ctx.fillStyle = T.id
  ctx.fillRect(LX - LG.idBarrelW, LY - LG.idBarrelH, LG.idBarrelW * 2, LG.idBarrelH * 2)

  ctx.globalAlpha = 1
}

function drawLongTrack(ctx: CanvasRenderingContext2D, t: Track, picked: boolean, suggested: boolean) {
  const isMuon = t.kind === 'muon'
  // Canonical: noise tracks em cyan
  const color = picked ? T.muonTrack : isMuon ? T.pending : T.track
  // Determine direction in longitudinal: x = cos(phi), y = small eta contribution
  const dirX = Math.cos(t.phi)
  const rMax = isMuon ? 150 : 60
  const x2 = LX + dirX * rMax
  const slope = Math.tanh(t.eta) * 0.4
  const y2 = LY + slope * rMax * Math.abs(dirX)

  if (suggested) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255,204,0,0.35)'
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(LX, LY)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.globalAlpha = picked ? 1 : isMuon ? 0.85 : 0.75
  ctx.strokeStyle = color
  ctx.lineWidth = picked ? 2.8 : isMuon ? 2 : 1.6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(LX, LY)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()

  if (picked && isMuon) {
    ctx.fillStyle = T.muonTrack
    ctx.beginPath()
    ctx.arc(x2, y2, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}
