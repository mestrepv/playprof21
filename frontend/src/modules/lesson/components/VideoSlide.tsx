/**
 * VideoSlide — iframe embed. Detecta YouTube e Vimeo; qualquer outra URL
 * assume embed direto. Aspect 16/9 responsivo.
 */

import type { VideoSlide as VideoSlideModel } from '../types/manifest'

interface Props {
  slide: VideoSlideModel
}

function toEmbedUrl(src: string, startAt?: number): string {
  const ytWatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  if (ytWatch) {
    const id = ytWatch[1]
    const params = new URLSearchParams({ rel: '0', modestbranding: '1' })
    if (startAt && startAt > 0) params.set('start', String(Math.floor(startAt)))
    return `https://www.youtube.com/embed/${id}?${params.toString()}`
  }
  const vim = src.match(/vimeo\.com\/(\d+)/)
  if (vim) {
    return `https://player.vimeo.com/video/${vim[1]}${startAt ? `#t=${Math.floor(startAt)}s` : ''}`
  }
  return src
}

export function VideoSlide({ slide }: Props) {
  const embedUrl = toEmbedUrl(slide.src, slide.startAt)

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 'min(1040px, 100%)',
        margin: '0 auto',
        padding: '0 var(--spacing-lab-3, 0.875rem)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#000000',
          borderRadius: 'var(--radius-lab, 12px)',
          overflow: 'hidden',
          border: '1px solid var(--color-lab-rule, #D8D5CB)',
          boxShadow: 'var(--lab-shadow, 0 8px 24px rgba(15,17,21,0.08))',
        }}
      >
        <iframe
          src={embedUrl}
          title={slide.label}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {slide.label && (
        <div
          style={{
            marginTop: 'var(--spacing-lab-3, 0.875rem)',
            fontSize: 'var(--text-lab-sm, 0.875rem)',
            color: 'var(--color-lab-ink-3, #555B66)',
            fontFamily: 'var(--font-lab-mono, monospace)',
            textAlign: 'center',
            letterSpacing: 0.3,
          }}
        >
          {slide.label}
        </div>
      )}
    </div>
  )
}
