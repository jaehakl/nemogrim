export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: options.body
      ? { 'Content-Type': 'application/json', ...options.headers }
      : options.headers,
  })

  if (!response.ok) {
    let message = `요청에 실패했습니다. (${response.status})`
    try {
      const body = (await response.json()) as { detail?: string }
      message = body.detail || message
    } catch {
      // JSON 오류 본문이 아니면 기본 메시지를 사용한다.
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}
