import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getAiStatus } from '../api/ai'
import { ApiError } from '../api/client'
import { getScenes } from '../api/scenes'
import { aiStatus, explorerScene, scenePage } from './fixtures'
import { renderApp, triggerIntersection } from './render'

vi.mock('../api/movies', () => ({ getMovies: vi.fn(), importMovies: vi.fn(), getPlayableMovie: vi.fn() }))
vi.mock('../api/scenes', () => ({ getScenes: vi.fn() }))

const mockedGetScenes = vi.mocked(getScenes)

describe('Scene 탐색', () => {
  it('lists the latest Scenes and links tiles to their detail page', async () => {
    mockedGetScenes.mockResolvedValue(scenePage([explorerScene({ id: 5, movie_title: '최신 영상' })]))
    renderApp('/scenes')

    const nav = screen.getByRole('navigation', { name: '주요 메뉴' })
    expect(within(nav).getByRole('link', { name: 'Scene 탐색' })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('link', { name: /최신 영상 00:01\.500 Scene 상세/ })).toHaveAttribute('href', '/scenes/5')
    expect(screen.getByText('1개의 Scene')).toBeInTheDocument()
    expect(mockedGetScenes).toHaveBeenCalledWith('', null)
  })

  it('searches from the URL query and hides similarity scores', async () => {
    mockedGetScenes.mockResolvedValue(scenePage([explorerScene({ id: 9, movie_title: '노을 영상' })], { total: 1 }))
    renderApp('/scenes?q=sunset%20over%20the%20ocean')

    expect(await screen.findByRole('heading', { name: '“sunset over the ocean”' })).toBeInTheDocument()
    expect(await screen.findByText('1개의 Scene 검색됨')).toBeInTheDocument()
    expect(mockedGetScenes).toHaveBeenCalledWith('sunset over the ocean', null)
    expect(screen.getByRole('searchbox', { name: 'Scene 검색' })).toHaveValue('sunset over the ocean')
    expect(screen.queryByText(/similarity|유사도 점수/i)).not.toBeInTheDocument()
  })

  it('runs a new search from the global search bar and clears it', async () => {
    const user = userEvent.setup()
    mockedGetScenes.mockResolvedValue(scenePage([]))
    renderApp('/scenes')
    await screen.findByText('아직 생성된 Scene이 없습니다')

    await user.type(screen.getByRole('searchbox', { name: 'Scene 검색' }), '  rainy street  {Enter}')
    expect(await screen.findByText('일치하는 Scene이 없습니다')).toBeInTheDocument()
    expect(mockedGetScenes).toHaveBeenLastCalledWith('rainy street', null)

    await user.click(screen.getByRole('link', { name: /검색 초기화/ }))
    expect(await screen.findByText('아직 생성된 Scene이 없습니다')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/scenes$/)
  })

  it('loads the next cursor page when the sentinel intersects', async () => {
    mockedGetScenes
      .mockResolvedValueOnce(scenePage([explorerScene({ id: 50, movie_title: '첫 Scene' })], { total: 2, next_cursor: 50 }))
      .mockResolvedValueOnce(scenePage([explorerScene({ id: 49, movie_title: '다음 Scene' })], { total: 2 }))
    renderApp('/scenes')
    await screen.findByText('첫 Scene')

    act(() => triggerIntersection())

    expect(await screen.findByText('다음 Scene')).toBeInTheDocument()
    expect(mockedGetScenes).toHaveBeenLastCalledWith('', 50)
  })

  it('explains model warm-up on the first search and reports search errors with retry', async () => {
    const user = userEvent.setup()
    vi.mocked(getAiStatus).mockResolvedValue(aiStatus({ state: 'not_loaded' }))
    let rejectSearch: ((error: Error) => void) | undefined
    mockedGetScenes
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSearch = reject }))
      .mockResolvedValue(scenePage([explorerScene({ movie_title: '재시도 결과' })]))
    renderApp('/scenes?q=blue%20sky')

    expect(await screen.findByText('검색 모델을 준비하고 있습니다')).toBeInTheDocument()
    await act(async () => { rejectSearch?.(new ApiError(503, 'AI 모델을 불러오지 못했습니다')) })

    expect(await screen.findByRole('alert')).toHaveTextContent('AI 모델을 불러오지 못했습니다')
    await user.click(screen.getByRole('button', { name: /다시 시도/ }))
    expect(await screen.findByText('재시도 결과')).toBeInTheDocument()
  })
})
