/**
 * QuizSlide — renderiza quiz em dois modos:
 *
 *   Preview (sem SessionContext): pergunta + opções estáticas, sem interação
 *   Sessão ao vivo (com SessionContext):
 *     Master: botões abrir/fechar/resetar + distribuição em tempo real
 *     Player: opções clicáveis quando aberto + resultado ao fechar
 */

import { useSessionOptional } from '../../live/SessionContext'
import type { QuizStateLocal } from '../../live/types'
import type { QuizSlide as QuizSlideModel } from '../types/manifest'

interface Props {
  slide: QuizSlideModel
}

export function QuizSlide({ slide }: Props) {
  const session = useSessionOptional()

  if (!session) {
    return <QuizPreview slide={slide} />
  }

  const { adapter, state } = session
  const quiz: QuizStateLocal = state.quizzes[slide.questionId] ?? {
    questionId: slide.questionId,
    status: 'idle',
    distribution: [],
    responses: 0,
    correctIndex: null,
    myAnswer: null,
  }
  const isMaster = state.role === 'master'

  return isMaster
    ? <QuizMaster slide={slide} quiz={quiz} adapter={adapter} />
    : <QuizPlayer slide={slide} quiz={quiz} adapter={adapter} />
}

// ── Preview estático ──────────────────────────────────────────────────────

