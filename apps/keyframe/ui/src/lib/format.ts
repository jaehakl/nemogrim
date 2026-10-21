const pad2 = (value: number) => String(value).padStart(2, '0')

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let amount = value
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  return `${amount.toFixed(unitIndex < 2 || amount >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

/** 영상 길이: `1:02:03` 또는 `2:03`. 알 수 없으면 null. */
export function formatDuration(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null
  const totalSeconds = Math.round(value / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`
}

/** Scene 위치: `01:02.345` 또는 `1:01:02.345`. */
export function formatTimestamp(value: number): string {
  const milliseconds = Math.max(0, Math.round(value))
  const hours = Math.floor(milliseconds / 3_600_000)
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000)
  const seconds = Math.floor((milliseconds % 60_000) / 1000)
  const fraction = String(milliseconds % 1000).padStart(3, '0')
  return `${hours ? `${hours}:` : ''}${pad2(minutes)}:${pad2(seconds)}.${fraction}`
}

export function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export function formatResolution(width: number | null, height: number | null): string | null {
  return width && height ? `${width} × ${height}` : null
}

export function formatCount(value: number): string {
  return value.toLocaleString('ko-KR')
}
