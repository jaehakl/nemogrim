export type JobStatus = 'pending' | 'processing' | 'ready' | 'failed'
export type PlaybackStatus = 'unprepared' | 'direct' | 'failed'
export type AiState = 'not_loaded' | 'loading' | 'ready' | 'error'

/** 목록 응답. `next_cursor`를 그대로 다음 요청의 cursor로 넘긴다. */
export interface Page<T> {
  items: T[]
  total: number
  next_cursor: number | null
}

export interface Movie {
  id: number
  title: string
  path: string
  ext: string
  size_bytes: number
  file_modified_at: string
  duration_ms: number | null
  width: number | null
  height: number | null
  fps: number | null
  metadata_status: JobStatus
  metadata_error: string | null
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

export interface MoviePage extends Page<Movie> {
  processing_count: number
}

export interface MovieDetail extends Movie {
  video_codec: string | null
  audio_codec: string | null
  playback_status: PlaybackStatus
  playback_error: string | null
  stream_url: string | null
  scene_count: number
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

export interface Scene {
  id: number
  movie_file_id: number
  timestamp_ms: number
  prompt: string | null
  keywords: string[] | null
  embedding_model: string | null
  prompt_model: string | null
  analysis_status: JobStatus
  analysis_error: string | null
  snapshot_url: string | null
  created_at: string
  updated_at: string
}

export interface ExplorerScene extends Scene {
  movie_title: string
}

export type ScenePage = Page<ExplorerScene>

export interface SimilarScenePage extends Page<ExplorerScene> {
  available: boolean
}

export interface ModelStatus {
  name: string
  state: AiState
  error: string | null
}

export interface AiStatus {
  state: AiState
  requested_device: string
  device: string | null
  device_name: string | null
  note: string | null
  models: Record<'clip' | 'tagger', ModelStatus>
}
