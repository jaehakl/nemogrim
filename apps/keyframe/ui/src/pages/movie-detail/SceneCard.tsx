import { FiAlertCircle, FiImage, FiLoader, FiPlay, FiRefreshCw } from 'react-icons/fi'
import type { Scene } from '../../api/scenes'
import { formatSceneTimestamp } from './formatters'

const statusText = {
  pending: '분석 대기 중',
  processing: 'Scene 분석 중',
  ready: '분석 완료',
  failed: '분석 실패',
}

interface SceneCardProps {
  scene: Scene
  retrying: boolean
  onPlay: (scene: Scene) => void
  onRetry: (sceneId: number) => void
}

export function SceneCard({ scene, retrying, onPlay, onRetry }: SceneCardProps) {
  const working = scene.analysis_status === 'pending' || scene.analysis_status === 'processing'
  return (
    <article className={`scene-card scene-card--${scene.analysis_status}`}>
      <button type="button" className="scene-card__play" onClick={() => onPlay(scene)}>
        <span className="scene-card__snapshot">
          {scene.snapshot_url ? (
            <img src={scene.snapshot_url} alt={`${formatSceneTimestamp(scene.timestamp_ms)} Scene snapshot`} />
          ) : (
            <span className="scene-card__placeholder">
              {working ? <FiLoader className="scene-card__spinner" aria-hidden="true" />
                : scene.analysis_status === 'failed' ? <FiAlertCircle aria-hidden="true" />
                  : <FiImage aria-hidden="true" />}
            </span>
          )}
          <span className="scene-card__time"><FiPlay aria-hidden="true" />{formatSceneTimestamp(scene.timestamp_ms)}</span>
        </span>
        <span className="scene-card__content">
          <span className={`scene-card__status scene-card__status--${scene.analysis_status}`}>{statusText[scene.analysis_status]}</span>
          <strong>{scene.prompt || (working ? 'Snapshot과 태그를 생성하고 있습니다.' : '추출된 prompt가 없습니다.')}</strong>
        </span>
      </button>
      {scene.analysis_status === 'failed' ? (
        <div className="scene-card__failure">
          <span title={scene.analysis_error || ''}>{scene.analysis_error || 'Scene 분석에 실패했습니다.'}</span>
          <button type="button" disabled={retrying} onClick={() => onRetry(scene.id)}>
            {retrying ? <FiLoader className="scene-card__spinner" /> : <FiRefreshCw />}
            재시도
          </button>
        </div>
      ) : null}
    </article>
  )
}
