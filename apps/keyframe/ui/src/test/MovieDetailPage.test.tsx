import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPlayableMovie } from '../api/movies'
import { createMovieScene, deleteScene, getMovieScenes, retryScene } from '../api/scenes'
import { movieDetail, scene } from './fixtures'
import { renderApp } from './render'

vi.mock('../api/movies', () => ({ getMovies: vi.fn(), importMovies: vi.fn(), getPlayableMovie: vi.fn() }))
vi.mock('../api/scenes', () => ({
  getScenes: vi.fn(),
  getMovieScenes: vi.fn(),
  createMovieScene: vi.fn(),
  deleteScene: vi.fn(),
  retryScene: vi.fn(),
}))

const mockedGetMovie = vi.mocked(getPlayableMovie)
const mockedGetScenes = vi.mocked(getMovieScenes)
const mockedCreateScene = vi.mocked(createMovieScene)
const mockedDeleteScene = vi.mocked(deleteScene)
const mockedRetryScene = vi.mocked(retryScene)

async function renderDetail() {
  renderApp('/movies/7')
  await screen.findByRole('heading', { name: '테스트 영상', level: 1 })
  const player = document.querySelector('video') as HTMLVideoElement
  Object.defineProperty(player, 'duration', { configurable: true, value: 600 })
  return player
}

