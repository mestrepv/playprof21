/**
 * Slide Type Registry — ponto central de registro de tipos de slide.
 *
 * Adicionar um novo tipo = uma entrada aqui + interface em manifest.ts
 * + validação em content_loader.py. O SlideRenderer e o editor UI
 * consomem este registry em vez de switches manuais.
 */

import type { ComponentType } from 'react'

import { GeogebraSlide } from './components/GeogebraSlide'
import { MissionSlide } from './components/MissionSlide'
import { PhetSlide } from './components/PhetSlide'
import { QuizFillSlide } from './components/QuizFillSlide'
import { QuizImageSlide } from './components/QuizImageSlide'
import { QuizSlide } from './components/QuizSlide'
import { TextSlide } from './components/TextSlide'
import { VideoSlide } from './components/VideoSlide'
import type { Slide, SlideType } from './types/manifest'

export type SlideCategory = 'content' | 'quiz' | 'interactive'

export interface SlideTypeDef {
  displayName: string
  icon: string
  category: SlideCategory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Renderer: ComponentType<{ slide: any }>
}

export const SLIDE_REGISTRY: Record<SlideType, SlideTypeDef> = {
  text: {
    displayName: 'Texto',
    icon: '📝',
    category: 'content',
    Renderer: TextSlide,
  },
  video: {
    displayName: 'Vídeo',
    icon: '▶️',
    category: 'content',
    Renderer: VideoSlide,
  },
  quiz: {
    displayName: 'Quiz',
    icon: '❓',
    category: 'quiz',
    Renderer: QuizSlide,
  },
  'quiz-image': {
    displayName: 'Quiz com imagem',
    icon: '🖼️',
    category: 'quiz',
    Renderer: QuizImageSlide,
  },
  'quiz-fill': {
    displayName: 'Completar lacuna',
    icon: '✏️',
    category: 'quiz',
    Renderer: QuizFillSlide,
  },
  mission: {
    displayName: 'Missão interativa',
    icon: '⚡',
    category: 'interactive',
    Renderer: MissionSlide,
  },
  phet: {
    displayName: 'Simulação PhET',
    icon: '🔬',
    category: 'interactive',
    Renderer: PhetSlide,
  },
  geogebra: {
    displayName: 'GeoGebra',
    icon: '📐',
    category: 'interactive',
    Renderer: GeogebraSlide,
  },
  custom: {
    displayName: 'Customizado',
    icon: '🔧',
    category: 'content',
    Renderer: UnsupportedRenderer,
  },
}

function UnsupportedRenderer({ slide }: { slide: Slide }) {
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
        slide tipo `{slide.type}` — não suportado
      </strong>
      label: {slide.label}
    </div>
  )
}
