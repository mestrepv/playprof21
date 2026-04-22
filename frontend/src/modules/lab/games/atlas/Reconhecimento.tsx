import { useState, useRef, useEffect } from 'react'

/*
 * Cópia adaptada de src/test/atlas-lab/missoes/Reconhecimento.tsx.
 *
 * Adaptações pro runtime do module_lab:
 *   1. Não usa AtlasLabLayout (o SlideShell do módulo já é o wrapper).
 *   2. Aceita props opcionais { currentActivityId, onLayerFocused, readOnly }:
 *      - currentActivityId: quando master seta via setActivity, força a
 *        camada destacada ("atlas.reconhecimento.{id|ecal|hcal|muon}" → sel).
 *      - onLayerFocused: callback chamado ao clicar numa camada. Em master,
 *        dispara setActivity via adapter; em player, dispara logEvent.
 *      - readOnly: se true, cliques não alteram sel local (player após
 *        master ter setado a camada — player apenas acompanha).
 *   3. Mantém o CSS via import do atlasLab.css do standalone.
 *
 * A versão standalone em /test/atlas-lab continua intocada.
 */

import './atlasLab.css'

const ACTIVITY_PREFIX = 'atlas.reconhecimento.'

type LayerIdExternal = 'id' | 'ecal' | 'hcal' | 'muon'
type TabIdExternal = 'long' | 'trans'

/**
 * activityId pode carregar dois aspectos sincronizáveis:
 *   - layer destacada: "id" | "ecal" | "hcal" | "muon" (legado, sem prefixo)
 *   - aba ativa:       "tab-long" | "tab-trans"
 * A última ação do master sobrescreve o activityId no servidor; o player
 * parseia qual aspecto mudou e atualiza apenas esse state local — o outro
 * aspecto (tab quando muda layer, layer quando muda tab) permanece intacto.
 */
function parseTabOrLayer(
  activityId: string | null | undefined,
): { kind: 'layer'; value: LayerIdExternal } | { kind: 'tab'; value: TabIdExternal } | null {
  if (!activityId) return null
  if (!activityId.startsWith(ACTIVITY_PREFIX)) return null
  const tail = activityId.slice(ACTIVITY_PREFIX.length)
  if (tail === 'id' || tail === 'ecal' || tail === 'hcal' || tail === 'muon') {
    return { kind: 'layer', value: tail }
  }
  if (tail === 'tab-long') return { kind: 'tab', value: 'long' }
  if (tail === 'tab-trans') return { kind: 'tab', value: 'trans' }
  return null
}

export interface ReconhecimentoProps {
  /** Activity id ditada pelo master via setActivity (null = sem destaque). */
  currentActivityId?: string | null
  /** Callback ao clicar numa camada ou aba. Recebe subId local:
   *  "id"|"ecal"|"hcal"|"muon" (camada) ou "tab-long"|"tab-trans" (aba). */
  onLayerFocused?: (subId: string) => void
  /** Se true, clique do usuário não altera state local (só master propaga). */
  readOnly?: boolean
}

// Transversal canvas (square)
const CW = 640, CH = 640, CX = 320, CY = 320

// Longitudinal canvas (landscape)
const LCW = 700, LCH = 480, LCX = 350, LCY = 240

const T = {
  canvasBg: '#06060e',
  id: '#2a2a2a',
  idBorder: '#555',
  ecal: '#6abf4b',
  ecalDark: '#4a9a30',
  hcal: '#d4726a',
  hcalDark: '#b85550',
  muon: '#5b8ec9',
  muonDark: '#3a6a9f',
  muonLight: '#6ea0d8',
}

// Longitudinal geometry (half-lengths from center, in pixels)
const GEO = {
  idBarrelW: 110, idBarrelH: 42,
  idEndcapX1: 115, idEndcapX2: 140, idEndcapH: 42,
  solW: 112, solH: 46, solThick: 3,
  emBarrelW: 125, emBarrelH1: 48, emBarrelH2: 76,
  emEndcapX1: 135, emEndcapX2: 180, emEndcapH1: 20, emEndcapH2: 76,
  hadBarrelW: 165, hadBarrelH1: 80, hadBarrelH2: 115,
  hadEndcapX1: 175, hadEndcapX2: 250, hadEndcapH1: 28, hadEndcapH2: 115,
  hadExtX1: 165, hadExtX2: 250, hadExtH1: 80, hadExtH2: 115,
  muBarrelChambers: [
    { y: 125, h: 12, x1: 0, x2: 165 },
    { y: 148, h: 10, x1: 0, x2: 180 },
    { y: 170, h: 14, x1: 0, x2: 195 },
    { y: 200, h: 10, x1: 30, x2: 175 },
  ],
  muEndcapChambers: [
    { x: 260, w: 10, y1: 20, y2: 130 },
    { x: 280, w: 8, y1: 15, y2: 160 },
    { x: 305, w: 12, y1: 10, y2: 190 },
    { x: 225, w: 8, y1: 100, y2: 170 },
  ],
  muForwardChambers: [
    { x: 185, w: 6, y1: 25, y2: 80 },
    { x: 200, w: 7, y1: 20, y2: 90 },
  ],
}

type LayerId = 'id' | 'ecal' | 'hcal' | 'muon'
type TabId = 'trans' | 'long'

interface Layer {
  id: LayerId
  label: string
  subtitle: string
  ri: number
  ro: number
  color: string
  fill: string
  hoverFill: string
  tagColor: string
  tagBg: string
  what: string
  role: string
  hypatia: string
}

