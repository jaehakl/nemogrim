import type { AiState, JobStatus } from '../api/types'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function isWorking(status: JobStatus): boolean {
  return status === 'pending' || status === 'processing'
}

export const JOB_TONE: Record<JobStatus, Tone> = {
  pending: 'neutral',
  processing: 'info',
  ready: 'success',
  failed: 'danger',
}

export const SCENE_STATUS_LABEL: Record<JobStatus, string> = {
  pending: '분석 대기',
  processing: '분석 중',
  ready: '분석 완료',
  failed: '분석 실패',
}

export const METADATA_STATUS_LABEL: Record<JobStatus, string> = {
  pending: '대기 중',
  processing: '미리보기 생성 중',
  ready: '준비 완료',
  failed: '미리보기 실패',
}

export const AI_STATE_LABEL: Record<AiState, string> = {
  not_loaded: '필요할 때 로드',
  loading: '모델 불러오는 중',
  ready: '준비됨',
  error: '오류',
}

export const AI_STATE_TONE: Record<AiState, Tone> = {
  not_loaded: 'neutral',
  loading: 'info',
  ready: 'success',
  error: 'danger',
}
