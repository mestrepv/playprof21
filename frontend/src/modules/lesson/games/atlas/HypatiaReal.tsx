import { useState, useRef, useEffect } from 'react'

/*
 * HypatiaReal — cópia adaptada. Não tem sub-activities navegáveis
 * (aluno opera o HYPATIA real em outra janela). Props aceitas por
 * compatibilidade com o contrato de SlideProps mas não usadas.
 */
import './atlasLab.css'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MISSION_ID = 'atlas.hypatia.real'

export interface HypatiaRealProps {
  currentActivityId?: string | null
  onLayerFocused?: (subId: string) => void
  readOnly?: boolean
}

const HYPATIA_URL = 'https://hypatia-app.iasa.gr/Hypatia/'
const TARGET_EVENTS = 10

const HW = 360, HH = 180
const HIST_MIN = 60
const HIST_MAX = 120
const HIST_BINS = 15
const BIN_WIDTH = (HIST_MAX - HIST_MIN) / HIST_BINS

interface LoggedEvent {
  n: number
  mass: number
}

function binIndex(m: number): number | null {
  if (m < HIST_MIN || m >= HIST_MAX) return null
  return Math.floor((m - HIST_MIN) / BIN_WIDTH)
}

const CHECKLIST = [
  'Ver as duas vistas do evento',
  'Aplicar o filtro pT ≥ 10 GeV',
  'Localizar os dois múons',
  'Ativar Pick Tool',
  'Inserir os dois múons',
  'Ler a massa invariante',
]

