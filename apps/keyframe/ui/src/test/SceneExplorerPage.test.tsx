import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { ExplorerScene, ScenePage } from '../api/scenes'
import { getScenes } from '../api/scenes'

vi.mock('../api/movies', () => ({
  getMovies: vi.fn(),
  getMovieStatuses: vi.fn(),
  importMovieFiles: vi.fn(),
  importMovieFolder: vi.fn(),
  getMovieDetail: vi.fn(),
  prepareMoviePlayback: vi.fn(),
}))

vi.mock('../api/scenes', () => ({
  getScenes: vi.fn(),
  getScene: vi.fn(),
  getSimilarScenes: vi.fn(),
  getMovieScenes: vi.fn(),
  createMovieScene: vi.fn(),
  deleteScene: vi.fn(),
  retryScene: vi.fn(),
}))

const mockedGetScenes = vi.mocked(getScenes)

function scene(overrides: Partial<ExplorerScene> = {}): ExplorerScene {
  return {
    id: 1,
    movie_file_id: 7,
    movie_title: 'Scene 테스트 영상',
    timestamp_ms: 12_345,
    prompt: 'blue sky, ocean',
    keywords: ['blue sky', 'ocean'],
    embedding_model: 'OpenAI CLIP ViT-L/14',
    prompt_model: 'SmilingWolf/wd-eva02-large-tagger-v3',
    analysis_status: 'ready',
    analysis_error: null,
    snapshot_url: '/api/scenes/1/snapshot',
    created_at: '2026-07-15T03:00:00Z',
    updated_at: '2026-07-15T03:00:00Z',
    ...overrides,
  }
}

function page(items: ExplorerScene[] = [], overrides: Partial<ScenePage> = {}): ScenePage {
  return {
    items,
    total: items.length,
    next_offset: null,
    has_more: false,
    ...overrides,
  }
}

function renderExplorer() {
  return render(<MemoryRouter initialEntries={['/scenes']}><App /></MemoryRouter>)
}

describe('Scene explorer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetScenes.mockResolvedValue(page())
  })

  it('opens from the active sidebar route and links Scene tiles to their detail page', async () => {
    mockedGetScenes.mockResolvedValueOnce(page([scene()]))
    renderExplorer()

    expect(await screen.findByRole('heading', { name: 'Scene 탐색' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Scene 탐색' })).toHaveClass('nav-item--active')
    expect(await screen.findByText('Scene 테스트 영상')).toBeInTheDocument()
    expect(screen.getByText('00:12.345')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Scene 테스트 영상/ })).toHaveAttribute('href', '/scenes/1')
    expect(mockedGetScenes).toHaveBeenCalledWith('', 0)
  })

  it('searches only when the form is submitted and hides similarity scores', async () => {
    const user = userEvent.setup()
    mockedGetScenes
      .mockResolvedValueOnce(page([scene()]))
      .mockResolvedValueOnce(page([scene({ id: 2, prompt: 'sunset over the ocean' })]))
    renderExplorer()
    await screen.findByText('Scene 테스트 영상')

    await user.type(screen.getByLabelText('Scene 검색어'), '  sunset  ')
    expect(mockedGetScenes).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(mockedGetScenes).toHaveBeenLastCalledWith('sunset', 0))
    expect(await screen.findByText('“sunset” 검색 결과')).toBeInTheDocument()
    expect(screen.queryByText(/similarity|일치도/i)).not.toBeInTheDocument()
  })

  it('loads the next offset page when the sentinel intersects', async () => {
    mockedGetScenes
      .mockResolvedValueOnce(page([scene({ id: 2 })], { total: 2, next_offset: 48, has_more: true }))
      .mockResolvedValueOnce(page([scene({ id: 1, movie_title: '이전 Scene 영상' })], { total: 2 }))
    renderExplorer()
    await screen.findByText('Scene 테스트 영상')

    act(() => globalThis.__latestIntersectionObserver?.trigger())
    expect(await screen.findByText('이전 Scene 영상')).toBeInTheDocument()
    expect(mockedGetScenes).toHaveBeenLastCalledWith('', 48)
  })

  it('clears a submitted search and reloads the default list', async () => {
    const user = userEvent.setup()
    mockedGetScenes
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(page([scene()]))
    renderExplorer()
    await screen.findByText('아직 생성된 Scene이 없습니다')

    await user.type(screen.getByLabelText('Scene 검색어'), 'ocean')
    await user.click(screen.getByRole('button', { name: '검색' }))
    expect(await screen.findByText('일치하는 Scene이 없습니다')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '검색 초기화' }))

    expect(await screen.findByText('Scene 테스트 영상')).toBeInTheDocument()
    expect(screen.getByLabelText('Scene 검색어')).toHaveValue('')
    expect(mockedGetScenes).toHaveBeenLastCalledWith('', 0)
  })

  it('shows search errors and retries the submitted query', async () => {
    const user = userEvent.setup()
    mockedGetScenes
      .mockResolvedValueOnce(page())
      .mockRejectedValueOnce(new Error('CLIP model load failure'))
      .mockResolvedValueOnce(page([scene()]))
    renderExplorer()
    await screen.findByText('아직 생성된 Scene이 없습니다')

    await user.type(screen.getByLabelText('Scene 검색어'), 'ocean')
    await user.click(screen.getByRole('button', { name: '검색' }))
    expect(await screen.findByText('Scene 검색을 완료하지 못했습니다')).toBeInTheDocument()
    expect(screen.getByText('CLIP model load failure')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('Scene 테스트 영상')).toBeInTheDocument()
    expect(mockedGetScenes).toHaveBeenLastCalledWith('ocean', 0)
  })
})
