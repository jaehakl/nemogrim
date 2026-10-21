import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPlayableMovie } from '../api/movies'
import { createMovieScene, deleteScene, getMovieScenes, getScene, getSimilarScenes } from '../api/scenes'
import type { Scene } from '../api/types'
import { explorerScene, movieDetail, scene, similarPage } from './fixtures'
import { renderApp, triggerIntersection } from './render'

vi.mock('../api/movies', () => ({ getMovies: vi.fn(), importMovies: vi.fn(), getPlayableMovie: vi.fn() }))
vi.mock('../api/scenes', () => ({
  getScenes: vi.fn(),
  getScene: vi.fn(),
  getSimilarScenes: vi.fn(),
  getMovieScenes: vi.fn(),
  createMovieScene: vi.fn(),
  deleteScene: vi.fn(),
  retryScene: vi.fn(),
}))

const mockedGetScene = vi.mocked(getScene)
const mockedGetMovie = vi.mocked(getPlayableMovie)
const mockedGetSimilar = vi.mocked(getSimilarScenes)
const mockedCreateScene = vi.mocked(createMovieScene)
const mockedDeleteScene = vi.mocked(deleteScene)

const current = explorerScene({ timestamp_ms: 12_345, movie_title: 'Scene 상세 영상', keywords: ['blue sky', 'ocean'] })

async function renderDetail() {
  renderApp('/scenes/21')
  await screen.findByRole('heading', { name: 'Scene 상세 영상', level: 1 })
}

async function preparePlayer(play = vi.fn().mockResolvedValue(undefined)) {
  await waitFor(() => expect(document.querySelector('video')).not.toBeNull())
  const player = document.querySelector('video') as HTMLVideoElement
  Object.defineProperty(player, 'play', { configurable: true, value: play })
  Object.defineProperty(player, 'duration', { configurable: true, value: 600 })
  return player
}

