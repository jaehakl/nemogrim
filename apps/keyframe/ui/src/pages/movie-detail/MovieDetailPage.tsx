import { useRef } from 'react'
import { FiAlertCircle, FiArrowLeft, FiCamera, FiClock, FiFilm, FiLoader, FiRefreshCw, FiX } from 'react-icons/fi'
import { Link, useParams } from 'react-router-dom'
import type { Scene } from '../../api/scenes'
import { SceneVideoPlayer, type SceneVideoPlayerHandle } from '../../components/scene/SceneVideoPlayer'
import { formatDuration } from '../movies/formatters'
import { SceneCard } from './SceneCard'
import { useMovieDetail } from './useMovieDetail'
import './MovieDetailPage.css'

export function MovieDetailPage() {
  const params = useParams()
  const movieId = Number(params.movieId)
  const detail = useMovieDetail(Number.isInteger(movieId) && movieId > 0 ? movieId : -1)
  const playerRef = useRef<SceneVideoPlayerHandle>(null)

  function playScene(scene: Scene) {
    playerRef.current?.playAt(scene.timestamp_ms, true)
  }

  function removeScene(scene: Scene) {
    if (!window.confirm('이 Scene을 삭제할까요? 삭제한 Scene과 snapshot은 복구할 수 없습니다.')) return
    void detail.removeScene(scene.id)
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
        <SceneVideoPlayer
          ref={playerRef}
          streamUrl={movie.stream_url}
          durationMs={movie.duration_ms}
          playbackError={movie.playback_error}
          creating={detail.creating}
          onCreateScene={(timestampMs) => void detail.create(timestampMs)}
        />

        <aside className="scene-panel" aria-label="Scene 목록">
          <div className="scene-panel__header"><div><p className="eyebrow">SCENES</p><h2>Scene 목록</h2></div><span>{detail.scenes.length.toLocaleString('ko-KR')}개</span></div>
          {detail.scenes.length ? (
            <div className="scene-list">{detail.scenes.map((scene) => (
              <SceneCard key={scene.id} scene={scene} retrying={detail.retryingIds.has(scene.id)}
                deleting={detail.deletingIds.has(scene.id)} onPlay={playScene}
                onRetry={(id) => void detail.retryAnalysis(id)} onDelete={removeScene} />
            ))}</div>
          ) : (
            <div className="scene-empty"><FiCamera /><strong>아직 Scene이 없습니다</strong><p>영상을 재생하고 원하는 위치에서 Scene을 생성하세요.</p></div>
          )}
        </aside>
      </div>
    </div>
  )
}
