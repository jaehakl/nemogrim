import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

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

afterEach(() => {
  cleanup()
  delete globalThis.__latestIntersectionObserver
})