const LAYERS: Layer[] = [
  {
    id: 'id', label: 'Inner Detector', subtitle: 'Tracker de Silício + TRT',
    ri: 4, ro: 92, color: '#666', fill: T.id, hoverFill: '#383838',
    tagColor: '#666', tagBg: '#f0f0ee',
    what: 'Três subdetectores de precisão crescente — Pixel (resolução de 10 μm), SCT (micro-strips de silício) e TRT (tubos de gás xenônio) — imersos no campo magnético de 2 Tesla do solenóide supercondutor.',
    role: 'Reconstrói a trajetória (track) de cada partícula carregada e mede seu momento transverso (pT) pela curvatura no campo magnético. Quanto mais reto o track, maior o momento.',
    hypatia: 'Região cinza escura no centro do display. Os tracks — as linhas coloridas que saem do ponto de colisão — são desenhados aqui. A cor do track indica o valor de pT.',
  },
  {
    id: 'ecal', label: 'Calorímetro Eletromagnético', subtitle: 'Chumbo + Argônio Líquido',
    ri: 96, ro: 152, color: '#4a9a30', fill: T.ecal, hoverFill: '#7dd65c',
    tagColor: '#2d6b1a', tagBg: '#e8f5e3',
    what: 'Placas de chumbo (absorvedor) em banho de argônio líquido (meio ativo), dispostas em geometria de acordeão para cobertura hermética sem fendas.',
    role: 'Absorve completamente elétrons e fótons, medindo sua energia. O chuveiro eletromagnético é compacto — toda a energia fica contida nesta camada.',
    hypatia: 'Anel verde no display. Quando um elétron ou fóton é absorvido, aparecem torres amarelas nesta região. Se há torre amarela no verde COM track apontando para ela, é elétron. Sem track, é fóton.',
  },
  {
    id: 'hcal', label: 'Calorímetro Hadrônico', subtitle: 'Aço + Cintilador (Tile)',
    ri: 156, ro: 222, color: '#b85550', fill: T.hcal, hoverFill: '#e08878',
    tagColor: '#8a2e2e', tagBg: '#fdf0ee',
    what: 'Blocos de aço intercalados com cintilador plástico (Tile Calorimeter). O aço fornece núcleos pesados para frear hádrons pela interação forte.',
    role: 'Absorve hádrons — prótons, píons, káons, nêutrons — que atravessam o calorímetro EM. O chuveiro hadrônico é mais profundo e espalhado. Essencial para medir energia de jatos e calcular a energia transversa faltante (MET).',
    hypatia: 'Anel vermelho/salmão. Torres amarelas maiores e mais largas aparecem aqui quando há jatos. Regra prática: torres no verde E no vermelho = jato. Torres SÓ no verde = elétron ou fóton.',
  },
  {
    id: 'muon', label: 'Espectrômetro de Múons', subtitle: 'Câmaras de Gás + Toróide',
    ri: 232, ro: 310, color: '#3a6a9f', fill: T.muon, hoverFill: '#70a8e0',
    tagColor: '#1a4a7a', tagBg: '#e8f0fa',
    what: 'Câmaras de tubos de gás (MDT para precisão, RPC/TGC para trigger) no campo magnético do toróide supercondutor. É a camada mais externa e mais volumosa do ATLAS.',
    role: 'Detecta múons — a ÚNICA partícula carregada que atravessa os calorímetros sem ser absorvida e chega até aqui. Se um track chega a esta camada, é múon. Sem ambiguidade.',
    hypatia: 'Câmaras azuis segmentadas na borda do display. A assinatura mais fácil de reconhecer: se o track sai do cinza e chega até o azul, é múon. Sempre.',
  },
]

interface Chamber { a1: number; a2: number; ri: number; ro: number }

function makeChambers(ri: number, ro: number, n: number, gapFrac: number): Chamber[] {
  const segs: Chamber[] = []
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2
    segs.push({ a1, a2: a1 + ((1 - gapFrac) / n) * Math.PI * 2, ri, ro })
  }
  return segs
}

const MU: Chamber[] = [
  ...makeChambers(234, 254, 16, 0.25),
  ...makeChambers(262, 280, 20, 0.3),
  ...makeChambers(288, 308, 24, 0.28),
]

function hitTest(mx: number, my: number): LayerId | null {
  const r = Math.sqrt(mx * mx + my * my)
  if (r >= 232 && r <= 310) return 'muon'
  if (r >= 156 && r <= 222) return 'hcal'
  if (r >= 96 && r <= 152) return 'ecal'
  if (r >= 4 && r <= 92) return 'id'
  return null
}

function hitTestLong(mx: number, my: number): LayerId | null {
  const ax = Math.abs(mx)
  const ay = Math.abs(my)
  for (const ch of GEO.muBarrelChambers) {
    if (ax <= ch.x2 && ay >= ch.y - ch.h / 2 && ay <= ch.y + ch.h / 2) return 'muon'
  }
  for (const ch of GEO.muEndcapChambers) {
    if (ax >= ch.x - ch.w / 2 && ax <= ch.x + ch.w / 2 && ay <= ch.y2) return 'muon'
  }
  for (const ch of GEO.muForwardChambers) {
    if (ax >= ch.x - ch.w / 2 && ax <= ch.x + ch.w / 2 && ay <= ch.y2) return 'muon'
  }
  if (ax <= GEO.hadBarrelW && ay >= GEO.hadBarrelH1 && ay <= GEO.hadBarrelH2) return 'hcal'
  if (ax >= GEO.hadEndcapX1 && ax <= GEO.hadEndcapX2 && ay <= GEO.hadEndcapH2) return 'hcal'
  if (ax >= GEO.hadExtX1 && ax <= GEO.hadExtX2 && ay >= GEO.hadExtH1 && ay <= GEO.hadExtH2) return 'hcal'
  if (ax <= GEO.emBarrelW && ay >= GEO.emBarrelH1 && ay <= GEO.emBarrelH2) return 'ecal'
  if (ax >= GEO.emEndcapX1 && ax <= GEO.emEndcapX2 && ay <= GEO.emEndcapH2) return 'ecal'
  if (ax <= GEO.idBarrelW && ay <= GEO.idBarrelH) return 'id'
  if (ax >= GEO.idEndcapX1 && ax <= GEO.idEndcapX2 && ay <= GEO.idEndcapH) return 'id'
  return null
}

