import type { GeogebraSlide as Model } from '../types/manifest'

interface Props {
  slide: Model
}

function extractId(materialId: string): string {
  // aceita URL completa (https://www.geogebra.org/m/XptVXvfn) ou só o ID
  const m = materialId.match(/geogebra\.org\/(?:m|classic|geometry|graphing|3d|cas)\/([A-Za-z0-9]+)/)
  return m ? m[1] : materialId
}

export function GeogebraSlide({ slide }: Props) {
  const height = slide.height ?? 500
  const id = extractId(slide.materialId)
  const toolbar = slide.showToolbar ? 'true' : 'false'
  const algebra = slide.showAlgebraInput ? 'true' : 'false'

  // Não incluímos width no URL — deixamos o GeoGebra usar 100% do container.
  // Os parâmetros de path são o formato oficial do botão "Compartilhar > Incorporar".
  const src =
    `https://www.geogebra.org/material/iframe/id/${id}` +
    `/border/888888` +
    `/sfsb/true/smb/false/stb/false/stbh/false` +
    `/ai/${algebra}/asb/false/sri/false/rc/false/ld/false/sdz/true/ctl/false` +
    `/toolbar/${toolbar}`

  return (
    <div style={containerStyle}>
      <p style={labelStyle}>{slide.label}</p>
      <iframe
        src={src}
        width="100%"
        height={height}
        style={{ border: 'none', borderRadius: 8, display: 'block' }}
        allowFullScreen
        allow="fullscreen"
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
