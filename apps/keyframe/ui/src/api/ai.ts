import { request } from './client'
import type { AiStatus } from './types'

export function getAiStatus(): Promise<AiStatus> {
  return request('/api/ai/status')
}

export function warmupAi(): Promise<AiStatus> {
  return request('/api/ai/warmup', { method: 'POST' })
}