describe('Scene 상세', () => {
  beforeEach(() => {
    mockedGetScene.mockResolvedValue(current)
    mockedGetMovie.mockResolvedValue(movieDetail())
    mockedGetSimilar.mockResolvedValue(similarPage([]))
    mockedCreateScene.mockResolvedValue(scene({ id: 40, timestamp_ms: 45_678 }))
    mockedDeleteScene.mockResolvedValue(undefined)
    vi.mocked(getMovieScenes).mockResolvedValue([])
    Element.prototype.scrollIntoView = vi.fn()
    window.confirm = vi.fn(() => true)
  })

  it('loads Scene context and starts playback at the Scene timestamp', async () => {
    mockedGetSimilar.mockResolvedValue(similarPage([explorerScene({ id: 22, movie_title: '비슷한 영상' })]))
    await renderDetail()

    expect(screen.getByText('00:12.345', { selector: '.chip' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'blue sky' })).toHaveAttribute('href', '/scenes?q=blue+sky')
    const player = await preparePlayer()
    fireEvent.loadedMetadata(player)

    expect(player.currentTime).toBe(12.345)
    expect(player.play).toHaveBeenCalledOnce()
    expect(await screen.findByRole('link', { name: /비슷한 영상/ })).toHaveAttribute('href', '/scenes/22')
    expect(mockedGetScene).toHaveBeenCalledWith(21)
    expect(mockedGetSimilar).toHaveBeenCalledWith(21, null)
    expect(mockedGetMovie).toHaveBeenCalledWith(7)
  })

  it('keeps the requested position when autoplay is rejected', async () => {
    await renderDetail()
    const player = await preparePlayer(vi.fn().mockRejectedValueOnce(new Error('autoplay blocked')))
    fireEvent.loadedMetadata(player)
    await act(async () => { await Promise.resolve() })

    expect(player.currentTime).toBe(12.345)
  })

  it('keeps Scene information and similar results visible when playback is unavailable', async () => {
    mockedGetMovie.mockResolvedValue(movieDetail({
      playback_status: 'failed',
      playback_error: '브라우저에서 직접 재생할 수 없는 영상 codec입니다',
      stream_url: null,
    }))
    mockedGetSimilar.mockResolvedValue(similarPage([explorerScene({ id: 22, movie_title: '비슷한 영상' })]))
    await renderDetail()

    expect(await screen.findByText('브라우저에서 직접 재생할 수 없는 영상 codec입니다')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ocean' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /비슷한 영상/ })).toBeInTheDocument()
  })

  it('creates a Scene from the player without leaving or reloading the page', async () => {
    const user = userEvent.setup()
    await renderDetail()
    const player = await preparePlayer()
    player.currentTime = 45.678
    fireEvent.timeUpdate(player)

    await user.click(screen.getByRole('button', { name: '현재 위치에 Scene 생성' }))

    await waitFor(() => expect(mockedCreateScene).toHaveBeenCalledWith(7, 45_678))
    expect(await screen.findByText('00:45.678 위치에 Scene을 만들었습니다.')).toBeInTheDocument()
    expect(mockedGetScene).toHaveBeenCalledTimes(1)
    expect(mockedGetSimilar).toHaveBeenCalledTimes(1)
    expect(player.currentTime).toBe(45.678)
  })

  it('disables creation while pending and reports server errors', async () => {
    const user = userEvent.setup()
    let resolveCreate: ((created: Scene) => void) | undefined
    mockedCreateScene.mockImplementationOnce(() => new Promise((resolve) => { resolveCreate = resolve }))
    await renderDetail()

    await user.click(screen.getByRole('button', { name: '현재 위치에 Scene 생성' }))
    expect(await screen.findByRole('button', { name: 'Scene 등록 중' })).toBeDisabled()
    await act(async () => { resolveCreate?.(scene()) })

    mockedCreateScene.mockRejectedValueOnce(new Error('같은 timestamp의 Scene이 이미 있습니다.'))
    await user.click(screen.getByRole('button', { name: '현재 위치에 Scene 생성' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('같은 timestamp의 Scene이 이미 있습니다.')
  })

  it('confirms deletion and returns to the owning movie', async () => {
    const user = userEvent.setup()
    vi.mocked(window.confirm).mockReturnValueOnce(false).mockReturnValueOnce(true)
    await renderDetail()
    const deleteButton = screen.getByRole('button', { name: 'Scene 삭제' })

    await user.click(deleteButton)
    expect(mockedDeleteScene).not.toHaveBeenCalled()

    await user.click(deleteButton)
    await waitFor(() => expect(mockedDeleteScene).toHaveBeenCalledWith(21))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/movies/7'))
  })

  it('keeps Scene detail visible and reports a delete failure', async () => {
    const user = userEvent.setup()
    let rejectDelete: ((error: Error) => void) | undefined
    mockedDeleteScene.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectDelete = reject }))
    await renderDetail()

    await user.click(screen.getByRole('button', { name: 'Scene 삭제' }))
    expect(await screen.findByRole('button', { name: '삭제 중' })).toBeDisabled()
    await act(async () => { rejectDelete?.(new Error('Scene 삭제 실패')) })

    expect(await screen.findByRole('alert')).toHaveTextContent('Scene 삭제 실패')
    expect(screen.getByRole('button', { name: 'Scene 삭제' })).toBeEnabled()
    expect(screen.getByTestId('location')).toHaveTextContent('/scenes/21')
  })

  it('loads more similar Scenes and navigates between Scene detail routes', async () => {
    const user = userEvent.setup()
    mockedGetScene.mockImplementation(async (id) =>
      id === 22 ? explorerScene({ id: 22, movie_title: '이동한 Scene 영상', timestamp_ms: 30_000 }) : current)
    mockedGetSimilar.mockImplementation(async (id, cursor) => {
      if (id === 22) return similarPage([])
      return cursor === null
        ? similarPage([explorerScene({ id: 22, movie_title: '비슷한 첫 영상' })], { total: 2, next_cursor: 24 })
        : similarPage([explorerScene({ id: 23, movie_title: '비슷한 다음 영상' })], { total: 2 })
    })
    await renderDetail()
    await screen.findByText('비슷한 첫 영상')

    act(() => triggerIntersection())
    expect(await screen.findByText('비슷한 다음 영상')).toBeInTheDocument()
    expect(mockedGetSimilar).toHaveBeenLastCalledWith(21, 24)

    await user.click(screen.getByRole('link', { name: /비슷한 첫 영상/ }))
    expect(await screen.findByRole('heading', { name: '이동한 Scene 영상' })).toBeInTheDocument()
    await waitFor(() => expect(mockedGetSimilar).toHaveBeenLastCalledWith(22, null))
  })

  it('distinguishes unavailable similarity from Scene load errors', async () => {
    mockedGetSimilar.mockResolvedValue(similarPage([], { available: false }))
    const view = renderApp('/scenes/21')
    expect(await screen.findByText('유사도 분석을 사용할 수 없습니다')).toBeInTheDocument()

    view.unmount()
    mockedGetScene.mockRejectedValue(new Error('Scene을 찾을 수 없습니다'))
    renderApp('/scenes/21')
    expect(await screen.findByText('Scene 상세 정보를 불러오지 못했습니다')).toBeInTheDocument()
    expect(mockedGetSimilar).toHaveBeenCalledTimes(1)
  })
})
