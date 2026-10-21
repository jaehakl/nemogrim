import { request } from './client'
import type { ImportResult, MovieDetail, MoviePage } from './types'

export type ImportMode = 'files' | 'folder'

export function getMovies(cursor: number | null = null): Promise<MoviePage> {
  const params = new URLSearchParams({ limit: '24' })
  if (cursor !== null) params.set('cursor', String(cursor))
  return request(`/api/movies?${params}`)
}

export function getMovieDetail(id: number): Promise<MovieDetail> {
  return request(`/api/movies/${id}`)
}

export function prepareMoviePlayback(id: number): Promise<MovieDetail> {
  return request(`/api/movies/${id}/playback/prepare`, { method: 'POST' })
}

/** 상세 정보를 읽고, 재생 가능 여부를 아직 확인하지 않았다면 확인까지 마친 결과를 돌려준다. */
export async function getPlayableMovie(id: number): Promise<MovieDetail> {
  const detail = await getMovieDetail(id)
  return detail.playback_status === 'unprepared' ? prepareMoviePlayback(id) : detail
}

export function importMovies(mode: ImportMode): Promise<ImportResult> {
  return request(`/api/movies/import/${mode}`, { method: 'POST' })
}
