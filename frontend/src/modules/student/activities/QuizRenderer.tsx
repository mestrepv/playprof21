/**
 * QuizRenderer — renderiza uma Activity.kind='quiz'.
 */

import { useState } from 'react'
import { Button } from '../../../components/ui/Button'

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
    return <div style={errBox}>config inválido: quiz precisa de `stem`, `options`, `correctIndex`.</div>
  }

  const correct = selected !== null && selected === cfg.correctIndex
  const submit = () => {
    if (selected === null) return
    setRevealed(true)
  }
  const finish = () => {
    if (selected === null) return
    onComplete(correct ? maxScore : 0)
  }

  return (
    <div>
      <h2 style={{ fontSize: 'var(--p21-text-lg)', margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 'var(--p21-text-md)', marginTop: 'var(--p21-sp-4)', lineHeight: 1.5 }}>
        {cfg.stem}
      </p>
      <ul style={list}>
        {cfg.options.map((opt, i) => {
          const isSel = selected === i
          const isRight = revealed && i === cfg.correctIndex
          const isWrong = revealed && isSel && i !== cfg.correctIndex
          const border = isRight
            ? 'var(--p21-teal)'
            : isWrong
              ? 'var(--p21-coral)'
              : isSel
                ? 'var(--p21-blue)'
                : 'var(--p21-border-strong)'
          const bg = isRight
            ? 'var(--p21-teal-soft)'
            : isWrong
              ? 'var(--p21-coral-soft)'
              : isSel
                ? 'var(--p21-blue-soft)'
                : 'var(--p21-surface)'
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => !revealed && setSelected(i)}
                disabled={revealed}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 'var(--p21-radius-md)',
                  border: `2px solid ${border}`,
                  background: bg,
                  color: 'var(--p21-ink)',
                  fontSize: 'var(--p21-text-base)',
                  cursor: revealed ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 'var(--p21-tap)',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: isSel || isRight || isWrong ? border : 'var(--p21-surface-2)',
                    color: isSel || isRight || isWrong ? '#FFF' : 'var(--p21-ink-3)',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--p21-font-mono)',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                  aria-hidden
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ flex: 1 }}>{opt}</span>
                {isRight && <span style={{ color: 'var(--p21-teal)', fontSize: 20 }}>✓</span>}
                {isWrong && <span style={{ color: 'var(--p21-coral)', fontSize: 20 }}>✗</span>}
              </button>
            </li>
          )
        })}
      </ul>

      {!revealed && (
        <Button onClick={submit} disabled={selected === null} block size="lg" style={{ marginTop: 'var(--p21-sp-5)' }}>
          confirmar resposta
        </Button>
      )}
      {revealed && (
        <div style={{ display: 'grid', gap: 'var(--p21-sp-4)', marginTop: 'var(--p21-sp-5)' }}>
          <div
            style={{
              padding: 'var(--p21-sp-4)',
              background: correct ? 'var(--p21-teal-soft)' : 'var(--p21-coral-soft)',
              color: correct ? 'var(--p21-teal)' : 'var(--p21-coral-ink)',
              borderRadius: 'var(--p21-radius-md)',
              fontFamily: 'var(--p21-font-mono)',
              fontSize: 'var(--p21-text-sm)',
              fontWeight: 500,
            }}
          >
            {correct
              ? `acertou! ${maxScore}/${maxScore} pontos.`
              : `errou — a correta é ${String.fromCharCode(65 + cfg.correctIndex)}. 0/${maxScore} pontos.`}
          </div>
          <Button onClick={finish} block size="lg">
            continuar
          </Button>
        </div>
      )}
    </div>
  )
}

const list: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 'var(--p21-sp-5) 0 0',
  display: 'grid',
  gap: 'var(--p21-sp-2)',
}
const errBox: React.CSSProperties = {
  padding: 'var(--p21-sp-3)',
  background: 'var(--p21-coral-soft)',
  color: 'var(--p21-coral-ink)',
  borderRadius: 'var(--p21-radius-md)',
  fontFamily: 'var(--p21-font-mono)',
}