function drawLongitudinal(
  ctx: CanvasRenderingContext2D,
  sel: LayerId | null,
  hov: LayerId | null,
) {
  const isSel = (id: LayerId) => sel === id
  const isHov = (id: LayerId) => hov === id
  const fadeOf = (id: LayerId) => !!sel && sel !== id
  const alphaOf = (id: LayerId) => (fadeOf(id) ? 0.15 : 1)
  const fillOf = (id: LayerId, base: string, hover: string) =>
    isSel(id) ? hover : isHov(id) ? hover + 'd0' : base

  function symRectY(x1: number, x2: number, y1: number, y2: number, fill: string, stroke: string, sw: number) {
    ctx.fillStyle = fill
    ctx.strokeStyle = stroke
    ctx.lineWidth = sw || 0.8
    for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
      const x = LCX + sx * x1
      const y = LCY + sy * y1
      const w = (sx > 0 ? 1 : -1) * (x2 - x1)
      const h = sy * (y2 - y1)
      ctx.fillRect(x, y, w, h)
      if (sw) ctx.strokeRect(x, y, w, h)
    }
  }

  // MUON
  ctx.globalAlpha = alphaOf('muon')
  const muFill = fillOf('muon', T.muon, T.muonLight)
  const muStr = isSel('muon') ? '#8ab8e8' : T.muonDark
  const muSw = isSel('muon') ? 1.5 : 0.8
  for (const ch of GEO.muBarrelChambers) {
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      ctx.fillStyle = muFill
      ctx.fillRect(LCX + sx * ch.x1, LCY + sy * (ch.y - ch.h / 2), (sx > 0 ? 1 : -1) * (ch.x2 - ch.x1), ch.h)
      ctx.strokeStyle = muStr
      ctx.lineWidth = muSw
      ctx.strokeRect(LCX + sx * ch.x1, LCY + sy * (ch.y - ch.h / 2), (sx > 0 ? 1 : -1) * (ch.x2 - ch.x1), ch.h)
    }
  }
  for (const ch of GEO.muEndcapChambers) {
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      ctx.fillStyle = muFill
      ctx.fillRect(LCX + sx * (ch.x - ch.w / 2), LCY + sy * ch.y1, ch.w, sy * (ch.y2 - ch.y1))
      ctx.strokeStyle = muStr
      ctx.lineWidth = muSw
      ctx.strokeRect(LCX + sx * (ch.x - ch.w / 2), LCY + sy * ch.y1, ch.w, sy * (ch.y2 - ch.y1))
    }
  }
  for (const ch of GEO.muForwardChambers) {
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      ctx.fillStyle = muFill
      ctx.fillRect(LCX + sx * (ch.x - ch.w / 2), LCY + sy * ch.y1, ch.w, sy * (ch.y2 - ch.y1))
      ctx.strokeStyle = muStr
      ctx.lineWidth = muSw * 0.7
      ctx.strokeRect(LCX + sx * (ch.x - ch.w / 2), LCY + sy * ch.y1, ch.w, sy * (ch.y2 - ch.y1))
    }
  }

  // HADRONIC
  ctx.globalAlpha = alphaOf('hcal')
  const hadFill = fillOf('hcal', T.hcal, '#e08078')
  const hadStr = isSel('hcal') ? '#f0a098' : T.hcalDark
  const hadSw = isSel('hcal') ? 1.5 : 0.8
  symRectY(0, GEO.hadBarrelW, GEO.hadBarrelH1, GEO.hadBarrelH2, hadFill, hadStr, hadSw)
  symRectY(GEO.hadExtX1, GEO.hadExtX2, GEO.hadExtH1, GEO.hadExtH2, hadFill, hadStr, hadSw)
  symRectY(GEO.hadEndcapX1, GEO.hadEndcapX2, GEO.hadEndcapH1, GEO.hadEndcapH2, hadFill, hadStr, hadSw)
  if (!fadeOf('hcal')) {
    ctx.strokeStyle = `rgba(180,70,60,${isSel('hcal') ? 0.3 : 0.15})`
    ctx.lineWidth = 0.5
    for (let y = GEO.hadBarrelH1; y <= GEO.hadBarrelH2; y += 8) {
      for (const sy of [1, -1]) {
        ctx.beginPath()
        ctx.moveTo(LCX - GEO.hadBarrelW, LCY + sy * y)
        ctx.lineTo(LCX + GEO.hadBarrelW, LCY + sy * y)
        ctx.stroke()
      }
    }
  }

  // EM CAL
  ctx.globalAlpha = alphaOf('ecal')
  const emFill = fillOf('ecal', T.ecal, '#7dd05a')
  const emStr = isSel('ecal') ? '#a0e880' : T.ecalDark
  const emSw = isSel('ecal') ? 1.5 : 0.8
  symRectY(0, GEO.emBarrelW, GEO.emBarrelH1, GEO.emBarrelH2, emFill, emStr, emSw)
  symRectY(GEO.emEndcapX1, GEO.emEndcapX2, GEO.emEndcapH1, GEO.emEndcapH2, emFill, emStr, emSw)
  if (!fadeOf('ecal')) {
    ctx.strokeStyle = `rgba(60,120,40,${isSel('ecal') ? 0.3 : 0.15})`
    ctx.lineWidth = 0.4
    for (let x = -GEO.emBarrelW; x <= GEO.emBarrelW; x += 5) {
      for (const sy of [1, -1]) {
        ctx.beginPath()
        ctx.moveTo(LCX + x, LCY + sy * GEO.emBarrelH1)
        ctx.lineTo(LCX + x, LCY + sy * GEO.emBarrelH2)
        ctx.stroke()
      }
    }
  }

  // SOLENOID (conceptually part of ID)
  ctx.globalAlpha = alphaOf('id')
  ctx.strokeStyle = isSel('id') ? '#888' : '#555'
  ctx.lineWidth = GEO.solThick
  for (const sy of [1, -1]) {
    ctx.strokeRect(
      LCX - GEO.solW,
      LCY + sy * GEO.solH - (sy * GEO.solThick) / 2,
      GEO.solW * 2,
      sy * GEO.solThick,
    )
  }

  // INNER DETECTOR
  ctx.globalAlpha = alphaOf('id')
  const idFill = fillOf('id', T.id, '#3a3a3a')
  const idStr = isSel('id') ? '#888' : T.idBorder
  const idSw = isSel('id') ? 2 : 1
  ctx.fillStyle = idFill
  ctx.fillRect(LCX - GEO.idBarrelW, LCY - GEO.idBarrelH, GEO.idBarrelW * 2, GEO.idBarrelH * 2)
  ctx.strokeStyle = idStr
  ctx.lineWidth = idSw
  ctx.strokeRect(LCX - GEO.idBarrelW, LCY - GEO.idBarrelH, GEO.idBarrelW * 2, GEO.idBarrelH * 2)
  for (const sx of [1, -1]) {
    ctx.fillStyle = idFill
    ctx.fillRect(LCX + sx * GEO.idEndcapX1, LCY - GEO.idEndcapH, (GEO.idEndcapX2 - GEO.idEndcapX1) * sx, GEO.idEndcapH * 2)
    ctx.strokeStyle = idStr
    ctx.lineWidth = idSw * 0.7
    ctx.strokeRect(LCX + sx * GEO.idEndcapX1, LCY - GEO.idEndcapH, (GEO.idEndcapX2 - GEO.idEndcapX1) * sx, GEO.idEndcapH * 2)
  }
  if (!fadeOf('id')) {
    for (const y of [10, 18, 25, 32, 38]) {
      ctx.strokeStyle = `rgba(80,80,80,${isSel('id') ? 0.5 : 0.3})`
      ctx.lineWidth = 0.5
      for (const sy of [1, -1]) {
        ctx.beginPath()
        ctx.moveTo(LCX - GEO.idBarrelW, LCY + sy * y)
        ctx.lineTo(LCX + GEO.idBarrelW, LCY + sy * y)
        ctx.stroke()
      }
    }
  }

  ctx.globalAlpha = 1

  // BEAM LINE (dashed)
  ctx.strokeStyle = '#444'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(0, LCY)
  ctx.lineTo(LCW, LCY)
  ctx.stroke()
  ctx.setLineDash([])

  // BEAM PIPE
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(0, LCY)
  ctx.lineTo(LCW, LCY)
  ctx.stroke()

  // IP
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath()
  ctx.arc(LCX, LCY, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(LCX, LCY, 2.5, 0, Math.PI * 2)
  ctx.fill()

  // AXIS LABELS
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = "600 10px 'Instrument Sans',sans-serif"
  ctx.textAlign = 'center'
  ctx.fillText('← z (eixo do feixe) →', LCX, LCH - 10)
  ctx.save()
  ctx.translate(14, LCY)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('← y (transverso) →', 0, 0)
  ctx.restore()
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = "500 9px 'JetBrains Mono',monospace"
  ctx.fillText('IP', LCX, LCY - 14)

  // REGION LABELS (when nothing selected)
  if (!sel) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.font = "600 9px 'JetBrains Mono',monospace"
    ctx.textAlign = 'center'
    ctx.fillText('BARREL', LCX, LCY + GEO.hadBarrelH2 + 12)
    ctx.fillText('ENDCAP', LCX + GEO.hadEndcapX1 + 38, LCY + GEO.hadEndcapH2 + 12)
    ctx.fillText('ENDCAP', LCX - GEO.hadEndcapX1 - 38, LCY + GEO.hadEndcapH2 + 12)
  }

  // Prompt
  if (!sel) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.font = "500 12px 'Instrument Sans',sans-serif"
    ctx.textAlign = 'center'
    ctx.fillText('Clique em uma camada', LCX, 30)
  }
}

