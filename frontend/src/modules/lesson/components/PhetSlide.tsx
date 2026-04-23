import type { PhetSlide as Model } from '../types/manifest'

interface Props {
  slide: Model
}

export function PhetSlide({ slide }: Props) {
  const height = slide.height ?? 560
  return (
    <div style={containerStyle}>
      <p style={labelStyle}>{slide.label}</p>
      <iframe
        src={slide.simUrl}
        width="100%"
        height={height}
        style={{ border: 'none', borderRadius: 8, display: 'block' }}
        allowFullScreen
        title={slide.label}
      />
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-lab-2, 0.5rem)',
  padding: 'var(--spacing-lab-4, 1rem) 0',
}

const labelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-lab-lg, 1.125rem)',
  fontWeight: 600,
  color: 'var(--p21-ink, #0F1115)',
}
