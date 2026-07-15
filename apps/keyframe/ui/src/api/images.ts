import { request } from './client'

export interface GeneratedImage {
  id: number
  prompt: string | null
  image_url: string
}

export interface ImagePage {
  items: GeneratedImage[]
  total: number
  next_cursor: number | null
  has_more: boolean
}

export interface SdxlModelDefaults {
  name: string
  step: number
  cfg: number
  height: number
  width: number
  strength: number
  format: 'png' | 'jpg'
}

export interface SdxlModelCatalog {
  default_model: string
  models: SdxlModelDefaults[]
}

export interface ImageGenerationRequest {
  timestamp_ms: number
  model: string
  count: number
  negative_prompt: string
  seed: number | null
  step: number
  cfg: number
  strength: number
  width: number
  height: number
  format: 'png' | 'jpg'
}

export function getImages(beforeId: number | null = null): Promise<ImagePage> {
  const query = new URLSearchParams({ limit: '24' })
  if (beforeId) query.set('before_id', String(beforeId))
  return request(`/api/images?${query}`)
}

export function getSdxlModels(): Promise<SdxlModelCatalog> {
  return request('/api/images/models')
}

export function generateMovieImages(
  movieId: number,
  payload: ImageGenerationRequest,
): Promise<{ items: GeneratedImage[] }> {
  return request(`/api/movies/${movieId}/images`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
