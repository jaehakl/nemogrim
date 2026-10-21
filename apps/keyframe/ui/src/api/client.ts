export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** API 서버에 닿지 못함(아직 기동 중이거나 재시작 중). 백엔드가 보낸 503(AI 미준비 등)과 구분한다. */
export class ApiUnavailableError extends ApiError {
  constructor(message = 'API 서버에 연결할 수 없습니다.') {
    super(503, message)
    this.name = 'ApiUnavailableError'
  }
}

/** 개발 서버 프록시가 API에 연결하지 못했을 때 붙이는 헤더 (vite.config.ts). */
const UPSTREAM_HEADER = 'X-Keyframe-Upstream'

/** FastAPI의 `detail`은 문자열이거나(도메인 오류) 검증 오류 배열이다. */
function detailMessage(detail: unknown): string | null {
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item?.msg === 'string' ? item.msg : null))
      .filter((message): message is string => Boolean(message))
    return messages.length ? messages.join(' · ') : null
  }
  return null
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      headers: options.body
        ? { 'Content-Type': 'application/json', ...options.headers }
        : options.headers,
    })
  } catch {
    throw new ApiUnavailableError()
  }

  if (!response.ok) {
    let message = `요청에 실패했습니다. (${response.status})`
    try {
      const body = (await response.json()) as { detail?: unknown }
      message = detailMessage(body.detail) ?? message
    } catch {
      // JSON 오류 본문이 아니면 기본 메시지를 사용한다.
    }
    if (response.headers.get(UPSTREAM_HEADER) === 'unavailable') throw new ApiUnavailableError(message)
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