// =====================================================================
// Animação de colisão (vista longitudinal)
// =====================================================================

type CollisionKind = 'muon' | 'electron' | 'photon' | 'hadron' | 'neutrino'

interface CollisionParticle {
  type: CollisionKind
  angle: number
}

// 10 partículas com direções bem distribuídas no plano longitudinal (xy)
const COLLISION: CollisionParticle[] = [
  { type: 'muon',     angle:  Math.PI *  0.35 }, // cima-direita (barrel)
  { type: 'muon',     angle: -Math.PI *  0.60 }, // baixo-esquerda
  { type: 'electron', angle: -Math.PI *  0.12 }, // quase horizontal (endcap direito)
  { type: 'electron', angle:  Math.PI *  0.72 }, // baixo
  { type: 'photon',   angle:  Math.PI *  0.52 }, // cima
  { type: 'photon',   angle: -Math.PI *  0.85 }, // baixo-esquerda, quase horizontal
  { type: 'hadron',   angle:  Math.PI *  0.18 }, // quase horizontal direita
  { type: 'hadron',   angle: -Math.PI *  0.38 }, // baixo-direita
  { type: 'hadron',   angle:  Math.PI *  0.90 }, // horizontal esquerda
  { type: 'neutrino', angle: -Math.PI *  0.22 }, // saindo do detector (MET)
]

// Raio na direção `ang` de uma elipse com semi-eixos a (x) e b (y). Usado para calcular
// quando o track alcança uma camada (barrel vs endcap) do detector longitudinal.
function ellipseR(a: number, b: number, ang: number): number {
  const c = Math.cos(ang), s = Math.sin(ang)
  return 1 / Math.sqrt((c * c) / (a * a) + (s * s) / (b * b))
}

function reachFor(p: CollisionParticle): number {
  switch (p.type) {
    case 'electron':
    case 'photon':   return ellipseR(175, 72, p.angle)   // ECAL (barrel ~76, endcap ~180)
    case 'hadron':   return ellipseR(245, 112, p.angle)  // HCAL
    case 'muon':     return ellipseR(305, 195, p.angle)  // Muon chamber
    case 'neutrino': return 360                          // Sai do canvas
  }
}

