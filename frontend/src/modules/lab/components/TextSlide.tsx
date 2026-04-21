/**
 * TextSlide — markdown + KaTeX.
 *
 * Separa blocos $$...$$ do markdown (parse dedicado) e trata $...$ inline
 * dentro dos <p> renderizados. Implementação minimal sem plugins remark-math
 * / rehype-katex — suficiente pros casos atuais.
 *
 * rehype-raw habilita HTML dentro do markdown (classes .tag / .card /
 * .callout definidas em styles/helpers.css).
 */

import { useMemo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

import type { TextSlide as TextSlideModel } from '../types/manifest'
import { Math } from './MathInline'

interface Props {
  slide: TextSlideModel
}

function splitMathBlocks(body: string): Array<{ kind: 'md' | 'math'; content: string }> {
  const parts: Array<{ kind: 'md' | 'math'; content: string }> = []
  const re = /\$\$([\s\S]+?)\$\$/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    if (match.index > last) parts.push({ kind: 'md', content: body.slice(last, match.index) })
    parts.push({ kind: 'math', content: match[1].trim() })
    last = match.index + match[0].length
  }
  if (last < body.length) parts.push({ kind: 'md', content: body.slice(last) })
  return parts
}

function renderInlineMath(text: string): ReactNode[] {
  const re = /\$([^$\n]+?)\$/g
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    nodes.push(<Math key={key++}>{match[1].trim()}</Math>)
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function TextSlide({ slide }: Props) {
  const parts = useMemo(() => splitMathBlocks(slide.body), [slide.body])
  const hasSideImage = Boolean(slide.sideImage)
  const sideRight = (slide.sidePosition ?? 'right') === 'right'

  const textContent = (
    <article
      style={{
        fontSize: 'var(--text-lab-base)',
        lineHeight: 'var(--lh-body, 1.55)',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
        flex: hasSideImage ? 1 : undefined,
        minWidth: 0,
      }}
    >
      {parts.map((part, i) =>
        part.kind === 'math' ? (
          <div
            key={i}
            style={{
              padding: 'var(--spacing-lab-4) 0',
              fontSize: 'var(--text-lab-lg)',
              textAlign: 'center',
              overflowX: 'auto',
              maxWidth: '100%',
            }}
          >
            <Math display>{part.content}</Math>
          </div>
        ) : (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              h1: ({ node, ...props }) => (
                <h1 style={{ fontSize: 'var(--text-lab-2xl)', marginTop: 0 }} {...props} />
              ),
              h2: ({ node, ...props }) => <h2 style={{ fontSize: 'var(--text-lab-xl)' }} {...props} />,
              h3: ({ node, ...props }) => <h3 style={{ fontSize: 'var(--text-lab-lg)' }} {...props} />,
              p: ({ node, children, ...props }) => {
                const rendered =
                  typeof children === 'string'
                    ? renderInlineMath(children)
                    : Array.isArray(children)
                      ? children.map((c, idx) =>
                          typeof c === 'string' ? <span key={idx}>{renderInlineMath(c)}</span> : c,
                        )
                      : children
                return (
                  <p style={{ marginTop: 'var(--spacing-lab-3)' }} {...props}>
                    {rendered}
                  </p>
                )
              },
              ul: ({ node, ...props }) => (
                <ul
                  style={{
                    marginTop: 'var(--spacing-lab-3)',
                    paddingLeft: 'var(--spacing-lab-5)',
                  }}
                  {...props}
                />
              ),
              code: ({ node, ...props }) => (
                <code
                  style={{
                    fontFamily: 'var(--font-lab-mono)',
                    background: 'var(--color-lab-bg-2)',
                    padding: '0.1em 0.3em',
                    borderRadius: 4,
                  }}
                  {...props}
                />
              ),
              table: ({ node, ...props }) => (
                <div style={{ overflowX: 'auto', marginTop: 'var(--spacing-lab-3)' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.875em',
                      lineHeight: 1.5,
                    }}
                    {...props}
                  />
                </div>
              ),
              thead: ({ node, ...props }) => (
                <thead style={{ borderBottom: '2px solid var(--color-lab-rule, #d3d1c7)' }} {...props} />
              ),
              th: ({ node, ...props }) => (
                <th
                  style={{
                    padding: '6px 8px',
                    textAlign: 'left',
                    fontWeight: 500,
                    color: 'var(--color-lab-ink-2, #444441)',
                  }}
                  {...props}
                />
              ),
              td: ({ node, ...props }) => (
                <td
                  style={{
                    padding: '6px 8px',
                    verticalAlign: 'top',
                    borderBottom: '1px solid var(--color-lab-rule, #e8e6e0)',
                  }}
                  {...props}
                />
              ),
              img: ({ node, style, ...props }) => (
                <img
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    display: 'block',
                    margin: '0 auto',
                    ...(typeof style === 'object' && style !== null ? style : {}),
                  }}
                  loading="lazy"
                  {...props}
                />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote
                  style={{
                    borderLeft: '3px solid var(--color-lab-accent, #534AB7)',
                    background: 'var(--color-lab-bg-2, #F1EFE8)',
                    padding: '10px 14px',
                    margin: 'var(--spacing-lab-3) 0',
                    borderRadius: '0 8px 8px 0',
                    fontSize: '0.95em',
                  }}
                  {...props}
                />
              ),
            }}
          >
            {part.content}
          </ReactMarkdown>
        ),
      )}
    </article>
  )

  if (!hasSideImage) return textContent

  const imageBlock = (
    <figure
      style={{
        flex: 1,
        minWidth: 0,
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={slide.sideImage}
        alt={slide.sideImageAlt ?? ''}
        loading="lazy"
        style={{
          maxWidth: '100%',
          maxHeight: '70dvh',
          height: 'auto',
          borderRadius: 8,
          objectFit: 'contain',
        }}
      />
    </figure>
  )

  return (
    <div
      data-lab-text-split
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--spacing-lab-5, 2rem)',
        alignItems: 'center',
        flexDirection: sideRight ? 'row' : 'row-reverse',
      }}
    >
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>{textContent}</div>
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>{imageBlock}</div>
    </div>
  )
}
