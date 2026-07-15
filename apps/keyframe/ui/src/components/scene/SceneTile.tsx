import { FiAlertCircle, FiImage, FiLoader } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import type { ExplorerScene } from '../../api/scenes'
import { formatSceneTimestamp } from '../../pages/movie-detail/formatters'
import './SceneTile.css'

const statusText = {
  pending: '분석 대기 중',
  processing: '분석 중',
  ready: '분석 완료',
  failed: '분석 실패',
}

export function SceneTile({ scene }: { scene: ExplorerScene }) {
  const working = scene.analysis_status === 'pending' || scene.analysis_status === 'processing'
  return (
    <Link
      to={`/scenes/${scene.id}`}
      className={`explorer-tile explorer-tile--${scene.analysis_status}`}
      aria-label={`${scene.movie_title} ${formatSceneTimestamp(scene.timestamp_ms)} Scene 상세`}
    >
      <span className="explorer-tile__snapshot">
        {scene.snapshot_url ? (
          <img src={scene.snapshot_url} alt={`${scene.movie_title} Scene snapshot`} />
        ) : (
          <span className="explorer-tile__placeholder">
            {working ? <FiLoader aria-hidden="true" />
              : scene.analysis_status === 'failed' ? <FiAlertCircle aria-hidden="true" />
                : <FiImage aria-hidden="true" />}
          </span>
        )}
        <span className="explorer-tile__time">{formatSceneTimestamp(scene.timestamp_ms)}</span>
      </span>
      <span className="explorer-tile__content">
        <span className="explorer-tile__meta">
          <span className={`explorer-tile__status explorer-tile__status--${scene.analysis_status}`}>
            {statusText[scene.analysis_status]}
          </span>
          <span title={scene.movie_title}>{scene.movie_title}</span>
        </span>
        <span className="explorer-tile__prompt">
          {scene.prompt || (working ? 'Scene을 분석하고 있습니다.' : '추출된 prompt가 없습니다.')}
        </span>
        {scene.analysis_status === 'failed' ? (
          <small title={scene.analysis_error || ''}>{scene.analysis_error || 'Scene 분석에 실패했습니다.'}</small>
        ) : null}
      </span>
    </Link>
  )
}
