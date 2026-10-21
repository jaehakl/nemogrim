import { FiCpu, FiDownloadCloud } from 'react-icons/fi'
import { useAiStatus, useWarmupAi } from '../../hooks/ai'
import { AI_STATE_LABEL } from '../../lib/status'
import { Spinner } from '../ui/Spinner'

/** 사이드바 하단의 로컬 AI 상태. 모델이 준비되지 않았으면 미리 불러올 수 있다. */
export function AiStatusIndicator({ compact = false }: { compact?: boolean }) {
  const status = useAiStatus()
  const warmup = useWarmupAi()
  const data = status.data

  const state = status.isError ? 'error' : data?.state
  const label = status.isError
    ? 'API에 연결할 수 없음'
    : state ? AI_STATE_LABEL[state] : '확인 중'
  const device = data?.device
    ? data.device.startsWith('cuda') ? `GPU · ${data.device_name}` : 'CPU'
    : null
  const errors = data
    ? [data.note, data.models.clip.error, data.models.tagger.error].filter(Boolean).join('\n')
    : ''
  const details = [`로컬 AI: ${label}`, device, errors].filter(Boolean).join('\n')
  const canWarmup = data && (data.state === 'not_loaded' || data.state === 'error')

  return (
    <section className={`ai-status ai-status--${state ?? 'unknown'}`} aria-label="로컬 AI 상태" title={details}>
      <span className="ai-status__icon" aria-hidden="true">
        {state === 'loading' ? <Spinner /> : <FiCpu />}
        <span className="ai-status__dot" />
      </span>
      {compact ? (
        <span className="sr-only">{details}</span>
      ) : (
        <div className="ai-status__body">
          <strong>로컬 AI · {label}</strong>
          <small>{device ?? '실행 장치 확인 중'}</small>
          {canWarmup ? (
            <button
              type="button"
              className="ai-status__action"
              disabled={warmup.isPending}
              onClick={() => warmup.mutate()}
            >
              <FiDownloadCloud aria-hidden="true" />
              {data.state === 'error' ? '다시 불러오기' : '모델 미리 불러오기'}
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}
