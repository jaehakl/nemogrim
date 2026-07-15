import { request } from './client'

export type SceneAnalysisStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface Scene {
  id: number
  movie_file_id: number
  timestamp_ms: number
  prompt: string | null
  keywords: string[] | null
  embedding_model: string | null
  prompt_model: string | null
  analysis_status: SceneAnalysisStatus
  analysis_error: string | null
  snapshot_url: string | null
  created_at: string
  updated_at: string
}

export interface ExplorerScene extends Scene {
  movie_title: string
}

export interface ScenePage {
  items: ExplorerScene[]
  total: number
  next_offset: number | null
  has_more: boolean
}

export interface SimilarScenePage extends ScenePage {
  available: boolean
}

export function getScenes(query: string, offset = 0): Promise<ScenePage> {
  const params = new URLSearchParams({ offset: String(offset), limit: '48' })
  if (query) params.set('query', query)
  return request(`/api/scenes?${params}`)
}

export function getScene(sceneId: number): Promise<ExplorerScene> {
  return request(`/api/scenes/${sceneId}`)
}

export function getSimilarScenes(sceneId: number, offset = 0): Promise<SimilarScenePage> {
  const params = new URLSearchParams({ offset: String(offset), limit: '24' })
  return request(`/api/scenes/${sceneId}/similar?${params}`)
}

export function getMovieScenes(movieId: number): Promise<{ items: Scene[] }> {
  return request(`/api/movies/${movieId}/scenes`)
}

export function createMovieScene(movieId: number, timestampMs: number): Promise<Scene> {
  return request(`/api/movies/${movieId}/scenes`, {
    method: 'POST',
    body: JSON.stringify({ timestamp_ms: timestampMs }),
  })
}

export function retryScene(sceneId: number): Promise<Scene> {
  return request(`/api/scenes/${sceneId}/retry`, { method: 'POST' })
}
