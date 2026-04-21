/**
 * QuizRenderer — renderiza uma Activity.kind='quiz'.
 *
 * Config esperado: `{ stem: string, options: string[], correctIndex: number }`.
 * Valida local: aluno clica opção, renderer revela correta + devolve `score`
 * (max_score se acertou, 0 se errou) via `onComplete`. Sem auto-envio — o
 * aluno vê o feedback antes de avançar.
 */

import { useState } from 'react'

interface Config {
  stem: string
  options: string[]
  correctIndex: number
}

interface Props {
  title: string
  maxScore: number
  config: Record<string, unknown>
  onComplete: (score: number) => void
}

function parseConfig(x: Record<string, unknown>): Config | null {
  if (
    typeof x.stem === 'string' &&
    Array.isArray(x.options) &&
    x.options.every((o) => typeof o === 'string') &&
    typeof x.correctIndex === 'number'
  ) {
    return { stem: x.stem, options: x.options as string[], correctIndex: x.correctIndex }
  }
  return null
}

export function QuizRenderer({ title, maxScore, config, onComplete }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)

  const cfg = parseConfig(config)
  if (!cfg) {
    return (
      <div style={errorBox}>config inválido: quiz precisa de `stem`, `options`, `correctIndex`.</div>
    )
  }

  const submit = () => {
    if (selected === null) return
    setRevealed(true)
  }

  const finish = () => {
    if (selected === null) return
    const correct = selected === cfg.correctIndex
    onComplete(correct ? maxScore : 0)
  }

  const correct = selected !== null && selected === cfg.correctIndex

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ fontSize: 'var(--text-lab-lg)', margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 'var(--text-lab-base)', marginTop: 16 }}>{cfg.stem}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0', display: 'grid', gap: 10 }}>
        {cfg.options.map((opt, i) => {
          const isSel = selected === i
          const isRight = revealed && i === cfg.correctIndex
          const isWrong = revealed && isSel && i !== cfg.correctIndex
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => !revealed && setSelected(i)}
                disabled={revealed}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '2px solid',
                  borderColor: isRight
                    ? '#0F6E56'
                    : isWrong
                      ? '#993C1D'
                      : isSel
                        ? 'var(--color-lab-accent)'
                        : 'var(--color-lab-rule)',
                  background: isRight ? '#E1F5EE' : isWrong ? '#FAECE7' : isSel ? '#EEEDFE' : '#FFF',
                  color: 'inherit',
                  fontSize: 15,
                  cursor: revealed ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ marginRight: 10, opacity: 0.6 }}>{String.fromCharCode(65 + i)}.</span>
                {opt}
                {isRight && <span style={{ marginLeft: 8, color: '#0F6E56' }}>✓</span>}
                {isWrong && <span style={{ marginLeft: 8, color: '#993C1D' }}>✗</span>}
              </button>
            </li>
          )
        })}
      </ul>

      {!revealed && (
        <button type="button" onClick={submit} disabled={selected === null} style={primaryBtn}>
          confirmar resposta
        </button>
      )}
      {revealed && (
        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          <div
            style={{
              padding: '10px 14px',
              background: correct ? '#E1F5EE' : '#FAECE7',
              color: correct ? '#085041' : '#712B13',
              borderRadius: 8,
              fontFamily: 'var(--font-lab-mono)',
              fontSize: 14,
            }}
          >
            {correct
              ? `acertou! ${maxScore}/${maxScore} pontos.`
              : `errou — a resposta certa é ${String.fromCharCode(65 + cfg.correctIndex)}. 0/${maxScore} pontos.`}
          </div>
          <button type="button" onClick={finish} style={primaryBtn}>
            continuar
          </button>
        </div>
      )}
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--color-lab-accent)',
  color: '#FFF',
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const errorBox: React.CSSProperties = {
  padding: '10px 12px',
  background: '#FAECE7',
  color: '#993C1D',
  borderRadius: 8,
  fontFamily: 'var(--font-lab-mono)',
}
