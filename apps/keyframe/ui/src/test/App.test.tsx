import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { Movie, MoviePage } from '../api/movies'
import { getMovies, getMovieStatuses, importMovieFiles, importMovieFolder } from '../api/movies'

vi.mock('../api/movies', () => ({
  getMovies: vi.fn(),
  getMovieStatuses: vi.fn(),
  importMovieFiles: vi.fn(),
  importMovieFolder: vi.fn(),
  getMovieDetail: vi.fn(),
  prepareMoviePlayback: vi.fn(),
}))

vi.mock('../api/scenes', () => ({
  getMovieScenes: vi.fn().mockResolvedValue({ items: [] }),
  createMovieScene: vi.fn(),
  retryScene: vi.fn(),
}))

const mockedGetMovies = vi.mocked(getMovies)
const mockedGetStatuses = vi.mocked(getMovieStatuses)
const mockedImportFiles = vi.mocked(importMovieFiles)
const mockedImportFolder = vi.mocked(importMovieFolder)

const emptyPage: MoviePage = {
  items: [], total: 0, processing_count: 0, next_cursor: null, has_more: false,
}

function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 1, title: '샘플 영상', path: 'E:\\videos\\샘플 영상.mp4', ext: '.mp4',
    size_bytes: 1024 * 1024, file_modified_at: '2026-07-15T03:00:00Z', duration_ms: 125000,
    width: 1920, height: 1080, fps: 30, metadata_status: 'ready', metadata_error: null,
    thumbnail_url: '/api/movies/1/thumbnail', created_at: '2026-07-15T03:00:00Z',
    updated_at: '2026-07-15T03:00:00Z', ...overrides,
  }
}

function LocationDisplay() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

function renderApp(path = '/movies', withLocation = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {withLocation ? <LocationDisplay /> : null}
      <App />
    </MemoryRouter>,
  )
}

describe('Keyframe movie library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetMovies.mockResolvedValue(emptyPage)
    mockedGetStatuses.mockResolvedValue({ items: [], processing_count: 0 })
  })

  afterEach(() => { vi.useRealTimers() })

  it('redirects the root route to /movies', async () => {
    renderApp('/', true)
    expect(await screen.findByTestId('location')).toHaveTextContent('/movies')
    expect(await screen.findByText('아직 추가된 영상이 없습니다')).toBeInTheDocument()
  })

  it('shows an actionable empty state', async () => {
    renderApp()
    expect(await screen.findByText('아직 추가된 영상이 없습니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '파일 선택' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '폴더 선택' })).toBeEnabled()
  })

  it('imports files, reports the result, and refreshes the first page', async () => {
    const user = userEvent.setup()
    mockedGetMovies.mockResolvedValueOnce(emptyPage).mockResolvedValueOnce({ ...emptyPage, items: [movie()], total: 1 })
    mockedImportFiles.mockResolvedValue({
      cancelled: false, selected_count: 2, added_count: 1, duplicate_count: 1,
      failed_count: 0, added_ids: [1], failures: [],
    })
    renderApp()
    await screen.findByText('아직 추가된 영상이 없습니다')
    await user.click(screen.getByRole('button', { name: /영상 추가/ }))
    await user.click(screen.getByRole('menuitem', { name: /파일 선택/ }))
    expect(await screen.findByText('새 영상 1개 · 중복 1개 · 실패 0개')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '샘플 영상' })).toBeInTheDocument()
    expect(mockedGetMovies).toHaveBeenCalledTimes(2)
  })

  it('loads the next cursor page when the sentinel intersects', async () => {
    mockedGetMovies
      .mockResolvedValueOnce({ items: [movie({ id: 2, title: '최근 영상' })], total: 2, processing_count: 0, next_cursor: 2, has_more: true })
      .mockResolvedValueOnce({ items: [movie({ id: 1, title: '이전 영상' })], total: 2, processing_count: 0, next_cursor: null, has_more: false })
    renderApp()
    await screen.findByRole('heading', { name: '최근 영상' })
    act(() => globalThis.__latestIntersectionObserver?.trigger())
    expect(await screen.findByRole('heading', { name: '이전 영상' })).toBeInTheDocument()
    expect(mockedGetMovies).toHaveBeenLastCalledWith(2)
  })

  it('polls pending cards and replaces them with ready metadata', async () => {
    vi.useFakeTimers()
    mockedGetMovies.mockResolvedValueOnce({
      items: [movie({ metadata_status: 'pending', duration_ms: null, width: null, height: null, thumbnail_url: null })],
      total: 1, processing_count: 1, next_cursor: null, has_more: false,
    })
    mockedGetStatuses.mockResolvedValueOnce({ items: [movie()], processing_count: 0 })
    renderApp()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getAllByText('대기 중').length).toBeGreaterThan(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(screen.getByText('준비 완료')).toBeInTheDocument()
    expect(mockedGetStatuses).toHaveBeenCalledWith([1])
  })

  it('can start folder import from the empty state', async () => {
    const user = userEvent.setup()
    mockedImportFolder.mockResolvedValue({
      cancelled: true, selected_count: 0, added_count: 0, duplicate_count: 0,
      failed_count: 0, added_ids: [], failures: [],
    })
    renderApp()
    await screen.findByText('아직 추가된 영상이 없습니다')
    await user.click(screen.getByRole('button', { name: '폴더 선택' }))
    expect(await screen.findByText('영상 추가를 취소했습니다.')).toBeInTheDocument()
    expect(mockedImportFolder).toHaveBeenCalledOnce()
  })

  it('opens the movie detail route from the full card link', async () => {
    const user = userEvent.setup()
    mockedGetMovies.mockResolvedValueOnce({ ...emptyPage, items: [movie()], total: 1 })
    renderApp('/movies', true)
    await user.click(await screen.findByRole('link', { name: /샘플 영상/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/movies/1')
  })
})
