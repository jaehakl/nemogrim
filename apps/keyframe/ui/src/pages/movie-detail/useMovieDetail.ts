import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMovieDetail, prepareMoviePlayback, type MovieDetail } from '../../api/movies'
import { createMovieScene, getMovieScenes, retryScene, type Scene } from '../../api/scenes'

function message(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
}

function sortScenes(items: Scene[]): Scene[] {
  return [...items].sort((left, right) => left.timestamp_ms - right.timestamp_ms || left.id - right.id)
}

export function useMovieDetail(movieId: number) {
  const [movie, setMovie] = useState<MovieDetail | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [creating, setCreating] = useState(false)
  const [retryingIds, setRetryingIds] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [detail, scenePage] = await Promise.all([
        getMovieDetail(movieId),
        getMovieScenes(movieId),
      ])
      setMovie(detail)
      setScenes(scenePage.items)
      if (detail.playback_status === 'unprepared') {
        const prepared = await prepareMoviePlayback(movieId)
        setMovie(prepared)
      }
    } catch (loadError) {
      setError(message(loadError))
    } finally {
      setLoading(false)
    }
  }, [movieId])

  useEffect(() => { void load() }, [load])

  const activeSceneKey = useMemo(
    () => scenes.filter((scene) => ['pending', 'processing'].includes(scene.analysis_status)).map((scene) => scene.id).join(','),
    [scenes],
  )
  useEffect(() => {
    if (!activeSceneKey) return
    let cancelled = false
    let timer = 0
    async function poll() {
      try {
        const response = await getMovieScenes(movieId)
        if (!cancelled) setScenes(response.items)
      } catch {
        // 일시적인 polling 오류는 다음 주기에 다시 시도한다.
      } finally {
        if (!cancelled) timer = window.setTimeout(poll, 2000)
      }
    }
    timer = window.setTimeout(poll, 2000)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [activeSceneKey, movieId])

  async function create(timestampMs: number) {
    if (creating) return
    setCreating(true)
    setActionError('')
    try {
      const scene = await createMovieScene(movieId, timestampMs)
      setScenes((current) => sortScenes([...current, scene]))
      setMovie((current) => current ? { ...current, scene_count: current.scene_count + 1 } : current)
    } catch (createError) {
      setActionError(message(createError))
    } finally {
      setCreating(false)
    }
  }

  async function retryAnalysis(sceneId: number) {
    setRetryingIds((current) => new Set(current).add(sceneId))
    setActionError('')
    try {
      const scene = await retryScene(sceneId)
      setScenes((current) => current.map((item) => item.id === scene.id ? scene : item))
    } catch (retryError) {
      setActionError(message(retryError))
    } finally {
      setRetryingIds((current) => {
        const next = new Set(current)
        next.delete(sceneId)
        return next
      })
    }
  }

  return {
    movie, scenes, loading, error, actionError, creating, retryingIds,
    load, create, retryAnalysis, clearActionError: () => setActionError(''),
  }
}