function QuizPreview({ slide }: { slide: QuizSlideModel }) {
  return (
    <div style={containerStyle}>
      <p style={stemStyle}>{slide.stem}</p>
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {slide.options.map((opt, i) => (
          <div
            key={i}
            style={{
              ...optionBase,
              borderColor: i === slide.correctIndex ? 'var(--color-lab-accent, #534AB7)' : 'var(--color-lab-rule, #D8D5CB)',
              background: i === slide.correctIndex ? 'rgba(83,74,183,0.07)' : 'var(--p21-surface, #FFF)',
            }}
          >
            <span style={letterStyle}>{letters[i]}</span>
            <span>{opt}</span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 12, fontSize: '0.8em', color: 'var(--p21-ink-3, #777)' }}>
        preview — quiz interativo disponível na aula ao vivo
      </p>
    </div>
  )
}

// ── View do mestre ────────────────────────────────────────────────────────

function QuizMaster({
  slide,
  quiz,
  adapter,
}: {
  slide: QuizSlideModel
  quiz: QuizStateLocal
  adapter: import('../../live/adapter').SessionAdapter
}) {
  const isIdle = quiz.status === 'idle'
  const isOpen = quiz.status === 'open'
  const isClosed = quiz.status === 'closed'
  const maxVotes = Math.max(1, ...quiz.distribution)

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ ...stemStyle, flex: 1 }}>{slide.stem}</p>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {(isIdle || isClosed) && (
            <button
              onClick={() => adapter.openQuiz(slide.questionId, slide.options, slide.correctIndex)}
              style={{ ...actionBtn, background: 'var(--p21-blue, #2563EB)', color: '#FFF', borderColor: 'var(--p21-blue, #2563EB)' }}
            >
              {isClosed ? 'nova rodada' : 'abrir quiz'}
            </button>
          )}
          {isOpen && (
            <button
              onClick={() => adapter.closeQuiz(slide.questionId)}
              style={{ ...actionBtn, background: 'var(--p21-coral, #E04040)', color: '#FFF', borderColor: 'var(--p21-coral, #E04040)' }}
            >
              fechar & revelar
            </button>
          )}
          {!isIdle && (
            <button
              onClick={() => adapter.resetQuiz(slide.questionId)}
              style={{ ...actionBtn }}
            >
              resetar
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {slide.options.map((opt, i) => {
          const votes = quiz.distribution[i] ?? 0
          const pct = quiz.responses > 0 ? Math.round((votes / quiz.responses) * 100) : 0
          const isCorrect = i === slide.correctIndex
          const barColor = isClosed
            ? isCorrect ? '#16a34a' : '#9ca3af'
            : 'var(--p21-blue, #2563EB)'

          return (
            <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${isClosed && isCorrect ? '#16a34a' : 'var(--color-lab-rule, #D8D5CB)'}`, background: 'var(--p21-surface, #FFF)' }}>
              {/* Barra de progresso */}
              {quiz.status !== 'idle' && (
                <div
                  style={{
                    position: 'absolute', inset: 0, right: 'auto',
                    width: `${pct}%`,
                    background: barColor,
                    opacity: 0.12,
                    transition: 'width 0.4s ease',
                  }}
                />
              )}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 10 }}>
                <span style={letterStyle}>{letters[i]}</span>
                <span style={{ flex: 1 }}>{opt}</span>
                {quiz.status !== 'idle' && (
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.85em', color: '#555', minWidth: 36, textAlign: 'right' }}>
                    {votes} ({pct}%)
                  </span>
                )}
                {isClosed && isCorrect && (
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {quiz.status !== 'idle' && (
        <p style={{ marginTop: 10, fontSize: '0.82em', color: 'var(--p21-ink-3, #777)' }}>
          {quiz.responses} resposta{quiz.responses !== 1 ? 's' : ''}
          {isOpen ? ' — aguardando…' : ''}
        </p>
      )}
    </div>
  )
}

// ── View do aluno ─────────────────────────────────────────────────────────

function QuizPlayer({
  slide,
  quiz,
  adapter,
}: {
  slide: QuizSlideModel
  quiz: QuizStateLocal
  adapter: import('../../live/adapter').SessionAdapter
}) {
  const isIdle = quiz.status === 'idle'
  const isOpen = quiz.status === 'open'
  const isClosed = quiz.status === 'closed'
  const answered = quiz.myAnswer !== null

  return (
    <div style={containerStyle}>
      <p style={stemStyle}>{slide.stem}</p>

      {isIdle && (
        <p style={{ marginTop: 16, color: 'var(--p21-ink-3, #777)', fontFamily: 'var(--p21-font-mono, monospace)', fontSize: '0.9em' }}>
          aguardando o professor abrir o quiz…
        </p>
      )}

      {(isOpen || isClosed) && (
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {slide.options.map((opt, i) => {
            const isMine = quiz.myAnswer === i
            const isCorrect = isClosed && i === quiz.correctIndex
            const isWrong = isClosed && isMine && i !== quiz.correctIndex

            let borderColor = 'var(--color-lab-rule, #D8D5CB)'
            let bg = 'var(--p21-surface, #FFF)'
            if (isCorrect) { borderColor = '#16a34a'; bg = 'rgba(22,163,74,0.08)' }
            else if (isWrong) { borderColor = '#dc2626'; bg = 'rgba(220,38,38,0.07)' }
            else if (isMine && isOpen) { borderColor = 'var(--p21-blue, #2563EB)'; bg = 'rgba(37,99,235,0.07)' }

            return (
              <button
                key={i}
                disabled={!isOpen || answered}
                onClick={() => adapter.submitAnswer(slide.questionId, i)}
                style={{
                  ...optionBase,
                  cursor: isOpen && !answered ? 'pointer' : 'default',
                  borderColor,
                  background: bg,
                  textAlign: 'left',
                  width: '100%',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <span style={letterStyle}>{letters[i]}</span>
                <span style={{ flex: 1 }}>{opt}</span>
                {isCorrect && <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>}
                {isWrong && <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>}
              </button>
            )
          })}
        </div>
      )}

      {isOpen && !answered && (
        <p style={{ marginTop: 10, fontSize: '0.82em', color: 'var(--p21-ink-3, #777)' }}>
          {quiz.responses} resposta{quiz.responses !== 1 ? 's' : ''} recebida{quiz.responses !== 1 ? 's' : ''}
        </p>
      )}
      {isOpen && answered && (
        <p style={{ marginTop: 10, fontSize: '0.82em', color: 'var(--p21-blue, #2563EB)' }}>
          resposta enviada! aguardando o professor fechar…
        </p>
      )}
      {isClosed && (
        <p style={{ marginTop: 10, fontSize: '0.82em', color: quiz.myAnswer === quiz.correctIndex ? '#16a34a' : '#dc2626' }}>
          {quiz.myAnswer === null
            ? 'você não respondeu a tempo.'
            : quiz.myAnswer === quiz.correctIndex
              ? `acertou! +${10} pontos`
              : 'não foi dessa vez.'}
        </p>
      )}
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────

const letters = ['A', 'B', 'C', 'D', 'E', 'F']

const containerStyle: React.CSSProperties = {
  maxWidth: 680,
  margin: '0 auto',
  padding: 'var(--spacing-lab-4, 1.5rem) 0',
}

const stemStyle: React.CSSProperties = {
  fontSize: 'var(--text-lab-lg, 1.125rem)',
  fontWeight: 600,
  lineHeight: 1.4,
  margin: 0,
  color: 'var(--p21-ink, #0F1115)',
}

const optionBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  border: '1.5px solid var(--color-lab-rule, #D8D5CB)',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: 'var(--text-lab-base, 1rem)',
  background: 'var(--p21-surface, #FFF)',
}

const letterStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: 'var(--color-lab-bg-2, #F1EFE8)',
  fontSize: '0.8em',
  fontWeight: 700,
  flexShrink: 0,
  color: 'var(--p21-ink-2, #444)',
}

const actionBtn: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  border: '1.5px solid var(--p21-border-strong, #C5C2B8)',
  background: 'var(--p21-surface, #FFF)',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}
