import { useCallback, useEffect, useRef, useState } from 'react'
import { FiAlertCircle, FiArrowLeft, FiCamera, FiClock, FiFilm, FiLoader, FiRefreshCw, FiX } from 'react-icons/fi'
import { Link, useParams } from 'react-router-dom'
import type { Scene } from '../../api/scenes'
import { formatDuration } from '../movies/formatters'
import { formatSceneTimestamp } from './formatters'
import { SceneCard } from './SceneCard'
import { useMovieDetail } from './useMovieDetail'
import './MovieDetailPage.css'

function editableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function MovieDetailPage() {
  const params = useParams()
  const movieId = Number(params.movieId)
  const detail = useMovieDetail(Number.isInteger(movieId) && movieId > 0 ? movieId : -1)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)

  const createAtCurrentTime = useCallback(() => {
    const player = videoRef.current
    if (!player || !detail.movie?.stream_url || detail.creating) return
    void detail.create(Math.max(0, Math.round(player.currentTime * 1000)))
  }, [detail])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (editableTarget(event.target)) return
      const player = videoRef.current
      if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && player) {
        event.preventDefault()
        if (event.repeat) return
        const step = event.shiftKey ? 300 : event.ctrlKey ? 60 : 10
        const direction = event.key === 'ArrowRight' ? 1 : -1
        const duration = Number.isFinite(player.duration) ? player.duration : (detail.movie?.duration_ms || 0) / 1000
        player.currentTime = Math.min(Math.max(player.currentTime + direction * step, 0), duration || Number.MAX_SAFE_INTEGER)
        setCurrentTimeMs(Math.round(player.currentTime * 1000))
      } else if (event.key.toLowerCase() === 's' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) {
        event.preventDefault()
        createAtCurrentTime()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [createAtCurrentTime, detail.movie?.duration_ms])

  function playScene(scene: Scene) {
    const player = videoRef.current
    if (!player) return
    player.currentTime = scene.timestamp_ms / 1000
    setCurrentTimeMs(scene.timestamp_ms)
    void player.play().catch(() => undefined)
    player.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (detail.loading) {
    return <div className="detail-loading" role="status"><FiLoader /><span>영상 상세 정보를 불러오는 중입니다.</span></div>
  }
  if (detail.error || !detail.movie) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <FiAlertCircle /><h2>영상 상세 정보를 불러오지 못했습니다</h2><p>{detail.error || '영상을 찾을 수 없습니다.'}</p>
        <button type="button" className="secondary-button" onClick={() => void detail.load()}><FiRefreshCw /> 다시 시도</button>
      </div>
    )
  }

  const movie = detail.movie
  return (
    <div className="movie-detail-page">
      <header className="detail-header">
        <div>
          <Link to="/movies" className="detail-back"><FiArrowLeft /> 영상 라이브러리</Link>
          <p className="eyebrow">VIDEO DETAIL</p>
          <h1>{movie.title}</h1>
          <p className="detail-header__path" title={movie.path}>{movie.path}</p>
        </div>
        <div className="detail-header__meta">
          <span><FiClock />{formatDuration(movie.duration_ms)}</span>
          <span><FiFilm />{movie.width && movie.height ? `${movie.width} × ${movie.height}` : '해상도 확인 중'}</span>
        </div>
      </header>

      {detail.actionError ? (
        <div className="notice notice--error" role="alert">
          <strong>{detail.actionError}</strong>
          <button type="button" aria-label="오류 알림 닫기" onClick={detail.clearActionError}><FiX /></button>
        </div>
      ) : null}

      <div className="detail-layout">
        <section className="player-panel" aria-label="영상 플레이어">
          <div className="player-frame">
            {movie.stream_url ? (
              <video
                key={movie.stream_url}
                ref={videoRef}
                controls
                preload="metadata"
                src={movie.stream_url}
                onTimeUpdate={(event) => setCurrentTimeMs(Math.round(event.currentTarget.currentTime * 1000))}
              >이 브라우저는 영상 재생을 지원하지 않습니다.</video>
            ) : (
              <div className="player-state player-state--error" role="alert"><FiAlertCircle /><strong>브라우저에서 직접 재생할 수 없는 형식입니다</strong><span>{movie.playback_error || '지원하는 파일과 codec의 영상만 직접 재생할 수 있습니다.'}</span></div>
            )}
          </div>
          <div className="player-toolbar">
            <div><span>현재 위치</span><strong>{formatSceneTimestamp(currentTimeMs)}</strong></div>
            <button type="button" className="primary-button" disabled={!movie.stream_url || detail.creating} onClick={createAtCurrentTime}>
              {detail.creating ? <FiLoader className="button-spinner" /> : <FiCamera />}
              {detail.creating ? 'Scene 등록 중' : '현재 위치에 Scene 생성'}
            </button>
          </div>
          <p className="player-shortcuts"><kbd>←</kbd><kbd>→</kbd> 10초 · <kbd>Ctrl</kbd> 1분 · <kbd>Shift</kbd> 5분 · <kbd>S</kbd> Scene 생성</p>
        </section>

        <aside className="scene-panel" aria-label="Scene 목록">
          <div className="scene-panel__header"><div><p className="eyebrow">SCENES</p><h2>Scene 목록</h2></div><span>{detail.scenes.length.toLocaleString('ko-KR')}개</span></div>
          {detail.scenes.length ? (
            <div className="scene-list">{detail.scenes.map((scene) => (
              <SceneCard key={scene.id} scene={scene} retrying={detail.retryingIds.has(scene.id)} onPlay={playScene} onRetry={(id) => void detail.retryAnalysis(id)} />
            ))}</div>
          ) : (
            <div className="scene-empty"><FiCamera /><strong>아직 Scene이 없습니다</strong><p>영상을 재생하고 원하는 위치에서 Scene을 생성하세요.</p></div>
          )}
        </aside>
      </div>
    </div>
  )
}
