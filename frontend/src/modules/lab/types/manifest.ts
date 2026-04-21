/**
 * Schema do manifest de jogo.
 *
 * Portado do module_lab do rpgia. Espelha a validação do
 * backend/modules/lab/content_loader.py.
 */

export type SlideType = 'text' | 'video' | 'quiz' | 'mission' | 'custom'

export interface SlideBase {
  id: string
  label: string
  notesForMaster?: string
}

export interface TextSlide extends SlideBase {
  type: 'text'
  body: string
  sideImage?: string
  sideImageAlt?: string
  sidePosition?: 'left' | 'right'
}

export interface VideoSlide extends SlideBase {
  type: 'video'
  src: string
  startAt?: number
}

export interface QuizSlide extends SlideBase {
  type: 'quiz'
  questionId: string
  stem: string
  options: string[]
  correctIndex: number
  scoring?: { correct: number; wrong: number }
}

export interface MissionSlide extends SlideBase {
  type: 'mission'
  missionId: string
  activities?: Array<{ id: string; label: string }>
  interactionMode?: 'free' | 'master-led'
}

export interface CustomSlide extends SlideBase {
  type: 'custom'
  componentId: string
  props?: Record<string, unknown>
}

export type Slide = TextSlide | VideoSlide | QuizSlide | MissionSlide | CustomSlide

export interface Manifest {
  version: 1
  gameSlug: string
  title: string
  subject?: string
  slides: Slide[]
  estimatedDurationMin?: number
  recommendedAge?: string
}

export interface GameEnvelope {
  slug: string
  title: string
  subject?: string
  version: number
  manifest: Manifest
}
