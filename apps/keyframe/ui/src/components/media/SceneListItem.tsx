import { FiAlertCircle, FiExternalLink, FiImage, FiPlay, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import type { Scene } from '../../api/types'
import { formatTimestamp } from '../../lib/format'
import { isWorking, JOB_TONE, SCENE_STATUS_LABEL } from '../../lib/status'
import { Spinner } from '../ui/Spinner'
import { StatusBadge } from '../ui/StatusBadge'
import './media.css'

interface SceneListItemProps {
  scene: Scene
  retrying: boolean
  deleting: boolean
  onPlay: (scene: Scene) => void
  onRetry: (scene: Scene) => void
  onDelete: (scene: Scene) => void
}

/** 영상 상세 페이지의 Scene 목록 항목. 누르면 해당 위치부터 재생한다. */
export function SceneListItem({ scene, retrying, deleting, onPlay, onRetry, onDelete }: SceneListItemProps) {
  const working = isWorking(scene.analysis_status)
  const failed = scene.analysis_status === 'failed'
  const timestamp = formatTimestamp(scene.timestamp_ms)
  const busy = retrying || deleting

  return (
    <article className={`scene-item${failed ? ' scene-item--failed' : ''}`}>
      <button type="button" className="scene-item__play" onClick={() => onPlay(scene)} aria-label={`${timestamp} 위치 재생`}>
        <span className="scene-item__thumb">
          {scene.snapshot_url ? (
            <img src={scene.snapshot_url} alt="" loading="lazy" />
          ) : (
            <span className="media-card__placeholder">
              {working ? <Spinner /> : failed ? <FiAlertCircle aria-hidden="true" /> : <FiImage aria-hidden="true" />}
            </span>
          )}
          <span className="scene-item__overlay" aria-hidden="true"><FiPlay /></span>
        </span>
      </button>
      <div className="scene-item__body">
        <div className="scene-item__heading">
          <strong className="scene-item__time">{timestamp}</strong>
          <StatusBadge
            tone={JOB_TONE[scene.analysis_status]}
            label={SCENE_STATUS_LABEL[scene.analysis_status]}
            busy={working}
          />
        </div>
        <p className="scene-item__caption" title={scene.prompt ?? undefined}>
          {failed
            ? scene.analysis_error || 'Scene 분석에 실패했습니다.'
            : scene.prompt || (working ? 'Snapshot과 태그를 만들고 있습니다.' : '추출된 태그가 없습니다.')}
        </p>
        <div className="scene-item__actions">
          {scene.analysis_status === 'ready' ? (
            <Link className="btn btn--ghost btn--sm" to={`/scenes/${scene.id}`}>
              <FiExternalLink aria-hidden="true" /> 상세
            </Link>
          ) : null}
          {failed ? (
            <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={() => onRetry(scene)}>
              {retrying ? <Spinner /> : <FiRefreshCw aria-hidden="true" />} 재시도
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost btn--sm scene-item__delete"
            disabled={busy}
            aria-label={`Scene #${scene.id} 삭제`}
            onClick={() => onDelete(scene)}
          >
            {deleting ? <Spinner /> : <FiTrash2 aria-hidden="true" />}
            {deleting ? '삭제 중' : '삭제'}
          </button>
        </div>
      </div>
    </article>
  )
}
