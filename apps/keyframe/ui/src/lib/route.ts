/** URL 경로의 숫자 id. 양의 정수가 아니면 null. */
export function parseRouteId(value: string | undefined): number | null {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}