function particleStyle(type: CollisionKind): { color: string; width: number; dashed: boolean } {
  switch (type) {
    case 'muon':     return { color: '#ff44ff', width: 2.6, dashed: false }
    case 'electron': return { color: '#4dd0e1', width: 2.2, dashed: false }
    case 'photon':   return { color: '#dddd00', width: 2.0, dashed: true }
    case 'hadron':   return { color: '#4dd0e1', width: 1.8, dashed: false }
    case 'neutrino': return { color: '#ff2222', width: 2.4, dashed: true }
  }
}

const COLLISION_REACH = COLLISION.map(reachFor)

// Raio de parada no corte transversal (layers concêntricas)
function reachForTrans(type: CollisionKind): number {
  switch (type) {
    case 'electron':
    case 'photon':   return 125 // meio do ECAL
    case 'hadron':   return 192 // meio do HCAL
    case 'muon':     return 270 // muon chambers
    case 'neutrino': return 335 // fora do canvas
  }
}
const COLLISION_REACH_TRANS = COLLISION.map((p) => reachForTrans(p.type))

function curvatureForTrans(type: CollisionKind): number {
  switch (type) {
    case 'muon':     return 0.18
    case 'electron': return 0.25
    case 'hadron':   return 0.15
    case 'photon':
    case 'neutrino': return 0
  }
}

// Timeline (seconds):
//   0.0–0.8  feixes aproximam do IP (linhas brancas)
//   0.8–1.0  flash no ponto de colisão
//   1.0–2.8  partículas radiam e param nas suas camadas
//   2.8+     estado estático (tracks + depósitos visíveis)
const T_BEAMS_END = 0.8
const T_FLASH_END = 1.0
const T_TRACK_SPEED = 180 // px/s

