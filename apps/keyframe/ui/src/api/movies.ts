import { request } from './client'

export type MetadataStatus = 'pending' | 'processing' | 'ready' | 'failed'
export type PlaybackStatus = 'unprepared' | 'direct' | 'pending' | 'processing' | 'ready' | 'failed'

export interface Movie {
  id: number
  title: string
  path: string
  ext: string
  size_bytes: number
  file_modified_at: string | null
  duration_ms: number | null
  width: number | null
  height: number | null
  fps: number | null
  metadata_status: MetadataStatus
  metadata_error: string | null
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

export interface MoviePage {
  items: Movie[]
  total: number
  processing_count: number
  next_cursor: number | null
  has_more: boolean
}

export interface MovieDetail extends Movie {
  video_codec: string | null
  audio_codec: string | null
  playback_status: PlaybackStatus
  playback_error: string | null
  stream_url: string | null
  scene_count: number
}

export interface MovieStatuses {
  items: Movie[]
  processing_count: number
}

export interface ImportResult {
  cancelled: boolean
  selected_count: number
  added_count: number
  duplicate_count: number
  failed_count: number
  added_ids: number[]
  failures: string[]
}

export function getMovies(beforeId: number | null = null): Promise<MoviePage> {
  const query = new URLSearchParams({ limit: '24' })
  if (beforeId) query.set('before_id', String(beforeId))
  return request(`/api/movies?${query}`)
}

export function importMovieFiles(): Promise<ImportResult> {
  return request('/api/movies/import/files', { method: 'POST' })
}

export function importMovieFolder(): Promise<ImportResult> {
  return request('/api/movies/import/folder', { method: 'POST' })
}

export function getMovieStatuses(ids: number[]): Promise<MovieStatuses> {
  return request('/api/movies/statuses', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function getMovieDetail(id: number): Promise<MovieDetail> {
  return request(`/api/movies/${id}`)
}

export function prepareMoviePlayback(id: number): Promise<MovieDetail> {
  return request(`/api/movies/${id}/playback/prepare`, { method: 'POST' })
}
