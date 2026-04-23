import { SLIDE_REGISTRY } from '../registry'
import type { Slide } from '../types/manifest'

interface Props {
  slide: Slide
}

export function SlideRenderer({ slide }: Props) {
  const def = SLIDE_REGISTRY[slide.type]
  if (!def) {
    return (
      <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
        tipo desconhecido: {(slide as { type: string }).type}
      </div>
    )
  }
  const { Renderer } = def
  return <Renderer slide={slide} />
}
