import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { getAiStatus, warmupAi } from '../api/ai'
import { aiStatus } from './fixtures'

// 모든 화면은 사이드바에서 AI 상태를 조회한다. 개별 테스트가 필요하면 덮어쓴다.
vi.mock('../api/ai', () => ({ getAiStatus: vi.fn(), warmupAi: vi.fn() }))

declare global {
  var __latestIntersectionObserver: MockIntersectionObserver | undefined
}

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = [0]
  private target?: Element

  constructor(private callback: IntersectionObserverCallback) {
    globalThis.__latestIntersectionObserver = this
  }

  observe(target: Element) { this.target = target }
  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
  trigger(isIntersecting = true) {
    this.callback([{ isIntersecting, target: this.target } as IntersectionObserverEntry], this)
  }
}

globalThis.IntersectionObserver = MockIntersectionObserver

beforeEach(() => {
  vi.mocked(getAiStatus).mockResolvedValue(aiStatus())
  vi.mocked(warmupAi).mockResolvedValue(aiStatus({ state: 'loading' }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.localStorage.clear()
  delete globalThis.__latestIntersectionObserver
})