const SIGNATURES: [string, string, string][] = [
  ['μ', 'Múon', 'Track que chega ao espectrômetro azul'],
  ['e⁻', 'Elétron', 'Track + torre amarela no EM verde'],
  ['γ', 'Fóton', 'Só torre amarela no EM (sem track)'],
  ['jato', 'Jato', 'Torres no verde E no vermelho'],
  ['ν', 'Neutrino', 'Invisível — aparece como MET'],
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function HypatiaReal(_props: HypatiaRealProps = {}) {
  const hvRef = useRef<HTMLCanvasElement | null>(null)
  const [studentName, setStudentName] = useState('')
  const [massInput, setMassInput] = useState('')
  const [logged, setLogged] = useState<LoggedEvent[]>([])
  const [hist, setHist] = useState<number[]>(new Array(HIST_BINS).fill(0))
  const [err, setErr] = useState<string | null>(null)

  const analyzed = logged.length
  const doneTarget = analyzed >= TARGET_EVENTS
  const peakBin = hist.indexOf(Math.max(...hist))
  const peakMass = analyzed > 0 && Math.max(...hist) > 0 ? HIST_MIN + (peakBin + 0.5) * BIN_WIDTH : null
  const showingPeak = analyzed >= 5

  useEffect(() => {
    const cv = hvRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    cv.width = HW * dpr
    cv.height = HH * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawHistogram(ctx, hist)
  }, [hist])

  const addEvent = () => {
    setErr(null)
    const m = parseFloat(massInput.replace(',', '.'))
    if (isNaN(m)) {
      setErr('Digite um número (ex.: 91.2)')
      return
    }
    if (m < 0 || m > 500) {
      setErr('Valor fora de faixa (0 a 500 GeV)')
      return
    }
    const next: LoggedEvent = { n: logged.length + 1, mass: m }
    setLogged((l) => [...l, next])
    const bin = binIndex(m)
    if (bin !== null) {
      setHist((h) => {
        const nh = [...h]
        nh[bin] += 1
        return nh
      })
    }
    setMassInput('')
  }

  const removeLast = () => {
    if (logged.length === 0) return
    const last = logged[logged.length - 1]
    setLogged((l) => l.slice(0, -1))
    const bin = binIndex(last.mass)
    if (bin !== null) {
      setHist((h) => {
        const nh = [...h]
        nh[bin] = Math.max(0, nh[bin] - 1)
        return nh
      })
    }
  }

  const exportJSON = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      student: studentName.trim() || null,
      events_analyzed: analyzed,
      target: TARGET_EVENTS,
      measurements: logged,
      histogram: {
        range_gev: [HIST_MIN, HIST_MAX],
        bin_width_gev: BIN_WIDTH,
        counts: hist,
      },
      peak_gev: peakMass,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    a.href = url
    a.download = `atlas-hypatia-${studentName.trim().replace(/\s+/g, '_') || 'aluno'}-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="atlas-lab">
      <div className="atlas-lab-container">
        <div className="atlas-lab-title-block">
          <div className="atlas-lab-step">PASSO 6 · DADOS REAIS</div>
          <h1 className="atlas-lab-title">Analise eventos reais do <span>ATLAS</span></h1>
          <p className="atlas-lab-subtitle">
            Abra o HYPATIA online ao lado desta página, analise 10 eventos e registre aqui a massa invariante de cada par μμ. O pico do Z emerge nos seus dados.
          </p>
        </div>
      <div className="atlas-real-name-row">
        <label className="atlas-real-name-label">Nome do aluno (opcional, para export):</label>
        <input
          type="text"
          className="atlas-real-name-input"
          placeholder="Ex.: Maria Silva"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
        />
      </div>

      <div className="atlas-real-main">
        <div className="atlas-real-frame-wrap">
          <div className="atlas-real-launcher">
            <div className="atlas-real-launcher-eyebrow">HYPATIA ONLINE</div>
            <h2 className="atlas-real-launcher-title">Abra o HYPATIA em outra janela</h2>
            <p className="atlas-real-launcher-text">
              O HYPATIA precisa de cookies próprios para funcionar e não roda embutido aqui.
              Clique no botão abaixo para abri-lo em uma nova janela, coloque as duas lado a lado
              e registre aqui as massas que você calcular.
            </p>
            <a
              className="atlas-real-launcher-btn"
              href={HYPATIA_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir HYPATIA em nova janela →
            </a>
            <div className="atlas-real-launcher-url">
              <span>URL:</span>
              <code>{HYPATIA_URL}</code>
            </div>
            <ul className="atlas-real-launcher-tips">
              <li>Funciona melhor em tela cheia (uma janela para cada lado)</li>
              <li>Se fechar sem querer, basta clicar de novo</li>
              <li>Os dados que você registra aqui ficam salvos só nesta aba</li>
            </ul>
          </div>
        </div>

        <aside className="atlas-real-side">
          <section className="atlas-real-card">
            <h3>Checklist por evento</h3>
            <ul className="atlas-real-checklist">
              {CHECKLIST.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>

          <section className="atlas-real-card">
            <h3>Assinaturas</h3>
            <table className="atlas-real-sig-table">
              <tbody>
                {SIGNATURES.map(([sym, name, rule]) => (
                  <tr key={sym}>
                    <td className="atlas-real-sig-sym">{sym}</td>
                    <td className="atlas-real-sig-name">{name}</td>
                    <td className="atlas-real-sig-rule">{rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="atlas-real-card">
            <h3>Registrar medida</h3>
            <p className="atlas-real-card-sub">
              Após analisar um evento Z→μμ no HYPATIA, registre a massa invariante aqui.
            </p>
            <div className="atlas-real-input-row">
              <input
                type="text"
                inputMode="decimal"
                className="atlas-real-mass-input"
                placeholder="Ex.: 91.2"
                value={massInput}
                onChange={(e) => setMassInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEvent()}
              />
              <span className="atlas-real-mass-unit">GeV</span>
              <button type="button" className="atlas-real-add-btn" onClick={addEvent}>
                Adicionar
              </button>
            </div>
            {err && <div className="atlas-real-err">{err}</div>}

            <div className="atlas-real-progress">
              <span className="atlas-real-progress-count">{analyzed}</span>
              <span className="atlas-real-progress-total">/ {TARGET_EVENTS}</span>
              <span className="atlas-real-progress-label">eventos registrados</span>
            </div>
          </section>

          <section className="atlas-real-card">
            <div className="atlas-real-hist-head">
              <h3>Histograma ao vivo</h3>
              {logged.length > 0 && (
                <button type="button" className="atlas-real-undo" onClick={removeLast}>
                  Desfazer último
                </button>
              )}
            </div>
            <canvas ref={hvRef} className="atlas-real-hist" />
            {showingPeak && peakMass !== null && (
              <div className="atlas-real-peak">
                Pico em <strong>~{peakMass.toFixed(0)} GeV</strong>
              </div>
            )}
          </section>

          {doneTarget && (
            <section className="atlas-real-card atlas-real-done-card">
              <div className="atlas-lab-done-title">10 eventos analisados</div>
              <p>Missão concluída. Exporte o resultado em JSON.</p>
              <button type="button" className="atlas-lab-done-cta" onClick={exportJSON}>
                Exportar JSON →
              </button>
            </section>
          )}

          {!doneTarget && logged.length > 0 && (
            <button type="button" className="atlas-real-export-mini" onClick={exportJSON}>
              Exportar parcial (JSON)
            </button>
          )}
        </aside>
      </div>
      </div>
    </div>
  )
}

export default HypatiaReal

// ================== Histogram drawing ==================

function drawHistogram(ctx: CanvasRenderingContext2D, hist: number[]) {
  const pad = { l: 36, r: 10, t: 14, b: 28 }
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

  // Z marker
  const zX = pad.l + ((91 - HIST_MIN) / (HIST_MAX - HIST_MIN)) * plotW
  ctx.strokeStyle = '#d32f2f'
  ctx.lineWidth = 1.3
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.moveTo(zX, pad.t)
  ctx.lineTo(zX, pad.t + plotH)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#d32f2f'
  ctx.font = "700 9px 'JetBrains Mono',monospace"
  ctx.textAlign = 'left'
  ctx.fillText('Z = 91', zX + 3, pad.t + 10)

  ctx.fillStyle = '#555550'
  ctx.font = "500 10px 'JetBrains Mono',monospace"
  ctx.textAlign = 'center'
  for (const v of [60, 75, 90, 105, 120]) {
    const x = pad.l + ((v - HIST_MIN) / (HIST_MAX - HIST_MIN)) * plotW
    ctx.fillText(`${v}`, x, pad.t + plotH + 14)
  }
  ctx.fillText('m(μμ) [GeV]', pad.l + plotW / 2, pad.t + plotH + 26)

  ctx.textAlign = 'right'
  for (let i = 0; i <= maxCount; i++) {
    const y = pad.t + plotH - (i / maxCount) * plotH
    ctx.fillText(`${i}`, pad.l - 4, y + 3)
  }
}
