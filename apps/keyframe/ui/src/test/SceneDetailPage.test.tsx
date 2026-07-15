import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { getMovieDetail, prepareMoviePlayback, type MovieDetail } from '../api/movies'
import {
  createMovieScene,
  getScene,
  getSimilarScenes,
  type ExplorerScene,
  type Scene,
  type SimilarScenePage,
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
  getScenes: vi.fn(),
  getScene: vi.fn(),
  getSimilarScenes: vi.fn(),
  getMovieScenes: vi.fn(),
  createMovieScene: vi.fn(),
  retryScene: vi.fn(),
}))

const mockedGetScene = vi.mocked(getScene)
const mockedGetSimilar = vi.mocked(getSimilarScenes)
const mockedGetMovie = vi.mocked(getMovieDetail)
const mockedPrepare = vi.mocked(prepareMoviePlayback)
const mockedCreateScene = vi.mocked(createMovieScene)

function scene(overrides: Partial<ExplorerScene> = {}): ExplorerScene {
  return {
    id: 21,
    movie_file_id: 7,
    movie_title: 'Scene 상세 영상',
    timestamp_ms: 12_345,
    prompt: 'blue sky, ocean',
    keywords: ['blue sky', 'ocean'],
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

function movie(overrides: Partial<MovieDetail> = {}): MovieDetail {
  return {
    id: 7,
    title: 'Scene 상세 영상',
    path: 'E:\\videos\\scene.mp4',
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
    scene_count: 2,
    ...overrides,
  }
}

function similarPage(
  items: ExplorerScene[] = [],
  overrides: Partial<SimilarScenePage> = {},
): SimilarScenePage {
  return {
    items,
    total: items.length,
    next_offset: null,
    has_more: false,
    available: true,
    ...overrides,
  }
}

function renderDetail() {
  return render(<MemoryRouter initialEntries={['/scenes/21']}><App /></MemoryRouter>)
}

describe('Scene detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetScene.mockResolvedValue(scene())
    mockedGetMovie.mockResolvedValue(movie())
    mockedPrepare.mockResolvedValue(movie())
    mockedGetSimilar.mockResolvedValue(similarPage())
    mockedCreateScene.mockResolvedValue(scene())
    Element.prototype.scrollIntoView = vi.fn()
    window.scrollTo = vi.fn()
  })

  afterEach(() => { vi.clearAllTimers() })

  it('loads Scene context and starts playback at the Scene timestamp', async () => {
    mockedGetSimilar.mockResolvedValueOnce(similarPage([
      scene({ id: 22, movie_title: '비슷한 영상', timestamp_ms: 20_000 }),
    ]))
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Scene 상세 영상' })).toBeInTheDocument()
    expect(screen.getAllByText('blue sky, ocean').length).toBeGreaterThan(0)
    expect(screen.getByText('blue sky')).toBeInTheDocument()
    const player = document.querySelector('video') as HTMLVideoElement
    const play = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(player, 'play', { configurable: true, value: play })
    Object.defineProperty(player, 'duration', { configurable: true, value: 600 })
    fireEvent.loadedMetadata(player)

    expect(player.currentTime).toBe(12.345)
    expect(play).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: /비슷한 영상/ })).toHaveAttribute('href', '/scenes/22')
    expect(mockedGetScene).toHaveBeenCalledWith(21)
    expect(mockedGetSimilar).toHaveBeenCalledWith(21, 0)
  })

  it('prepares unprepared playback and tolerates autoplay rejection', async () => {
    mockedGetMovie.mockResolvedValueOnce(movie({ playback_status: 'unprepared', stream_url: null }))
    renderDetail()

    await waitFor(() => expect(mockedPrepare).toHaveBeenCalledWith(7))
    const player = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(player, 'play', {
      configurable: true,
      value: vi.fn().mockRejectedValueOnce(new Error('autoplay blocked')),
    })
    Object.defineProperty(player, 'duration', { configurable: true, value: 600 })
    fireEvent.loadedMetadata(player)
    await act(async () => { await Promise.resolve() })

    expect(player.currentTime).toBe(12.345)
    expect(await screen.findByRole('heading', { name: 'Scene 상세 영상' })).toBeInTheDocument()
  })

  it('keeps Scene information and similar results visible when playback is unavailable', async () => {
    mockedGetMovie.mockResolvedValueOnce(movie({
      playback_status: 'failed',
      playback_error: '브라우저에서 직접 재생할 수 없는 영상 codec입니다',
      stream_url: null,
    }))
    mockedGetSimilar.mockResolvedValueOnce(similarPage([scene({ id: 22, movie_title: '비슷한 영상' })]))
    renderDetail()

    expect(await screen.findByText('브라우저에서 직접 재생할 수 없는 영상입니다')).toBeInTheDocument()
    expect(screen.getByText('브라우저에서 직접 재생할 수 없는 영상 codec입니다')).toBeInTheDocument()
    expect(screen.getAllByText('blue sky, ocean').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /비슷한 영상/ })).toBeInTheDocument()
  })

  it('creates a Scene from the player without leaving or refreshing the detail page', async () => {
    const user = userEvent.setup()
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'Scene 상세 영상' })).toBeInTheDocument()
    const player = document.querySelector('video') as HTMLVideoElement
    player.currentTime = 45.678
    fireEvent.timeUpdate(player)

    await user.click(screen.getByRole('button', { name: '현재 위치에 Scene 생성' }))

    await waitFor(() => expect(mockedCreateScene).toHaveBeenCalledWith(7, 45_678))
    expect(await screen.findByText('Scene을 생성했습니다.')).toBeInTheDocument()
    expect(mockedGetScene).toHaveBeenCalledTimes(1)
    expect(mockedGetSimilar).toHaveBeenCalledTimes(1)
    expect(player.currentTime).toBe(45.678)

    await user.click(screen.getByRole('button', { name: '성공 알림 닫기' }))
    player.currentTime = 50
    fireEvent.keyDown(window, { key: 's' })
    await waitFor(() => expect(mockedCreateScene).toHaveBeenLastCalledWith(7, 50_000))
    expect(mockedCreateScene).toHaveBeenCalledTimes(2)
  })

  it('disables creation while pending and shows a dismissible server error', async () => {
    const user = userEvent.setup()
    let resolveCreate: ((created: Scene) => void) | undefined
    mockedCreateScene.mockImplementationOnce(() => new Promise((resolve) => { resolveCreate = resolve }))
    renderDetail()
    await screen.findByRole('heading', { name: 'Scene 상세 영상' })

    await user.click(screen.getByRole('button', { name: '현재 위치에 Scene 생성' }))
    expect(screen.getByRole('button', { name: 'Scene 등록 중' })).toBeDisabled()
    await act(async () => { resolveCreate?.(scene()) })

    mockedCreateScene.mockRejectedValueOnce(new Error('같은 timestamp의 Scene이 이미 있습니다.'))
    await user.click(screen.getByRole('button', { name: '현재 위치에 Scene 생성' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('같은 timestamp의 Scene이 이미 있습니다.')
    await user.click(screen.getByRole('button', { name: '오류 알림 닫기' }))
    expect(screen.queryByText('같은 timestamp의 Scene이 이미 있습니다.')).not.toBeInTheDocument()
  })

  it('loads more similar Scenes and navigates between Scene detail routes', async () => {
    const user = userEvent.setup()
    mockedGetScene
      .mockResolvedValueOnce(scene())
      .mockResolvedValueOnce(scene({ id: 22, movie_title: '이동한 Scene 영상', timestamp_ms: 30_000 }))
    mockedGetSimilar
      .mockResolvedValueOnce(similarPage(
        [scene({ id: 22, movie_title: '비슷한 첫 영상' })],
        { total: 2, next_offset: 24, has_more: true },
      ))
      .mockResolvedValueOnce(similarPage([scene({ id: 23, movie_title: '비슷한 다음 영상' })], { total: 2 }))
      .mockResolvedValueOnce(similarPage())
    renderDetail()
    await screen.findByText('비슷한 첫 영상')

    act(() => globalThis.__latestIntersectionObserver?.trigger())
    expect(await screen.findByText('비슷한 다음 영상')).toBeInTheDocument()
    expect(mockedGetSimilar).toHaveBeenLastCalledWith(21, 24)

    await user.click(screen.getByRole('link', { name: /비슷한 첫 영상/ }))
    expect(await screen.findByRole('heading', { name: '이동한 Scene 영상' })).toBeInTheDocument()
    expect(mockedGetScene).toHaveBeenLastCalledWith(22)
    expect(mockedGetSimilar).toHaveBeenLastCalledWith(22, 0)
  })

  it('distinguishes unavailable similarity from Scene load errors', async () => {
    mockedGetSimilar.mockResolvedValueOnce(similarPage([], { available: false }))
    const view = renderDetail()
    expect(await screen.findByText('유사도 분석을 사용할 수 없습니다')).toBeInTheDocument()

    view.unmount()
    mockedGetScene.mockRejectedValueOnce(new Error('Scene을 찾을 수 없습니다'))
    mockedGetSimilar.mockRejectedValueOnce(new Error('Scene을 찾을 수 없습니다'))
    renderDetail()
    expect(await screen.findByText('Scene 상세 정보를 불러오지 못했습니다')).toBeInTheDocument()
  })
})
