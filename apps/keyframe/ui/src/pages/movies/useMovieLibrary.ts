import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getMovies, getMovieStatuses, importMovieFiles, importMovieFolder,
  type MetadataStatus, type Movie,
} from '../../api/movies'
import type { ImportMode } from './AddMovieMenu'

const PROCESSING_STATUSES = new Set<MetadataStatus>(['pending', 'processing'])
export interface Notice { tone: 'neutral' | 'success' | 'warning' | 'error'; text: string; detail?: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
}

export function useMovieLibrary() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [processingCount, setProcessingCount] = useState(0)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState<ImportMode | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const loadingMoreRef = useRef(false)
  const requestSequence = useRef(0)

  const loadFirstPage = useCallback(async () => {
    const sequence = ++requestSequence.current
    setLoadingInitial(true)
    setError('')
    try {
      const response = await getMovies()
      if (sequence !== requestSequence.current) return
      setMovies(response.items)
      setNextCursor(response.next_cursor)
      setTotal(response.total)
      setProcessingCount(response.processing_count)
    } catch (loadError) {
      if (sequence === requestSequence.current) setError(errorMessage(loadError))
    } finally {
      if (sequence === requestSequence.current) setLoadingInitial(false)
    }
  }, [])

  useEffect(() => { void loadFirstPage() }, [loadFirstPage])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const response = await getMovies(nextCursor)
      setMovies((current) => {
        const knownIds = new Set(current.map((movie) => movie.id))
        return [...current, ...response.items.filter((movie) => !knownIds.has(movie.id))]
      })
      setNextCursor(response.next_cursor)
      setTotal(response.total)
      setProcessingCount(response.processing_count)
    } catch (loadError) {
      setNotice({ tone: 'error', text: errorMessage(loadError) })
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [nextCursor])

  const activeIds = useMemo(
    () => movies.filter((movie) => PROCESSING_STATUSES.has(movie.metadata_status)).map((movie) => movie.id),
    [movies],
  )
  const activeIdsKey = activeIds.join(',')

  useEffect(() => {
    if (processingCount === 0 && !activeIdsKey) return
    const ids = activeIdsKey ? activeIdsKey.split(',').map(Number) : []
    let cancelled = false
    let timer: number

    async function poll() {
      try {
        const response = await getMovieStatuses(ids)
        if (cancelled) return
        const updates = new Map(response.items.map((movie) => [movie.id, movie]))
        setMovies((current) => current.map((movie) => updates.get(movie.id) || movie))
        setProcessingCount(response.processing_count)
        const visibleWorkRemains = response.items.some((movie) => PROCESSING_STATUSES.has(movie.metadata_status))
        if (response.processing_count > 0 || visibleWorkRemains) timer = window.setTimeout(poll, 2000)
      } catch {
        if (!cancelled) timer = window.setTimeout(poll, 4000)
      }
    }

    timer = window.setTimeout(poll, 2000)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [activeIdsKey, processingCount])

  async function handleImport(mode: ImportMode) {
    setImporting(mode)
    setNotice(null)
    try {
      const result = mode === 'files' ? await importMovieFiles() : await importMovieFolder()
      if (result.cancelled) {
        setNotice({ tone: 'neutral', text: '영상 추가를 취소했습니다.' })
        return
      }
      setNotice({
        tone: result.failed_count ? 'warning' : 'success',
        text: `새 영상 ${result.added_count}개 · 중복 ${result.duplicate_count}개 · 실패 ${result.failed_count}개`,
        detail: result.failures?.[0] || '',
      })
      await loadFirstPage()
    } catch (importError) {
      setNotice({ tone: 'error', text: errorMessage(importError) })
    } finally {
      setImporting(null)
    }
  }

  return {
    movies, nextCursor, total, processingCount, loadingInitial, loadingMore,
    error, importing, notice, setNotice, loadFirstPage, loadMore, handleImport,
  }
}