function drawCollisionAnimation(ctx: CanvasRenderingContext2D, t: number) {
  // --- Fase 1: feixes incidentes ---
  if (t < T_BEAMS_END) {
    const prog = t / T_BEAMS_END
    const dist = LCX * (1 - prog) // começa na borda, chega no IP
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1.2
    // Linhas mostrando trajeto dos feixes ao longo do eixo z (horizontal)
    ctx.beginPath()
    ctx.moveTo(0, LCY)
    ctx.lineTo(LCX - dist, LCY)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(LCW, LCY)
    ctx.lineTo(LCX + dist, LCY)
    ctx.stroke()
    // Pontinhos brancos representando o pacote de prótons
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(LCX - dist, LCY, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(LCX + dist, LCY, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  // --- Fase 2: flash da colisão ---
  if (t < T_FLASH_END) {
    const prog = (t - T_BEAMS_END) / (T_FLASH_END - T_BEAMS_END)
    const size = 18 + prog * 44
    const alpha = 1 - prog
    ctx.save()
    ctx.fillStyle = `rgba(255,230,120,${alpha * 0.9})`
    ctx.beginPath()
    ctx.arc(LCX, LCY, size, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    ctx.beginPath()
    ctx.arc(LCX, LCY, size * 0.35, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // --- Fase 3: partículas irradiando ---
  const animT = Math.max(0, t - T_FLASH_END + 0.1) // pequeno overlap com flash
  for (let i = 0; i < COLLISION.length; i++) {
    const p = COLLISION[i]
    const maxR = COLLISION_REACH[i]
    const currentR = Math.min(animT * T_TRACK_SPEED, maxR)
    if (currentR <= 0) continue
    drawCollisionTrack(ctx, p, currentR, currentR >= maxR)
  }
}

function drawCollisionTrack(
  ctx: CanvasRenderingContext2D,
  p: CollisionParticle,
  currentR: number,
  done: boolean,
) {
  const style = particleStyle(p.type)
  const x2 = LCX + currentR * Math.cos(p.angle)
  const y2 = LCY + currentR * Math.sin(p.angle)

  ctx.save()

  // Fótons são neutros — não deixam rastro no detector interno. Só aparece o depósito
  // no ECAL quando o fóton chega. Antes disso, nada é visível.
  if (p.type === 'photon') {
    if (done) {
      ctx.fillStyle = '#dddd00'
      ctx.fillRect(x2 - 4, y2 - 4, 8, 8)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 0.8
      ctx.strokeRect(x2 - 4, y2 - 4, 8, 8)
    }
    ctx.restore()
    return
  }

  ctx.strokeStyle = style.color
  ctx.lineWidth = style.width
  ctx.lineCap = 'round'
  if (style.dashed) ctx.setLineDash([7, 5])
  ctx.beginPath()
  ctx.moveTo(LCX, LCY)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  if (style.dashed) ctx.setLineDash([])

  // Ponta: enquanto anima, bolinha brilhante avançando; ao parar, depósito ou marcador
  if (!done) {
    ctx.fillStyle = style.color
    ctx.beginPath()
    ctx.arc(x2, y2, style.width + 1, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Marcador de parada por tipo
    if (p.type === 'muon') {
      // Hit no muon chamber — bolinha magenta com contorno branco
      ctx.fillStyle = '#ff44ff'
      ctx.beginPath()
      ctx.arc(x2, y2, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.stroke()
    } else if (p.type === 'electron') {
      // Depósito amarelo no ECAL
      ctx.fillStyle = '#dddd00'
      ctx.fillRect(x2 - 4, y2 - 4, 8, 8)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 0.8
      ctx.strokeRect(x2 - 4, y2 - 4, 8, 8)
    } else if (p.type === 'hadron') {
      // Depósito âmbar no HCAL (maior e mais espalhado)
      ctx.fillStyle = '#ddaa00'
      ctx.fillRect(x2 - 5, y2 - 5, 10, 10)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 0.8
      ctx.strokeRect(x2 - 5, y2 - 5, 10, 10)
    } else if (p.type === 'neutrino') {
      // Seta na ponta — MET
      const ah = 10, aw = 0.45, a = p.angle
      ctx.fillStyle = '#ff2222'
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - ah * Math.cos(a - aw), y2 - ah * Math.sin(a - aw))
      ctx.lineTo(x2 - ah * Math.cos(a + aw), y2 - ah * Math.sin(a + aw))
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()
}

// Animação da colisão vista do corte transversal: sem feixes aproximando
// (vêm de z, perpendicular à vista), só flash + partículas radiando.
function drawCollisionAnimationTrans(ctx: CanvasRenderingContext2D, t: number) {
  // Flash curto no IP
  if (t < 0.2) {
    const prog = t / 0.2
    const size = 16 + prog * 40
    const alpha = 1 - prog
    ctx.save()
    ctx.fillStyle = `rgba(255,230,120,${alpha * 0.9})`
    ctx.beginPath()
    ctx.arc(CX, CY, size, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    ctx.beginPath()
    ctx.arc(CX, CY, size * 0.35, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const animT = Math.max(0, t - 0.1)
  const speed = 180
  for (let i = 0; i < COLLISION.length; i++) {
    const p = COLLISION[i]
    const maxR = COLLISION_REACH_TRANS[i]
    const currentR = Math.min(animT * speed, maxR)
    if (currentR <= 0) continue
    drawCollisionTrackTrans(ctx, p, currentR, currentR >= maxR, maxR)
  }
}

function drawCollisionTrackTrans(
  ctx: CanvasRenderingContext2D,
  p: CollisionParticle,
  currentR: number,
  done: boolean,
  maxR: number,
) {
  // Fóton: sem track no inner detector; só o depósito aparece no ECAL
  if (p.type === 'photon') {
    if (done) {
      ctx.save()
      ctx.translate(CX, CY)
      ctx.rotate(p.angle)
      ctx.fillStyle = '#dddd00'
      ctx.fillRect(96, -3.5, 44, 7)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 0.6
      ctx.strokeRect(96, -3.5, 44, 7)
      ctx.restore()
    }
    return
  }

  const style = particleStyle(p.type)
  const curv = curvatureForTrans(p.type)
  const uMax = currentR / maxR
  const steps = Math.max(8, Math.floor(30 * uMax))

  ctx.save()
  ctx.strokeStyle = style.color
  ctx.lineWidth = style.width
  ctx.lineCap = 'round'
  if (style.dashed) ctx.setLineDash([7, 5])
  ctx.beginPath()
  ctx.moveTo(CX, CY)
  let endX = CX, endY = CY
  for (let i = 1; i <= steps; i++) {
    const u = (i / steps) * uMax
    const r = u * maxR
    const a = p.angle + curv * u * u
    endX = CX + r * Math.cos(a)
    endY = CY + r * Math.sin(a)
    ctx.lineTo(endX, endY)
  }
  ctx.stroke()
  if (style.dashed) ctx.setLineDash([])

  if (!done) {
    // Bolinha brilhante na ponta enquanto avança
    ctx.fillStyle = style.color
    ctx.beginPath()
    ctx.arc(endX, endY, style.width + 1, 0, Math.PI * 2)
    ctx.fill()
  } else {
    if (p.type === 'muon') {
      // MIP marker no muon chamber
      ctx.fillStyle = '#ff44ff'
      ctx.beginPath()
      ctx.arc(endX, endY, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.2
      ctx.stroke()
    } else if (p.type === 'electron') {
      // Torre amarela no ECAL
      const finalA = p.angle + curv
      ctx.save()
      ctx.translate(CX, CY)
      ctx.rotate(finalA)
      ctx.fillStyle = '#dddd00'
      ctx.fillRect(96, -3.5, 40, 7)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 0.6
      ctx.strokeRect(96, -3.5, 40, 7)
      ctx.restore()
    } else if (p.type === 'hadron') {
      // Torre âmbar no HCAL
      const finalA = p.angle + curv
      ctx.save()
      ctx.translate(CX, CY)
      ctx.rotate(finalA)
      ctx.fillStyle = '#ddaa00'
      ctx.fillRect(156, -4, 50, 8)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 0.6
      ctx.strokeRect(156, -4, 50, 8)
      ctx.restore()
    } else if (p.type === 'neutrino') {
      // Seta + label MET
      const ah = 10, aw = 0.45, a = p.angle
      ctx.fillStyle = '#ff2222'
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(endX - ah * Math.cos(a - aw), endY - ah * Math.sin(a - aw))
      ctx.lineTo(endX - ah * Math.cos(a + aw), endY - ah * Math.sin(a + aw))
      ctx.closePath()
      ctx.fill()
      ctx.font = "700 11px 'JetBrains Mono',monospace"
      ctx.textAlign = 'center'
      const lx = CX + (maxR + 12) * Math.cos(a)
      const ly = CY + (maxR + 12) * Math.sin(a)
      ctx.fillText('MET', lx, ly)
    }
  }
  ctx.restore()
}

export function Reconhecimento(props: ReconhecimentoProps = {}) {
  const { currentActivityId, onLayerFocused, readOnly = false } = props
  const cvRef = useRef<HTMLCanvasElement | null>(null)
  const [sel, setSel] = useState<LayerId | null>(null)
  const [hov, setHov] = useState<LayerId | null>(null)
  const [visited, setVisited] = useState<Record<string, boolean>>({})
  const [tab, setTab] = useState<TabId>('long')

  // Sincronia com o master: quando currentActivityId muda, força a camada
  // destacada OU aba. Override é idempotente (não altera se já é o mesmo).
  // Apenas UMA dimensão (layer ou tab) muda por activityChange; a outra
  // mantém o state local do usuário — sem "reset cruzado".
  useEffect(() => {
    const parsed = parseTabOrLayer(currentActivityId)
    if (parsed?.kind === 'layer') {
      if (parsed.value !== sel) setSel(parsed.value)
      setVisited((v) => (v[parsed.value] ? v : { ...v, [parsed.value]: true }))
    } else if (parsed?.kind === 'tab') {
      if (parsed.value !== tab) setTab(parsed.value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentActivityId])

  const selL = LAYERS.find((l) => l.id === sel) || null
  const allDone = LAYERS.every((l) => visited[l.id])
  const visitedCount = LAYERS.filter((l) => visited[l.id]).length

  // Refs para leitura dentro do rAF loop sem causar restart da animação
  const selRef = useRef(sel)
  const hovRef = useRef(hov)
  const visitedRef = useRef(visited)
  const allDoneRef = useRef(allDone)
  selRef.current = sel
  hovRef.current = hov
  visitedRef.current = visited
  allDoneRef.current = allDone

  // Animação do corte longitudinal: feixes → colisão → partículas radiando
  useEffect(() => {
    if (tab !== 'long') return
    const cv = cvRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    // Resolução interna fixa (coordenadas do desenho). O tamanho CSS vem do
    // .atlas-lab-canvas (width:100%; height:100%) respeitando aspect-ratio
    // do frame pai — em mobile estreito o canvas escala sem ser cortado.
    cv.width = LCW * dpr
    cv.height = LCH * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const startTime = performance.now()
    let rafId = 0
    const loop = () => {
      const t = (performance.now() - startTime) / 1000
      ctx.fillStyle = T.canvasBg
      ctx.fillRect(0, 0, LCW, LCH)
      drawLongitudinal(ctx, selRef.current, hovRef.current)
      drawCollisionAnimation(ctx, t)
      rafId = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(rafId)
  }, [tab])

  useEffect(() => {
    if (tab !== 'trans') return
    const cv = cvRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    // Idem long: resolução interna fixa; CSS controla display.
    cv.width = CW * dpr
    cv.height = CH * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const startTime = performance.now()
    let rafId = 0
    const loop = () => {
      const animT = (performance.now() - startTime) / 1000
      const selC = selRef.current
      const hovC = hovRef.current
      const allDoneC = allDoneRef.current

      ctx.fillStyle = T.canvasBg
      ctx.fillRect(0, 0, CW, CH)

      LAYERS.slice().reverse().forEach((L) => {
        const is = selC === L.id
        const ih = hovC === L.id
        const fade = !!selC && !is
        ctx.globalAlpha = fade ? 0.12 : 1

        if (L.id === 'muon') {
          MU.forEach((ch) => {
            ctx.fillStyle = is ? L.hoverFill : ih ? L.hoverFill + 'cc' : L.fill
            ctx.beginPath()
            ctx.arc(CX, CY, ch.ro, ch.a1, ch.a2)
            ctx.arc(CX, CY, ch.ri, ch.a2, ch.a1, true)
            ctx.closePath()
            ctx.fill()
            ctx.strokeStyle = is ? '#8ab8e8' : L.color
            ctx.lineWidth = is ? 1.2 : 0.5
            ctx.stroke()
          })
        } else {
          ctx.fillStyle = is ? L.hoverFill : ih ? L.hoverFill + 'cc' : L.fill
          ctx.beginPath()
          ctx.arc(CX, CY, L.ro, 0, Math.PI * 2)
          ctx.arc(CX, CY, L.ri, 0, Math.PI * 2, true)
          ctx.fill()
          ctx.strokeStyle = is ? 'rgba(255,255,255,0.6)' : L.color
          ctx.lineWidth = is ? 2 : 0.8
          ctx.beginPath()
          ctx.arc(CX, CY, L.ro, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(CX, CY, L.ri, 0, Math.PI * 2)
          ctx.stroke()
        }

        if (is || ih) {
          const midR = (L.ri + L.ro) / 2
          ctx.strokeStyle = is ? `${L.color}60` : `${L.color}30`
          ctx.lineWidth = L.ro - L.ri + 16
          ctx.globalAlpha = fade ? 0.05 : is ? 0.2 : 0.1
          ctx.beginPath()
          ctx.arc(CX, CY, midR, 0, Math.PI * 2)
          ctx.stroke()
          ctx.globalAlpha = fade ? 0.12 : 1
        }

        if (!fade) {
          if (L.id === 'ecal') {
            for (let i = 0; i < 80; i++) {
              const a = (i / 80) * Math.PI * 2
              ctx.strokeStyle = `rgba(60,120,40,${is ? 0.3 : 0.15})`
              ctx.lineWidth = 0.4
              ctx.beginPath()
              ctx.moveTo(CX + (L.ri + 3) * Math.cos(a), CY + (L.ri + 3) * Math.sin(a))
              ctx.lineTo(CX + (L.ro - 3) * Math.cos(a), CY + (L.ro - 3) * Math.sin(a))
              ctx.stroke()
            }
          }
          if (L.id === 'id') {
            [20, 32, 44, 58, 72, 86].forEach((r) => {
              ctx.strokeStyle = `rgba(80,80,80,${is ? 0.5 : 0.25})`
              ctx.lineWidth = 0.4
              ctx.beginPath()
              ctx.arc(CX, CY, r, 0, Math.PI * 2)
              ctx.stroke()
            })
          }
        }

        ctx.globalAlpha = 1
      })

      // Interaction point
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.beginPath()
      ctx.arc(CX, CY, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(CX, CY, 2.5, 0, Math.PI * 2)
      ctx.fill()

      if (!selC && !allDoneC) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.font = "500 12px 'Instrument Sans',sans-serif"
        ctx.textAlign = 'center'
        ctx.fillText('Clique em uma camada', CX, CY - 2)
      }

      drawCollisionAnimationTrans(ctx, animT)
      rafId = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(rafId)
  }, [tab])

  const getR = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = cvRef.current!.getBoundingClientRect()
    const W = tab === 'trans' ? CW : LCW
    const H = tab === 'trans' ? CH : LCH
    const X = tab === 'trans' ? CX : LCX
    const Y = tab === 'trans' ? CY : LCY
    return {
      mx: (e.clientX - r.left) * (W / r.width) - X,
      my: (e.clientY - r.top) * (H / r.height) - Y,
    }
  }

  const pickHit = (mx: number, my: number) =>
    tab === 'trans' ? hitTest(mx, my) : hitTestLong(mx, my)

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { mx, my } = getR(e)
    setHov(pickHit(mx, my))
  }

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { mx, my } = getR(e)
    const h = pickHit(mx, my)
    if (h) {
      if (!readOnly) {
        setSel(sel === h ? null : h)
        setVisited((v) => ({ ...v, [h]: true }))
      }
      onLayerFocused?.(h)
    } else {
      if (!readOnly) setSel(null)
    }
  }

  return (
    <div className="atlas-lab">
      <div className="atlas-lab-container">
        <div className="atlas-lab-title-block">
          <div className="atlas-lab-step">ATLAS LAB - PASSO 1 · RECONHECIMENTO</div>
          <h1 className="atlas-lab-title">Conheça as camadas do detector <span>ATLAS</span></h1>
          <p className="atlas-lab-subtitle">
            {readOnly
              ? 'Acompanhe a exploração conduzida pelo mestre.'
              : 'Explore cada camada clicando sobre o diagrama.'}
          </p>
        </div>
      <div className="atlas-lab-main">
          <div className="atlas-lab-canvas-col">
            <div className="atlas-lab-tabs" role="tablist">
              {([['long', 'Corte Longitudinal'], ['trans', 'Corte Transversal']] as const).map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  className={`atlas-lab-tab${tab === k ? ' is-active' : ''}`}
                  onClick={() => {
                    if (!readOnly) setTab(k)
                    onLayerFocused?.(`tab-${k}`)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className={`atlas-lab-canvas-frame${tab === 'long' ? ' is-long' : ''}`}
            >
              <canvas
                ref={cvRef}
                onMouseMove={onMove}
                onMouseLeave={() => setHov(null)}
                onClick={onClick}
                className="atlas-lab-canvas"
                style={{ cursor: hov ? 'pointer' : 'default' }}
              />
            </div>

            <div className="atlas-lab-chips">
              {LAYERS.map((L) => {
                const active = sel === L.id
                const done = !!visited[L.id]
                return (
                  <button
                    key={L.id}
                    type="button"
                    className={`atlas-lab-chip${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                    onClick={() => {
                      if (!readOnly) {
                        setSel(sel === L.id ? null : L.id)
                        setVisited((v) => ({ ...v, [L.id]: true }))
                      }
                      onLayerFocused?.(L.id)
                    }}
                    style={active ? { background: L.tagBg, borderColor: L.tagColor + '50' } : undefined}
                  >
                    <span
                      className="atlas-lab-chip-dot"
                      style={active ? { background: L.color } : undefined}
                    />
                    <span
                      className="atlas-lab-chip-label"
                      style={active ? { color: L.tagColor } : undefined}
                    >
                      {L.id === 'id' ? 'TRACKER' : L.id === 'ecal' ? 'EM CAL' : L.id === 'hcal' ? 'HAD CAL' : 'MÚONS'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <aside className="atlas-lab-info-col" aria-live="polite">
            {selL ? (
              <article key={selL.id} className="atlas-lab-card">
                <div
                  className="atlas-lab-card-strip"
                  style={{ background: `linear-gradient(135deg, ${selL.tagBg}, #ffffff)` }}
                >
                  <div className="atlas-lab-card-strip-row">
                    <div
                      className="atlas-lab-card-icon"
                      style={{ background: selL.fill, borderColor: selL.color }}
                    >
                      <span className="atlas-lab-card-icon-dot" />
                    </div>
                    <div className="atlas-lab-card-strip-text">
                      <div className="atlas-lab-card-label">{selL.label}</div>
                      <div className="atlas-lab-card-subtitle" style={{ color: selL.tagColor }}>
                        {selL.subtitle}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="atlas-lab-card-body">
                  {([
                    { title: 'O QUE É', text: selL.what, muted: false },
                    { title: 'PARA QUE SERVE', text: selL.role, muted: false },
                    { title: 'NO HYPATIA', text: selL.hypatia, muted: true },
                  ] as const).map((s, i) => (
                    <div key={s.title} className="atlas-lab-card-section">
                      <div className="atlas-lab-card-kicker" style={{ color: selL.tagColor }}>
                        <span
                          className="atlas-lab-card-kicker-bar"
                          style={{ background: selL.color }}
                        />
                        {s.title}
                      </div>
                      <p className={`atlas-lab-card-text${s.muted ? ' is-muted' : ''}`}>{s.text}</p>
                      {i < 2 && <div className="atlas-lab-card-divider" />}
                    </div>
                  ))}
                </div>
              </article>
            ) : allDone ? (
              <div className="atlas-lab-done">
                <div className="atlas-lab-done-icon">
                  <span>{'\u2713'}</span>
                </div>
                <div className="atlas-lab-done-title">Detector explorado!</div>
                <p className="atlas-lab-done-text">
                  Você conhece as 4 camadas e sabe o que cada cor significa no HYPATIA. No próximo
                  passo, vai aprender a identificar partículas.
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
                <div className="atlas-lab-empty-title">Selecione uma camada</div>
                <p className="atlas-lab-empty-text">
                  Clique sobre o detector para explorar cada camada e descobrir sua função
                </p>
                <div className="atlas-lab-empty-progress">
                  {LAYERS.map((L) => (
                    <div
                      key={L.id}
                      className={`atlas-lab-empty-progress-bar${visited[L.id] ? ' is-done' : ''}`}
                    />
                  ))}
                </div>
                <div className="atlas-lab-empty-count">{visitedCount}/4 camadas</div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

export default Reconhecimento
