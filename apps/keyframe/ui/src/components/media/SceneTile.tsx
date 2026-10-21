import { FiAlertCircle, FiImage } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import type { ExplorerScene } from '../../api/types'
import { formatTimestamp } from '../../lib/format'
import { isWorking, JOB_TONE, SCENE_STATUS_LABEL } from '../../lib/status'
import { Spinner } from '../ui/Spinner'
import { StatusBadge } from '../ui/StatusBadge'
import './media.css'

export function SceneTile({ scene }: { scene: ExplorerScene }) {
  const working = isWorking(scene.analysis_status)
  const timestamp = formatTimestamp(scene.timestamp_ms)
  const caption = scene.prompt
    || (working ? 'Scene을 분석하고 있습니다.' : scene.analysis_error || '추출된 태그가 없습니다.')

  return (
    <Link className="media-card media-card--tile" to={`/scenes/${scene.id}`} aria-label={`${scene.movie_title} ${timestamp} Scene 상세`}>
      <div className="media-card__poster">
        {scene.snapshot_url ? (
          <img src={scene.snapshot_url} alt="" loading="lazy" />
        ) : (
          <div className="media-card__placeholder">
            {working ? <Spinner /> : scene.analysis_status === 'failed' ? <FiAlertCircle aria-hidden="true" /> : <FiImage aria-hidden="true" />}
          </div>
        )}
        <span className="media-card__badge media-card__badge--end">{timestamp}</span>
      </div>
      <div className="media-card__body">
        <p className="media-card__eyebrow" title={scene.movie_title}>{scene.movie_title}</p>
        <p className="media-card__caption" title={caption}>{caption}</p>
        {scene.analysis_status !== 'ready' ? (
          <StatusBadge
            tone={JOB_TONE[scene.analysis_status]}
            label={SCENE_STATUS_LABEL[scene.analysis_status]}
            busy={working}
          />
        ) : null}
      </div>
    </Link>
  )
}