describe('영상 상세', () => {
  beforeEach(() => {
    mockedGetMovie.mockResolvedValue(movieDetail())
    mockedGetScenes.mockResolvedValue([])
    mockedCreateScene.mockResolvedValue(scene({
      id: 30, timestamp_ms: 12_345, prompt: null, keywords: null, analysis_status: 'pending', snapshot_url: null,
    }))
    mockedDeleteScene.mockResolvedValue(undefined)
    mockedRetryScene.mockResolvedValue(scene({ analysis_status: 'pending' }))
    Element.prototype.scrollIntoView = vi.fn()
    window.confirm = vi.fn(() => true)
  })

  it('shows movie metadata and applies seek shortcuts with priority and clamping', async () => {
    const player = await renderDetail()
    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument()
    expect(screen.getByText('h264 / aac')).toBeInTheDocument()

    player.currentTime = 5
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(player.currentTime).toBe(0)

    player.currentTime = 100
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true })
    expect(player.currentTime).toBe(160)
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true, shiftKey: true })
    expect(player.currentTime).toBe(460)

    player.currentTime = 595
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(player.currentTime).toBe(600)
  })

  it('creates a Scene at the current position with S and ignores key repeat', async () => {
    const user = userEvent.setup()
    const player = await renderDetail()
    player.currentTime = 12.345

    await user.keyboard('s')
    fireEvent.keyDown(window, { key: 's', repeat: true })

    await waitFor(() => expect(mockedCreateScene).toHaveBeenCalledWith(7, 12_345))
    expect(mockedCreateScene).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('분석 대기')).toBeInTheDocument()
    expect(screen.getByText('00:12.345', { selector: 'strong.scene-item__time' })).toBeInTheDocument()
  })

  it('reports Scene creation errors in a toast', async () => {
    const user = userEvent.setup()
    mockedCreateScene.mockRejectedValueOnce(new Error('같은 timestamp의 Scene이 이미 있습니다'))
    await renderDetail()

    await user.click(screen.getByRole('button', { name: '현재 위치에 Scene 생성' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('같은 timestamp의 Scene이 이미 있습니다')
  })

  it('seeks to a Scene and starts playback when its thumbnail is activated', async () => {
    const user = userEvent.setup()
    mockedGetScenes.mockResolvedValue([scene()])
    const player = await renderDetail()
    const play = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(player, 'play', { configurable: true, value: play })

    await user.click(await screen.findByRole('button', { name: '00:01.500 위치 재생' }))

    expect(player.currentTime).toBe(1.5)
    expect(play).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /상세/ })).toHaveAttribute('href', '/scenes/21')
  })

  it('shows a failed Scene and explicitly retries its analysis', async () => {
    const user = userEvent.setup()
    mockedGetScenes.mockResolvedValue([scene({ analysis_status: 'failed', analysis_error: 'WD14 failure' })])
    await renderDetail()

    expect(await screen.findByText('WD14 failure')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /재시도/ }))

    await waitFor(() => expect(mockedRetryScene).toHaveBeenCalledWith(21))
    expect(await screen.findByText('분석 대기')).toBeInTheDocument()
  })

  it('confirms deletion and removes the last Scene from the list', async () => {
    const user = userEvent.setup()
    mockedGetScenes.mockResolvedValueOnce([scene()]).mockResolvedValue([])
    vi.mocked(window.confirm).mockReturnValueOnce(false).mockReturnValueOnce(true)
    await renderDetail()
    const deleteButton = await screen.findByRole('button', { name: 'Scene #21 삭제' })

    await user.click(deleteButton)
    expect(mockedDeleteScene).not.toHaveBeenCalled()
    expect(screen.getByText('1개')).toBeInTheDocument()

    await user.click(deleteButton)
    await waitFor(() => expect(mockedDeleteScene).toHaveBeenCalledWith(21))
    expect(await screen.findByText('아직 Scene이 없습니다')).toBeInTheDocument()
    expect(screen.getByText('0개')).toBeInTheDocument()
  })

  it('disables duplicate deletion and reports a delete failure', async () => {
    const user = userEvent.setup()
    mockedGetScenes.mockResolvedValue([scene()])
    let rejectDelete: ((error: Error) => void) | undefined
    mockedDeleteScene.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectDelete = reject }))
    await renderDetail()
    const deleteButton = await screen.findByRole('button', { name: 'Scene #21 삭제' })

    await user.click(deleteButton)
    await waitFor(() => expect(deleteButton).toBeDisabled())
    await user.click(deleteButton)
    expect(mockedDeleteScene).toHaveBeenCalledTimes(1)
    await act(async () => { rejectDelete?.(new Error('Scene 삭제 실패')) })

    expect(await screen.findByRole('alert')).toHaveTextContent('Scene 삭제 실패')
    expect(screen.getByText('분석 완료')).toBeInTheDocument()
  })

  it('explains when the browser cannot play the original file', async () => {
    mockedGetMovie.mockResolvedValue(movieDetail({
      playback_status: 'failed',
      playback_error: '브라우저에서 직접 재생할 수 없는 영상 codec입니다',
      stream_url: null,
    }))
    renderApp('/movies/7')

    expect(await screen.findByText('브라우저에서 직접 재생할 수 없는 영상입니다')).toBeInTheDocument()
    expect(screen.getByText('브라우저에서 직접 재생할 수 없는 영상 codec입니다')).toBeInTheDocument()
    expect(document.querySelector('video')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '현재 위치에 Scene 생성' })).toBeDisabled()
  })

  it('keeps polling while a Scene is being analyzed', async () => {
    mockedGetScenes
      .mockResolvedValueOnce([scene({ prompt: null, analysis_status: 'pending', snapshot_url: null })])
      .mockResolvedValueOnce([scene({ prompt: null, analysis_status: 'processing' })])
      .mockResolvedValue([scene()])
    await renderDetail()

    expect(await screen.findByText('분석 대기')).toBeInTheDocument()
    expect(await screen.findByText('분석 중', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(await screen.findByText('분석 완료', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(mockedGetScenes).toHaveBeenCalledTimes(3)
  }, 12_000)

  it('shows a retryable error for an unknown movie', async () => {
    mockedGetMovie.mockRejectedValue(new Error('영상을 찾을 수 없습니다'))
    renderApp('/movies/999')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('영상을 찾을 수 없습니다')
    expect(within(alert).getByRole('link', { name: /영상 라이브러리/ })).toHaveAttribute('href', '/movies')
    expect(within(alert).getByRole('button', { name: /다시 시도/ })).toBeInTheDocument()
  })
})
