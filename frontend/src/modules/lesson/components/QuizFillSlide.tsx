import { useState } from 'react'
import type { QuizFillSlide as Model } from '../types/manifest'
import { useTelemetry } from '../runtime/useTelemetry'

interface Props {
  slide: Model
}

export function QuizFillSlide({ slide }: Props) {
  const [input, setInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const track = useTelemetry({ slideId: slide.id })

  const normalize = (s: string) => s.trim().toLowerCase()
  const accepted = [slide.answer, ...(slide.acceptedAnswers ?? [])].map(normalize)
  const correct = submitted && accepted.includes(normalize(input))
  const wrong = submitted && !accepted.includes(normalize(input))

  const stemParts = slide.stem.split('___')
  const hasBlank = stemParts.length > 1

  return (
    <div style={containerStyle}>
      {/* Enunciado com lacuna inline ou separado */}
      {hasBlank ? (
        <p style={stemStyle}>
          {stemParts.map((part, i) => (
            <span key={i}>
              {part}
              {i < stemParts.length - 1 && (
                <span style={{
                  display: 'inline-block',
                  minWidth: 80,
                  borderBottom: `2px solid ${submitted ? (correct ? '#16a34a' : '#dc2626') : 'var(--p21-ink-2, #444)'}`,
                  margin: '0 4px',
                  verticalAlign: 'bottom',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: submitted ? (correct ? '#16a34a' : '#dc2626') : 'inherit',
                }}>
                  {submitted ? input || '—' : '      '}
                </span>
              )}
            </span>
          ))}
        </p>
      ) : (
        <p style={stemStyle}>{slide.stem}</p>
      )}

      {slide.hint && !submitted && (
        <p style={{ margin: '8px 0 0', fontSize: '0.85em', color: 'var(--p21-ink-3, #777)', fontStyle: 'italic' }}>
          dica: {slide.hint}
        </p>
      )}

      {/* Campo de entrada */}
      {!submitted ? (
        <form
          onSubmit={(e) => {
          e.preventDefault()
          if (!input.trim()) return
          setSubmitted(true)
          const isCorrect = accepted.includes(normalize(input))
          track('quiz_fill_submit', { answer: input, correct: isCorrect, question_id: slide.questionId })
        }}
          style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="sua resposta…"
            autoComplete="off"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            style={{ ...submitBtn, opacity: input.trim() ? 1 : 0.5 }}
          >
            confirmar
          </button>
        </form>
      ) : (
        <div style={{ marginTop: 20 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 8,
            border: `1.5px solid ${correct ? '#16a34a' : '#dc2626'}`,
            background: correct ? 'rgba(22,163,74,0.07)' : 'rgba(220,38,38,0.06)',
          }}>
            <span style={{ fontSize: 18 }}>{correct ? '✓' : '✗'}</span>
            <div>
              <span style={{ fontWeight: 600, color: correct ? '#16a34a' : '#dc2626' }}>
                {correct ? 'correto!' : 'não foi dessa vez.'}
              </span>
              {wrong && (
                <span style={{ display: 'block', fontSize: '0.85em', color: 'var(--p21-ink-3, #777)', marginTop: 2 }}>
                  gabarito: <strong>{slide.answer}</strong>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => { setInput(''); setSubmitted(false) }}
            style={{ ...submitBtn, marginTop: 10, background: 'var(--p21-surface, #FFF)', color: 'var(--p21-ink-2, #444)', borderColor: 'var(--p21-border-strong, #C5C2B8)' }}
          >
            tentar novamente
          </button>
        </div>
      )}
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: 'var(--spacing-lab-4, 1.5rem) 0',
}

const stemStyle: React.CSSProperties = {
  fontSize: 'var(--text-lab-lg, 1.125rem)',
  fontWeight: 600,
  lineHeight: 1.5,
  margin: 0,
  color: 'var(--p21-ink, #0F1115)',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 160,
  padding: '9px 14px',
  border: '1.5px solid var(--color-lab-rule, #D8D5CB)',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: '1rem',
  outline: 'none',
  background: 'var(--p21-surface, #FFF)',
  color: 'var(--p21-ink, #0F1115)',
}

const submitBtn: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  border: '1.5px solid var(--p21-primary, #2f6e00)',
  background: 'var(--p21-primary, #2f6e00)',
  color: '#FFF',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
}
