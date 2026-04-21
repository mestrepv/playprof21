export interface Classroom {
  id: string
  owner_id: string
  name: string
  created_at: string
}

export interface Track {
  id: string
  classroom_id: string
  name: string
  order: number
  created_at: string
}

export interface Collection {
  id: string
  track_id: string
  name: string
  order: number
  created_at: string
}

export interface Lesson {
  id: string
  collection_id: string
  slug: string
  title: string | null
  order: number
  created_at: string
}
