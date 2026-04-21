/**
 * SlideRenderer — despacha por tipo de slide.
 *
 * Fase 2: suporta text e video. Mission, quiz e custom ainda não — placeholder
 * com aviso. Fases 3+ plugam os tipos restantes.
 */

import type { Slide } from '../types/manifest'
import { TextSlide } from './TextSlide'
import { VideoSlide } from './VideoSlide'

interface Props {
  slide: Slide
}

export function SlideRenderer({ slide }: Props) {
  switch (slide.type) {
    case 'text':
      return <TextSlide slide={slide} />
    case 'video':
      return <VideoSlide slide={slide} />
    case 'quiz':
    case 'mission':
    case 'custom':
      return <UnsupportedSlide kind={slide.type} label={slide.label} />
    default: {
      const _exhaustive: never = slide
      return null
    }
  }
}

function UnsupportedSlide({ kind, label }: { kind: string; label: string }) {
  return (
    <div
      style={{
        padding: 'var(--spacing-lab-5, 2rem)',
        border: '1px dashed var(--color-lab-rule, #D8D5CB)',
        borderRadius: 12,
        color: 'var(--color-lab-ink-3, #555B66)',
        fontFamily: 'var(--font-lab-mono, monospace)',
        fontSize: 'var(--text-lab-sm, 0.875rem)',
        lineHeight: 1.6,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 6 }}>
        slide tipo `{kind}` — ainda não portado (Fase 2 cobre só text e video)
      </strong>
      label: {label}
    </div>
  )
}
