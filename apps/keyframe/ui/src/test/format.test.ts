import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, formatResolution, formatTimestamp } from '../lib/format'

describe('formatters', () => {
  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536 * 1024)).toBe('1.5 MB')
    expect(formatBytes(300 * 1024 * 1024)).toBe('300 MB')
    expect(formatBytes(-1)).toBe('—')
  })

  it('formats movie durations and returns null when unknown', () => {
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(3_723_000)).toBe('1:02:03')
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(0)).toBeNull()
  })

  it('formats Scene timestamps with milliseconds', () => {
    expect(formatTimestamp(1_500)).toBe('00:01.500')
    expect(formatTimestamp(3_661_007)).toBe('1:01:01.007')
    expect(formatTimestamp(-5)).toBe('00:00.000')
  })

  it('formats resolutions only when both dimensions are known', () => {
    expect(formatResolution(1920, 1080)).toBe('1920 × 1080')
    expect(formatResolution(null, 1080)).toBeNull()
  })
})
