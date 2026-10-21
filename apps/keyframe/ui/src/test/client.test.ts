import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, ApiUnavailableError, request } from '../api/client'
import { retryDelay, shouldRetryQuery } from '../app/queryClient'

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('API client', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('sends JSON bodies with a content type and parses JSON responses', async () => {
    const fetchMock = mockFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await expect(request('/api/x', { method: 'POST', body: '{}' })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/x', expect.objectContaining({
      headers: { 'Content-Type': 'application/json' },
    }))
  })

  it('resolves 204 responses without parsing a body', async () => {
    mockFetch(new Response(null, { status: 204 }))
    await expect(request('/api/scenes/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('uses string and validation-array details as error messages', async () => {
    mockFetch(new Response(JSON.stringify({ detail: 'Scene을 찾을 수 없습니다' }), { status: 404 }))
    await expect(request('/api/scenes/9')).rejects.toEqual(new ApiError(404, 'Scene을 찾을 수 없습니다'))

    mockFetch(new Response(JSON.stringify({
      detail: [{ msg: 'Input should be greater than or equal to 0' }, { msg: 'Field required' }],
    }), { status: 422 }))
    await expect(request('/api/x')).rejects.toThrow('Input should be greater than or equal to 0 · Field required')
  })

  it('falls back to a status message for non-JSON errors', async () => {
    mockFetch(new Response('Internal Server Error', { status: 500 }))
    const error = await request('/api/x').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(ApiUnavailableError)
    expect(error).toMatchObject({ status: 500, message: '요청에 실패했습니다. (500)' })
  })

  it('distinguishes an unreachable API from a backend 503', async () => {
    mockFetch(new Response(JSON.stringify({ detail: 'API 서버에 연결할 수 없습니다.' }), {
      status: 503,
      headers: { 'X-Keyframe-Upstream': 'unavailable' },
    }))
    await expect(request('/api/x')).rejects.toBeInstanceOf(ApiUnavailableError)

    mockFetch(new Response(JSON.stringify({ detail: 'AI 모델을 불러오지 못했습니다' }), { status: 503 }))
    const backendError = await request('/api/x').catch((caught: unknown) => caught)
    expect(backendError).not.toBeInstanceOf(ApiUnavailableError)
    expect(backendError).toMatchObject({ status: 503, message: 'AI 모델을 불러오지 못했습니다' })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(request('/api/x')).rejects.toBeInstanceOf(ApiUnavailableError)
  })
})

describe('query retry policy', () => {
  it('waits for an unreachable API but does not retry server responses', () => {
    expect(shouldRetryQuery(0, new ApiUnavailableError())).toBe(true)
    expect(shouldRetryQuery(7, new ApiUnavailableError())).toBe(true)
    expect(shouldRetryQuery(8, new ApiUnavailableError())).toBe(false)
    expect(shouldRetryQuery(0, new ApiError(503, 'AI 미준비'))).toBe(false)
    expect(shouldRetryQuery(0, new ApiError(404, '없음'))).toBe(false)
    expect(shouldRetryQuery(0, new Error('unknown'))).toBe(true)
    expect(shouldRetryQuery(1, new Error('unknown'))).toBe(false)
    expect([0, 1, 2, 3, 4].map(retryDelay)).toEqual([1000, 2000, 4000, 5000, 5000])
  })
})
