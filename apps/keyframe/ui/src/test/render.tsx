import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from '../App'
import { ToastProvider } from '../components/ui/Toast'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

/** 현재 경로를 화면에 노출해 이동 결과를 검증할 수 있게 한다. */
function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

export function renderWithProviders(ui: ReactElement, route = '/') {
  const queryClient = createTestQueryClient()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ToastProvider>
          {ui}
          <LocationProbe />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

export function renderApp(route = '/') {
  return renderWithProviders(<App />, route)
}

export function triggerIntersection() {
  const observer = globalThis.__latestIntersectionObserver
  if (!observer) throw new Error('관찰 중인 IntersectionObserver가 없습니다')
  observer.trigger()
}
