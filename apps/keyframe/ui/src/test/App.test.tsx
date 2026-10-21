import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { warmupAi, getAiStatus } from '../api/ai'
import { getMovies, importMovies } from '../api/movies'
import { aiStatus, movie, moviePage } from './fixtures'
import { renderApp, triggerIntersection } from './render'

vi.mock('../api/movies', () => ({
  getMovies: vi.fn(),
  importMovies: vi.fn(),
  getPlayableMovie: vi.fn(),
}))

vi.mock('../api/scenes', () => ({
  getScenes: vi.fn().mockResolvedValue({ items: [], total: 0, next_cursor: null }),
}))

const mockedGetMovies = vi.mocked(getMovies)
const mockedImport = vi.mocked(importMovies)

describe('영상 라이브러리', () => {
  it('redirects the root route to /movies and shows an actionable empty state', async () => {
    mockedGetMovies.mockResolvedValue(moviePage([]))
    renderApp('/')

    expect(await screen.findByRole('heading', { name: '아직 추가된 영상이 없습니다' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/movies')
    expect(screen.getByRole('button', { name: /파일 선택/ })).toBeEnabled()
  })

  it('imports files, reports the result in a toast and refreshes the list', async () => {
    const user = userEvent.setup()
    mockedGetMovies
      .mockResolvedValueOnce(moviePage([]))
      .mockResolvedValue(moviePage([movie({ id: 1, title: '새 영상' })]))
    mockedImport.mockResolvedValue({
      cancelled: false, selected_count: 1, added_count: 1, duplicate_count: 0,
      failed_count: 0, added_ids: [1], failures: [],
    })
    renderApp('/movies')

    await user.click(await screen.findByRole('button', { name: /영상 추가/ }))
    await user.click(screen.getByRole('menuitem', { name: /파일 선택/ }))

    expect(mockedImport).toHaveBeenCalledWith('files', expect.anything())
    expect(await screen.findByText('새 영상 1개 · 중복 0개 · 실패 0개')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: '새 영상 상세 보기' })).toHaveAttribute('href', '/movies/1')
  })

  it('starts folder import from the empty state and reports cancellation', async () => {
    const user = userEvent.setup()
    mockedGetMovies.mockResolvedValue(moviePage([]))
    mockedImport.mockResolvedValue({
      cancelled: true, selected_count: 0, added_count: 0, duplicate_count: 0,
      failed_count: 0, added_ids: [], failures: [],
    })
    renderApp('/movies')

    await user.click(await screen.findByRole('button', { name: /폴더 선택/ }))

    expect(mockedImport).toHaveBeenCalledWith('folder', expect.anything())
    expect(await screen.findByText('영상 추가를 취소했습니다.')).toBeInTheDocument()
    expect(mockedGetMovies).toHaveBeenCalledTimes(1)
  })

  it('loads the next cursor page when the sentinel intersects', async () => {
    mockedGetMovies
      .mockResolvedValueOnce(moviePage([movie({ id: 30, title: '첫 페이지' })], { total: 2, next_cursor: 30 }))
      .mockResolvedValueOnce(moviePage([movie({ id: 29, title: '둘째 페이지' })], { total: 2 }))
    renderApp('/movies')

    await screen.findByText('첫 페이지')
    act(() => triggerIntersection())

    expect(await screen.findByText('둘째 페이지')).toBeInTheDocument()
    expect(mockedGetMovies).toHaveBeenLastCalledWith(30)
    expect(await screen.findByText('모든 영상을 불러왔습니다.')).toBeInTheDocument()
  })

  it('polls while previews are processing and shows the finished card', async () => {
    mockedGetMovies
      .mockResolvedValueOnce(moviePage(
        [movie({ id: 3, title: '처리 중', metadata_status: 'processing', thumbnail_url: null })],
        { processing_count: 1 },
      ))
      .mockResolvedValue(moviePage([movie({ id: 3, title: '처리 중' })]))
    renderApp('/movies')

    expect(await screen.findByText('1개 미리보기 처리 중')).toBeInTheDocument()
    expect(await screen.findByText('모든 작업 완료', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument()
  })

  it('shows a retryable error when the library cannot be loaded', async () => {
    const user = userEvent.setup()
    mockedGetMovies.mockRejectedValueOnce(new Error('API offline')).mockResolvedValue(moviePage([]))
    renderApp('/movies')

    expect(await screen.findByRole('alert')).toHaveTextContent('API offline')
    await user.click(screen.getByRole('button', { name: /다시 시도/ }))
    expect(await screen.findByText('아직 추가된 영상이 없습니다')).toBeInTheDocument()
  })
})

describe('앱 레이아웃', () => {
  it('collapses the sidebar and remembers the choice', async () => {
    const user = userEvent.setup()
    mockedGetMovies.mockResolvedValue(moviePage([]))
    const view = renderApp('/movies')

    const toggle = await screen.findByRole('button', { name: '사이드바 접기' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: '사이드바 펼치기' })).toHaveAttribute('aria-expanded', 'false')
    expect(window.localStorage.getItem('keyframe.sidebar.collapsed')).toBe('1')

    view.unmount()
    renderApp('/movies')
    expect(await screen.findByRole('button', { name: '사이드바 펼치기' })).toBeInTheDocument()
  })

  it('marks the active navigation item and shows a 404 page for unknown routes', async () => {
    mockedGetMovies.mockResolvedValue(moviePage([]))
    renderApp('/does-not-exist')

    expect(await screen.findByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' })
    expect(within(nav).getByRole('link', { name: 'Scene 탐색' })).not.toHaveAttribute('aria-current')
  })

  it('submits the global search to the Scene explorer and focuses it with /', async () => {
    const user = userEvent.setup()
    mockedGetMovies.mockResolvedValue(moviePage([]))
    renderApp('/movies')

    const input = await screen.findByRole('searchbox', { name: 'Scene 검색' })
    await user.keyboard('/')
    expect(input).toHaveFocus()
    await user.keyboard('sunset beach{Enter}')

    expect(screen.getByTestId('location')).toHaveTextContent('/scenes?q=sunset+beach')
    expect(input).toHaveValue('sunset beach')
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/scenes$/)
  })

  it('shows the local AI device and warms models up on demand', async () => {
    const user = userEvent.setup()
    mockedGetMovies.mockResolvedValue(moviePage([]))
    vi.mocked(getAiStatus)
      .mockResolvedValueOnce(aiStatus())
      .mockResolvedValue(aiStatus({ state: 'loading' }))
    renderApp('/movies')

    const status = await screen.findByRole('region', { name: '로컬 AI 상태' })
    expect(await within(status).findByText('GPU · NVIDIA GeForce RTX 3090 Ti')).toBeInTheDocument()
    await user.click(within(status).getByRole('button', { name: /모델 미리 불러오기/ }))

    expect(warmupAi).toHaveBeenCalledOnce()
    expect(await within(status).findByText('로컬 AI · 모델 불러오는 중')).toBeInTheDocument()
  })

  it('reports model errors in the AI status', async () => {
    mockedGetMovies.mockResolvedValue(moviePage([]))
    vi.mocked(getAiStatus).mockResolvedValue(aiStatus({ state: 'error', note: null }))
    renderApp('/movies')

    const status = await screen.findByRole('region', { name: '로컬 AI 상태' })
    await waitFor(() => expect(within(status).getByText('로컬 AI · 오류')).toBeInTheDocument())
    expect(within(status).getByRole('button', { name: /다시 불러오기/ })).toBeInTheDocument()
  })
})
