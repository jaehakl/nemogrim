import { FiArrowLeft, FiClock, FiFilm, FiImage, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ExplorerScene } from '../../api/types'
import { SceneTile } from '../../components/media/SceneTile'
import { SceneVideoPlayer } from '../../components/player/SceneVideoPlayer'
import { LoadMoreSentinel } from '../../components/ui/LoadMoreSentinel'
import { Spinner } from '../../components/ui/Spinner'
import { StatePanel } from '../../components/ui/StatePanel'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useToast } from '../../components/ui/toastContext'
import { usePlayableMovie } from '../../hooks/movies'
import { useCreateScene, useDeleteScene, useScene, useSimilarScenes } from '../../hooks/scenes'
import { errorMessage } from '../../lib/errors'
import { formatCount, formatTimestamp } from '../../lib/format'
import { parseRouteId } from '../../lib/route'
import { isWorking, JOB_TONE, SCENE_STATUS_LABEL } from '../../lib/status'
import './SceneDetailPage.css'

const DELETE_CONFIRMATION = '이 Scene을 삭제할까요? 삭제한 Scene과 snapshot은 복구할 수 없습니다.'

export function SceneDetailPage() {
  const sceneId = parseRouteId(useParams().sceneId)
  const sceneQuery = useScene(sceneId)

  if (sceneQuery.isPending) {
    return <StatePanel kind="loading" title="Scene 상세 정보를 불러오는 중입니다." />
  }
  if (sceneQuery.isError) {
    return (
      <StatePanel
        kind="error"
        title="Scene 상세 정보를 불러오지 못했습니다"
        description={errorMessage(sceneQuery.error)}
        actions={(
          <>
            <Link to="/scenes" className="btn btn--secondary"><FiArrowLeft aria-hidden="true" /> Scene 탐색</Link>
            <button type="button" className="btn btn--secondary" onClick={() => void sceneQuery.refetch()}>
              <FiRefreshCw aria-hidden="true" /> 다시 시도
            </button>
          </>
        )}
      />
    )
  }
  // key: 다른 Scene으로 이동하면 플레이어와 mutation 상태를 새로 시작한다.
  return <SceneDetail key={sceneQuery.data.id} scene={sceneQuery.data} />
}

