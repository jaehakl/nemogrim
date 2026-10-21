import { request } from './client'
import type { ExplorerScene, Scene, ScenePage, SimilarScenePage } from './types'

export function getScenes(query: string, cursor: number | null = null): Promise<ScenePage> {
  const params = new URLSearchParams({ limit: '48' })
  if (query) params.set('query', query)
  if (cursor !== null) params.set('cursor', String(cursor))
  return request(`/api/scenes?${params}`)
}

export function getScene(sceneId: number): Promise<ExplorerScene> {
  return request(`/api/scenes/${sceneId}`)
}

export function getSimilarScenes(sceneId: number, cursor: number | null = null): Promise<SimilarScenePage> {
  const params = new URLSearchParams({ limit: '24' })
  if (cursor !== null) params.set('cursor', String(cursor))
  return request(`/api/scenes/${sceneId}/similar?${params}`)
}

export async function getMovieScenes(movieId: number): Promise<Scene[]> {
  const response = await request<{ items: Scene[] }>(`/api/movies/${movieId}/scenes`)
  return response.items
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

export function deleteScene(sceneId: number): Promise<void> {
  return request(`/api/scenes/${sceneId}`, { method: 'DELETE' })
}
