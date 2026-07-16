import { useCallback, useEffect, useRef, useState } from 'react'
import { FiAlertCircle, FiArrowLeft, FiCheckCircle, FiClock, FiFilm, FiImage, FiLoader, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getMovieDetail, prepareMoviePlayback, type MovieDetail } from '../../api/movies'
import { createMovieScene, deleteScene, getScene, getSimilarScenes, type ExplorerScene } from '../../api/scenes'
import { SceneTile } from '../../components/scene/SceneTile'
import { SceneVideoPlayer } from '../../components/scene/SceneVideoPlayer'
import { formatSceneTimestamp } from '../movie-detail/formatters'
import './SceneDetailPage.css'

function message(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
}

export function SceneDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const sceneId = Number(params.sceneId)
  const validSceneId = Number.isInteger(sceneId) && sceneId > 0 ? sceneId : -1
  const [scene, setScene] = useState<ExplorerScene | null>(null)
  const [movie, setMovie] = useState<MovieDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [playbackError, setPlaybackError] = useState('')
  const [creating, setCreating] = useState(false)
  const [createSuccess, setCreateSuccess] = useState('')
  const [createError, setCreateError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [similarScenes, setSimilarScenes] = useState<ExplorerScene[]>([])
  const [similarTotal, setSimilarTotal] = useState(0)
  const [similarAvailable, setSimilarAvailable] = useState(true)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [similarLoading, setSimilarLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [similarError, setSimilarError] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const sceneGenerationRef = useRef(0)
  const similarGenerationRef = useRef(0)
  const loadingMoreRef = useRef(false)

  const loadScene = useCallback(async () => {
    const generation = ++sceneGenerationRef.current
    setScene(null)
    setMovie(null)
    setPageError('')
    setPlaybackError('')
    setCreating(false)
    setCreateSuccess('')
    setCreateError('')
    setDeleting(false)
    setDeleteError('')
    setLoading(true)
    window.scrollTo({ top: 0 })
    try {
      const loadedScene = await getScene(validSceneId)
      if (sceneGenerationRef.current !== generation) return
      setScene(loadedScene)
      try {
        let loadedMovie = await getMovieDetail(loadedScene.movie_file_id)
        if (sceneGenerationRef.current !== generation) return
        setMovie(loadedMovie)
        if (loadedMovie.playback_status === 'unprepared') {
          try {
            loadedMovie = await prepareMoviePlayback(loadedScene.movie_file_id)
            if (sceneGenerationRef.current !== generation) return
            setMovie(loadedMovie)
          } catch (prepareError) {
            if (sceneGenerationRef.current === generation) setPlaybackError(message(prepareError))
          }
        }
      } catch (movieError) {
        if (sceneGenerationRef.current === generation) setPlaybackError(message(movieError))
      }
    } catch (loadError) {
      if (sceneGenerationRef.current === generation) setPageError(message(loadError))
    } finally {
      if (sceneGenerationRef.current === generation) setLoading(false)
    }
  }, [validSceneId])

  const loadSimilarFirstPage = useCallback(async () => {
    const generation = ++similarGenerationRef.current
    setSimilarScenes([])
    setSimilarTotal(0)
    setSimilarAvailable(true)
    setNextOffset(null)
    setSimilarError('')
    setSimilarLoading(true)
    loadingMoreRef.current = false
    setLoadingMore(false)
    try {
      const response = await getSimilarScenes(validSceneId, 0)
      if (similarGenerationRef.current !== generation) return
      setSimilarScenes(response.items)
      setSimilarTotal(response.total)
      setSimilarAvailable(response.available)
      setNextOffset(response.next_offset)
    } catch (loadError) {
      if (similarGenerationRef.current === generation) setSimilarError(message(loadError))
    } finally {
      if (similarGenerationRef.current === generation) setSimilarLoading(false)
    }
  }, [validSceneId])

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loadingMoreRef.current) return
    const generation = similarGenerationRef.current
    loadingMoreRef.current = true
    setLoadingMore(true)
    setSimilarError('')
    try {
      const response = await getSimilarScenes(validSceneId, nextOffset)
      if (similarGenerationRef.current !== generation) return
      setSimilarScenes((current) => [...current, ...response.items])
      setSimilarTotal(response.total)
      setSimilarAvailable(response.available)
      setNextOffset(response.next_offset)
    } catch (loadError) {
      if (similarGenerationRef.current === generation) setSimilarError(message(loadError))
    } finally {
      if (similarGenerationRef.current === generation) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
    }
  }, [nextOffset, validSceneId])

  useEffect(() => { void loadScene() }, [loadScene])
  useEffect(() => { void loadSimilarFirstPage() }, [loadSimilarFirstPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || nextOffset === null || similarLoading) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore() },
      { rootMargin: '320px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, nextOffset, similarLoading])

  async function createScene(timestampMs: number) {
    if (!scene || creating) return
    const generation = sceneGenerationRef.current
    setCreating(true)
    setCreateSuccess('')
    setCreateError('')
    try {
      await createMovieScene(scene.movie_file_id, timestampMs)
      if (sceneGenerationRef.current === generation) setCreateSuccess('Scene을 생성했습니다.')
    } catch (error) {
      if (sceneGenerationRef.current === generation) setCreateError(message(error))
    } finally {
      if (sceneGenerationRef.current === generation) setCreating(false)
    }
  }

  async function removeScene() {
    if (!scene || deleting) return
    if (!window.confirm('이 Scene을 삭제할까요? 삭제한 Scene과 snapshot은 복구할 수 없습니다.')) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteScene(scene.id)
      navigate(`/movies/${scene.movie_file_id}`)
    } catch (error) {
      setDeleteError(message(error))
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="scene-detail-loading" role="status"><FiLoader /><span>Scene 상세 정보를 불러오는 중입니다.</span></div>
  }
  if (pageError || !scene) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <FiAlertCircle /><h2>Scene 상세 정보를 불러오지 못했습니다</h2>
        <p>{pageError || 'Scene을 찾을 수 없습니다.'}</p>
        <div className="scene-detail-error-actions">
          <Link to="/scenes" className="secondary-button"><FiArrowLeft /> Scene 탐색</Link>
          <button type="button" className="secondary-button" onClick={() => { void loadScene(); void loadSimilarFirstPage() }}><FiRefreshCw /> 다시 시도</button>
        </div>
      </div>
    )
  }

  const unavailableMessage = scene.analysis_status === 'failed'
    ? '현재 Scene 분석에 실패해 비슷한 Scene을 찾을 수 없습니다.'
    : '현재 Scene 분석이 완료되면 비슷한 Scene을 확인할 수 있습니다.'

  return (
    <div className="scene-detail-page">
      <header className="scene-detail-header">
        <div>
          <Link to="/scenes" className="scene-detail-back"><FiArrowLeft /> Scene 탐색</Link>
          <p className="eyebrow">SCENE DETAIL</p>
          <h1>{scene.movie_title}</h1>
          <div className="scene-detail-header__meta">
            <span><FiClock />{formatSceneTimestamp(scene.timestamp_ms)}</span>
            <span><FiFilm />Scene #{scene.id}</span>
          </div>
        </div>
        <button type="button" className="scene-detail-delete" disabled={deleting} onClick={() => void removeScene()}>
          {deleting ? <FiLoader className="button-spinner" /> : <FiTrash2 />}
          {deleting ? '삭제 중' : 'Scene 삭제'}
        </button>
      </header>

      {createSuccess ? (
        <div className="notice notice--success" role="status">
          <span><FiCheckCircle aria-hidden="true" /><strong>{createSuccess}</strong></span>
          <button type="button" aria-label="성공 알림 닫기" onClick={() => setCreateSuccess('')}><FiX /></button>
        </div>
      ) : null}
      {createError ? (
        <div className="notice notice--error" role="alert">
          <strong>{createError}</strong>
          <button type="button" aria-label="오류 알림 닫기" onClick={() => setCreateError('')}><FiX /></button>
        </div>
      ) : null}
      {deleteError ? (
        <div className="notice notice--error" role="alert">
          <strong>{deleteError}</strong>
          <button type="button" aria-label="삭제 오류 알림 닫기" onClick={() => setDeleteError('')}><FiX /></button>
        </div>
      ) : null}

      <div className="scene-detail-layout">
        <SceneVideoPlayer
          streamUrl={movie?.stream_url || null}
          durationMs={movie?.duration_ms || null}
          playbackError={playbackError || movie?.playback_error || '영상 재생 정보를 준비하지 못했습니다.'}
          creating={creating}
          onCreateScene={(timestampMs) => void createScene(timestampMs)}
          startAtMs={scene.timestamp_ms}
          autoPlayStart
        />

        <aside className="scene-detail-info" aria-label="Scene 정보">
          <p className="eyebrow">SCENE CONTEXT</p>
          <h2>Scene 정보</h2>
          <p className="scene-detail-info__prompt">{scene.prompt || '추출된 prompt가 없습니다.'}</p>
          {scene.keywords?.length ? (
            <div className="scene-detail-keywords" aria-label="Scene keywords">
              {scene.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
            </div>
          ) : null}
        </aside>
      </div>

      <section className="similar-scenes" aria-labelledby="similar-scenes-title">
        <div className="similar-scenes__header">
          <div><p className="eyebrow">CLIP SIMILARITY</p><h2 id="similar-scenes-title">비슷한 Scene</h2></div>
          {!similarLoading && similarAvailable ? <span>{similarTotal.toLocaleString('ko-KR')}개</span> : null}
        </div>

        {similarLoading ? (
          <div className="similar-scenes__state" role="status"><FiLoader /><span>비슷한 Scene을 찾는 중입니다.</span></div>
        ) : !similarAvailable ? (
          <div className="similar-scenes__empty"><FiImage /><strong>유사도 분석을 사용할 수 없습니다</strong><p>{unavailableMessage}</p></div>
        ) : similarError && similarScenes.length === 0 ? (
          <div className="similar-scenes__empty" role="alert"><FiAlertCircle /><strong>비슷한 Scene을 불러오지 못했습니다</strong><p>{similarError}</p><button type="button" className="secondary-button" onClick={() => void loadSimilarFirstPage()}><FiRefreshCw /> 다시 시도</button></div>
        ) : similarScenes.length === 0 ? (
          <div className="similar-scenes__empty"><FiImage /><strong>비슷한 Scene이 없습니다</strong><p>비교할 수 있는 다른 Scene이 아직 없습니다.</p></div>
        ) : (
          <>
            {similarError ? (
              <div className="notice notice--error" role="alert"><strong>{similarError}</strong><button type="button" onClick={() => void loadMore()}><FiRefreshCw /> 계속 불러오기</button></div>
            ) : null}
            <div className="similar-scenes__grid">{similarScenes.map((item) => <SceneTile key={item.id} scene={item} />)}</div>
            <div ref={sentinelRef} className="load-sentinel" aria-hidden={!loadingMore}>
              {loadingMore ? <span><FiLoader /> 다음 Scene을 불러오는 중</span>
                : nextOffset !== null ? <span className="sr-only">더 많은 Scene이 있습니다.</span>
                  : <span>모든 유사 Scene을 불러왔습니다.</span>}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