function SceneDetail({ scene }: { scene: ExplorerScene }) {
  const navigate = useNavigate()
  const notify = useToast()
  const movieQuery = usePlayableMovie(scene.movie_file_id)
  const createScene = useCreateScene(scene.movie_file_id)
  const deleteScene = useDeleteScene()
  const timestamp = formatTimestamp(scene.timestamp_ms)

  const movie = movieQuery.data
  const playbackError = movieQuery.isError
    ? errorMessage(movieQuery.error)
    : movie?.playback_error ?? (movieQuery.isPending ? '영상 재생 정보를 준비하고 있습니다.' : null)

  function remove() {
    if (!window.confirm(DELETE_CONFIRMATION)) return
    deleteScene.mutate(scene, {
      onSuccess: () => navigate(`/movies/${scene.movie_file_id}`),
      onError: (error) => notify({ tone: 'danger', title: 'Scene을 삭제하지 못했습니다', description: errorMessage(error) }),
    })
  }

  function create(timestampMs: number) {
    createScene.mutate(timestampMs, {
      onSuccess: (created) => notify({ tone: 'success', title: `${formatTimestamp(created.timestamp_ms)} 위치에 Scene을 만들었습니다.` }),
      onError: (error) => notify({ tone: 'danger', title: 'Scene을 만들지 못했습니다', description: errorMessage(error) }),
    })
  }

  return (
    <div className="scene-detail">
      <Link to="/scenes" className="back-link"><FiArrowLeft aria-hidden="true" /> Scene 탐색</Link>

      <div className="scene-detail__layout">
        <SceneVideoPlayer
          streamUrl={movie?.stream_url ?? null}
          durationMs={movie?.duration_ms ?? null}
          playbackError={playbackError}
          creating={createScene.isPending}
          onCreateScene={create}
          startAtMs={scene.timestamp_ms}
          autoPlayStart
        />

        <aside className="scene-detail__info" aria-label="Scene 정보">
          <div className="scene-detail__title">
            <h1 className="scene-detail__movie">
              <Link to={`/movies/${scene.movie_file_id}`}>{scene.movie_title}</Link>
            </h1>
            <div className="chip-row">
              <span className="chip"><FiClock aria-hidden="true" />{timestamp}</span>
              <span className="chip"><FiFilm aria-hidden="true" />Scene #{scene.id}</span>
              {scene.analysis_status !== 'ready' ? (
                <StatusBadge
                  tone={JOB_TONE[scene.analysis_status]}
                  label={SCENE_STATUS_LABEL[scene.analysis_status]}
                  busy={isWorking(scene.analysis_status)}
                />
              ) : null}
            </div>
          </div>

          {scene.analysis_status === 'failed' ? (
            <p className="scene-detail__error">{scene.analysis_error || 'Scene 분석에 실패했습니다.'}</p>
          ) : null}

          {scene.keywords?.length ? (
            <div className="scene-detail__keywords">
              <h2>태그</h2>
              <div className="chip-row" aria-label="Scene 태그">
                {scene.keywords.map((keyword) => (
                  <Link key={keyword} className="chip" to={`/scenes?${new URLSearchParams({ q: keyword })}`}>
                    {keyword}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <p className="scene-detail__muted">
              {isWorking(scene.analysis_status) ? 'Scene을 분석하고 있습니다.' : '추출된 태그가 없습니다.'}
            </p>
          )}

          <div className="scene-detail__actions">
            <button type="button" className="btn btn--danger" disabled={deleteScene.isPending} onClick={remove}>
              {deleteScene.isPending ? <Spinner /> : <FiTrash2 aria-hidden="true" />}
              {deleteScene.isPending ? '삭제 중' : 'Scene 삭제'}
            </button>
          </div>
        </aside>
      </div>

      <SimilarScenes scene={scene} />
    </div>
  )
}

function SimilarScenes({ scene }: { scene: ExplorerScene }) {
  const similar = useSimilarScenes(scene)
  const firstPage = similar.data?.pages[0]
  const items = similar.data?.pages.flatMap((page) => page.items) ?? []

  let content
  if (similar.isPending) {
    content = <StatePanel kind="loading" compact title="비슷한 Scene을 찾는 중입니다." />
  } else if (similar.isError) {
    content = (
      <StatePanel
        kind="error"
        compact
        title="비슷한 Scene을 불러오지 못했습니다"
        description={errorMessage(similar.error)}
        actions={(
          <button type="button" className="btn btn--secondary" onClick={() => void similar.refetch()}>
            <FiRefreshCw aria-hidden="true" /> 다시 시도
          </button>
        )}
      />
    )
  } else if (!firstPage?.available) {
    content = (
      <StatePanel
        kind="empty"
        compact
        icon={<FiImage aria-hidden="true" />}
        title="유사도 분석을 사용할 수 없습니다"
        description={scene.analysis_status === 'failed'
          ? '현재 Scene 분석에 실패해 비슷한 Scene을 찾을 수 없습니다.'
          : '현재 Scene 분석이 완료되면 비슷한 Scene을 확인할 수 있습니다.'}
      />
    )
  } else if (items.length === 0) {
    content = (
      <StatePanel
        kind="empty"
        compact
        icon={<FiImage aria-hidden="true" />}
        title="비슷한 Scene이 없습니다"
        description="비교할 수 있는 다른 Scene이 아직 없습니다."
      />
    )
  } else {
    content = (
      <>
        <div className="tile-grid">{items.map((item) => <SceneTile key={item.id} scene={item} />)}</div>
        <LoadMoreSentinel query={similar} itemLabel="Scene" />
      </>
    )
  }

  return (
    <section className="scene-detail__similar" aria-labelledby="similar-scenes-title">
      <div className="section-heading">
        <h2 id="similar-scenes-title">비슷한 Scene</h2>
        {firstPage?.available ? <span>{formatCount(firstPage.total)}개</span> : null}
      </div>
      {content}
    </section>
  )
}
