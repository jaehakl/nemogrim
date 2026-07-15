import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import {
  getMovieDetail,
  prepareMoviePlayback,
  type MovieDetail,
} from '../api/movies'
import {
  createMovieScene,
  getMovieScenes,
  retryScene,
  type Scene,
} from '../api/scenes'

vi.mock('../api/movies', () => ({
  getMovies: vi.fn(),
  getMovieStatuses: vi.fn(),
  importMovieFiles: vi.fn(),
  importMovieFolder: vi.fn(),
  getMovieDetail: vi.fn(),
  prepareMoviePlayback: vi.fn(),
}))

vi.mock('../api/scenes', () => ({
  getScene: vi.fn(),
  getSimilarScenes: vi.fn(),
  getMovieScenes: vi.fn(),
  createMovieScene: vi.fn(),
  retryScene: vi.fn(),
}))

const mockedGetDetail = vi.mocked(getMovieDetail)
const mockedPrepare = vi.mocked(prepareMoviePlayback)
const mockedGetScenes = vi.mocked(getMovieScenes)
const mockedCreateScene = vi.mocked(createMovieScene)
const mockedRetryScene = vi.mocked(retryScene)

function movie(overrides: Partial<MovieDetail> = {}): MovieDetail {
  return {
    id: 7,
    title: '상세 테스트 영상',
    path: 'E:\\videos\\detail.mp4',
    ext: '.mp4',
    size_bytes: 1024,
    file_modified_at: '2026-07-15T03:00:00Z',
    duration_ms: 600_000,
    width: 1920,
    height: 1080,
    fps: 30,
    metadata_status: 'ready',
    metadata_error: null,
    thumbnail_url: '/api/movies/7/thumbnail',
    created_at: '2026-07-15T03:00:00Z',
    updated_at: '2026-07-15T03:00:00Z',
    video_codec: 'h264',
    audio_codec: 'aac',
    playback_status: 'direct',
    playback_error: null,
    stream_url: '/api/movies/7/stream',
    scene_count: 0,
    ...overrides,
  }
}

function scene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 21,
    movie_file_id: 7,
    timestamp_ms: 1_500,
    prompt: 'blue sky, 1girl',
    keywords: ['blue sky', '1girl'],
    embedding_model: 'OpenAI CLIP ViT-L/14',
    prompt_model: 'SmilingWolf/wd-eva02-large-tagger-v3',
    analysis_status: 'ready',
    analysis_error: null,
    snapshot_url: '/api/scenes/21/snapshot',
    created_at: '2026-07-15T03:00:00Z',
    updated_at: '2026-07-15T03:00:00Z',
    ...overrides,
  }
}

function renderDetail() {
  return render(<MemoryRouter initialEntries={['/movies/7']}><App /></MemoryRouter>)
}

describe('Keyframe movie detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetDetail.mockResolvedValue(movie())
    mockedGetScenes.mockResolvedValue({ items: [] })
    mockedPrepare.mockResolvedValue(movie())
    mockedCreateScene.mockResolvedValue(scene({ id: 30, timestamp_ms: 12_345, prompt: null, keywords: null, analysis_status: 'pending', snapshot_url: null }))
    mockedRetryScene.mockResolvedValue(scene({ analysis_status: 'pending', analysis_error: null }))
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the player and applies seek shortcuts with priority and clamping', async () => {
    renderDetail()
    await screen.findByRole('heading', { name: '상세 테스트 영상' })
    await act(async () => { await Promise.resolve() })
    const player = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(player, 'duration', { configurable: true, value: 600 })

    player.currentTime = 100
    player.focus()
    player.addEventListener('keydown', (event) => {
      if (!event.defaultPrevented) player.currentTime += 10
    }, { once: true })
    fireEvent.keyDown(player, { key: 'ArrowRight' })
    expect(player.currentTime).toBe(110)

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

    player.currentTime = 100
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })
    expect(player.currentTime).toBe(100)

    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    player.currentTime = 100
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(player.currentTime).toBe(100)
    input.remove()
  })

  it('creates a Scene at the current position with S and prevents repeat events', async () => {
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('heading', { name: '상세 테스트 영상' })
    const player = document.querySelector('video') as HTMLVideoElement
    player.currentTime = 12.345
    player.focus()
    await user.keyboard('s')
    await waitFor(() => expect(mockedCreateScene).toHaveBeenCalledWith(7, 12_345))
    fireEvent.keyDown(window, { key: 's', repeat: true })
    expect(mockedCreateScene).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('분석 대기 중')).toBeInTheDocument()
  })

  it('seeks to a Scene and starts playback when its card is activated', async () => {
    mockedGetScenes.mockResolvedValue({ items: [scene()] })
    renderDetail()
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: '상세 테스트 영상' })
    const player = document.querySelector('video') as HTMLVideoElement
    const play = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(player, 'play', { configurable: true, value: play })
    await user.click(await screen.findByRole('button', { name: /00:01\.500/ }))
    expect(player.currentTime).toBe(1.5)
    expect(play).toHaveBeenCalled()
  })

  it('shows a failed Scene and explicitly retries its analysis', async () => {
    mockedGetScenes.mockResolvedValue({
      items: [scene({ analysis_status: 'failed', analysis_error: 'WD14 failure' })],
    })
    renderDetail()
    const user = userEvent.setup()
    expect(await screen.findByText('WD14 failure')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /재시도/ }))
    await waitFor(() => expect(mockedRetryScene).toHaveBeenCalledWith(21))
    expect(await screen.findByText('분석 대기 중')).toBeInTheDocument()
  })

  it('shows a direct-playback block without proxy polling or retry controls', async () => {
    mockedGetDetail.mockResolvedValueOnce(movie({
      playback_status: 'failed',
      playback_error: '브라우저에서 직접 재생할 수 없는 영상 codec입니다',
      stream_url: null,
    }))
    renderDetail()
    expect(await screen.findByText('브라우저에서 직접 재생할 수 없는 영상입니다')).toBeInTheDocument()
    expect(screen.getByText('브라우저에서 직접 재생할 수 없는 영상 codec입니다')).toBeInTheDocument()
    expect(document.querySelector('video')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /다시 준비/ })).not.toBeInTheDocument()
    expect(mockedGetDetail).toHaveBeenCalledTimes(1)
  })

  it('continues polling an active Scene until analysis is complete', async () => {
    vi.useFakeTimers()
    mockedGetScenes
      .mockResolvedValueOnce({ items: [scene({ prompt: null, analysis_status: 'pending', snapshot_url: null })] })
      .mockResolvedValueOnce({ items: [scene({ prompt: null, analysis_status: 'processing' })] })
      .mockResolvedValueOnce({ items: [scene()] })
    renderDetail()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('분석 대기 중')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(screen.getByText('Scene 분석 중')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(screen.getByText('분석 완료')).toBeInTheDocument()
    expect(mockedGetScenes).toHaveBeenCalledTimes(3)
  })
})
