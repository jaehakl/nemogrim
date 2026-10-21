import { useRef } from 'react'
import { FiArrowLeft, FiCamera, FiClock, FiFilm, FiHardDrive, FiMonitor, FiRefreshCw } from 'react-icons/fi'
import { Link, useParams } from 'react-router-dom'
import type { Scene } from '../../api/types'
import { SceneListItem } from '../../components/media/SceneListItem'
import { SceneVideoPlayer, type SceneVideoPlayerHandle } from '../../components/player/SceneVideoPlayer'
import { StatePanel } from '../../components/ui/StatePanel'
import { useToast } from '../../components/ui/toastContext'
import { usePlayableMovie } from '../../hooks/movies'
import { useCreateScene, useDeleteScene, useMovieScenes, useRetryScene } from '../../hooks/scenes'
import { parseRouteId } from '../../lib/route'
import { errorMessage } from '../../lib/errors'
import { formatBytes, formatCount, formatDuration, formatResolution } from '../../lib/format'
import './MovieDetailPage.css'

const DELETE_CONFIRMATION = '이 Scene을 삭제할까요? 삭제한 Scene과 snapshot은 복구할 수 없습니다.'

export function MovieDetailPage() {
  const movieId = parseRouteId(useParams().movieId)
  const movieQuery = usePlayableMovie(movieId)
  const scenesQuery = useMovieScenes(movieId)
  const createScene = useCreateScene(movieId ?? -1)
  const retryScene = useRetryScene()
  const deleteScene = useDeleteScene()
  const playerRef = useRef<SceneVideoPlayerHandle>(null)
  const notify = useToast()

  const reportError = (title: string) => (error: unknown) =>
    notify({ tone: 'danger', title, description: errorMessage(error) })

  function removeScene(scene: Scene) {
    if (!window.confirm(DELETE_CONFIRMATION)) return
    deleteScene.mutate(scene, { onError: reportError('Scene을 삭제하지 못했습니다') })
  }

  if (movieQuery.isPending || scenesQuery.isPending) {
    return <StatePanel kind="loading" title="영상 상세 정보를 불러오는 중입니다." />
  }
  if (movieQuery.isError || scenesQuery.isError) {
    return (
      <StatePanel
        kind="error"
        title="영상 상세 정보를 불러오지 못했습니다"
        description={errorMessage(movieQuery.error ?? scenesQuery.error)}
        actions={(
          <>
            <Link to="/movies" className="btn btn--secondary"><FiArrowLeft aria-hidden="true" /> 영상 라이브러리</Link>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => { void movieQuery.refetch(); void scenesQuery.refetch() }}
            >
              <FiRefreshCw aria-hidden="true" /> 다시 시도
            </button>
          </>
        )}
      />
    )
  }

  const movie = movieQuery.data
  const scenes = scenesQuery.data
  const duration = formatDuration(movie.duration_ms)
  const resolution = formatResolution(movie.width, movie.height)
  const codecs = [movie.video_codec, movie.audio_codec].filter(Boolean).join(' / ')

  return (
    <div className="movie-detail">
      <Link to="/movies" className="back-link"><FiArrowLeft aria-hidden="true" /> 영상 라이브러리</Link>

      <SceneVideoPlayer
        ref={playerRef}
        streamUrl={movie.stream_url}
        durationMs={movie.duration_ms}
        playbackError={movie.playback_error}
        creating={createScene.isPending}
        onCreateScene={(timestampMs) =>
          createScene.mutate(timestampMs, { onError: reportError('Scene을 만들지 못했습니다') })}
      />

      <header className="movie-detail__header">
        <h1>{movie.title}</h1>
        <div className="chip-row">
          {duration ? <span className="chip"><FiClock aria-hidden="true" />{duration}</span> : null}
          {resolution ? <span className="chip"><FiMonitor aria-hidden="true" />{resolution}</span> : null}
          {codecs ? <span className="chip"><FiFilm aria-hidden="true" />{codecs}</span> : null}
          <span className="chip"><FiHardDrive aria-hidden="true" />{formatBytes(movie.size_bytes)}</span>
        </div>
        <p className="movie-detail__path" title={movie.path}>{movie.path}</p>
      </header>

      <section className="movie-detail__scenes" aria-labelledby="movie-scenes-title">
        <div className="section-heading">
          <h2 id="movie-scenes-title">Scene 목록</h2>
          <span>{formatCount(scenes.length)}개</span>
        </div>
        {scenes.length ? (
          <div className="scene-list">
            {scenes.map((scene) => (
              <SceneListItem
                key={scene.id}
                scene={scene}
                retrying={retryScene.isPending && retryScene.variables?.id === scene.id}
                deleting={deleteScene.isPending && deleteScene.variables?.id === scene.id}
                onPlay={(item) => playerRef.current?.playAt(item.timestamp_ms, true)}
                onRetry={(item) => retryScene.mutate(item, { onError: reportError('분석을 다시 시작하지 못했습니다') })}
                onDelete={removeScene}
              />
            ))}
          </div>
        ) : (
          <StatePanel
            kind="empty"
            compact
            icon={<FiCamera aria-hidden="true" />}
            title="아직 Scene이 없습니다"
            description="영상을 재생하다가 원하는 위치에서 S 키를 누르거나 'Scene 생성' 버튼을 누르세요."
          />
        )}
      </section>
    </div>
  )
}
