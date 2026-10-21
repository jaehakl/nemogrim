import { QueryClient } from '@tanstack/react-query'
import { ApiError, ApiUnavailableError } from '../api/client'

/** API 기동·재시작을 기다리는 최대 재시도 횟수. 지연 1·2·4·5·5…초로 약 30초. */
const UNAVAILABLE_RETRIES = 8

/**
 * API에 닿지 못한 경우(기동 중)는 기다렸다가 재시도한다.
 * 서버가 응답한 오류(4xx/5xx)는 재시도해도 같으므로 재시도하지 않는다.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiUnavailableError) return failureCount < UNAVAILABLE_RETRIES
  return !(error instanceof ApiError) && failureCount < 1
}

export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 5000)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        retryDelay,
      },
      mutations: { retry: false },
    },
  })
}
