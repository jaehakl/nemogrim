import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import {
  generateMovieImages, getImages, getSdxlModels,
  type ImagePage, type SdxlModelCatalog,
} from '../api/images'
import { getMovieDetail, getMovies, prepareMoviePlayback, type MovieDetail } from '../api/movies'

vi.mock('../api/images', () => ({
  getImages: vi.fn(),
  getSdxlModels: vi.fn(),
  generateMovieImages: vi.fn(),
}))

vi.mock('../api/movies', () => ({
  getMovies: vi.fn(),
  getMovieStatuses: vi.fn().mockResolvedValue({ items: [], processing_count: 0 }),
  importMovieFiles: vi.fn(),
  importMovieFolder: vi.fn(),
  getMovieDetail: vi.fn(),
  prepareMoviePlayback: vi.fn(),
}))

vi.mock('../api/scenes', () => ({
  getScenes: vi.fn(), getScene: vi.fn(), getSimilarScenes: vi.fn(),
  getMovieScenes: vi.fn(), createMovieScene: vi.fn(), deleteScene: vi.fn(), retryScene: vi.fn(),
}))

const mockedGetImages = vi.mocked(getImages)
const mockedGetModels = vi.mocked(getSdxlModels)
const mockedGenerate = vi.mocked(generateMovieImages)
const mockedGetMovie = vi.mocked(getMovieDetail)
const mockedPrepare = vi.mocked(prepareMoviePlayback)
const mockedGetMovies = vi.mocked(getMovies)

const movie: MovieDetail = {
  id: 7, title: '이미지 생성 영상', path: 'E:\\videos\\image.mp4', ext: '.mp4',
  size_bytes: 1024, file_modified_at: '2026-07-15T03:00:00Z', duration_ms: 600_000,
  width: 1920, height: 1080, fps: 30, metadata_status: 'ready', metadata_error: null,
  thumbnail_url: '/api/movies/7/thumbnail', created_at: '2026-07-15T03:00:00Z',
  updated_at: '2026-07-15T03:00:00Z', video_codec: 'h264', audio_codec: 'aac',
  playback_status: 'direct', playback_error: null, stream_url: '/api/movies/7/stream', scene_count: 0,
}

const catalog: SdxlModelCatalog = {
  default_model: 'main',
  models: [
    { name: 'main', step: 24, cfg: 6.5, height: 1024, width: 768, strength: 0.75, format: 'png' },
    { name: 'detail', step: 40, cfg: 8, height: 768, width: 768, strength: 0.6, format: 'jpg' },
  ],
}

const emptyImages: ImagePage = {
  items: [], total: 0, next_cursor: null, has_more: false,
}

function LocationDisplay() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

function renderPage(path: string, withLocation = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {withLocation ? <LocationDisplay /> : null}
      <App />
    </MemoryRouter>,
  )
}

describe('Image generation page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetMovie.mockResolvedValue(movie)
    mockedPrepare.mockResolvedValue(movie)
    mockedGetModels.mockResolvedValue(catalog)
    mockedGetImages.mockResolvedValue(emptyImages)
    mockedGenerate.mockResolvedValue({
      items: [{ id: 2, prompt: 'blue sky, 1girl', image_url: '/api/images/2/file' }],
    })
    mockedGetMovies.mockResolvedValue({
      items: [movie], total: 1, processing_count: 0, next_cursor: null, has_more: false,
    })
  })

  it('opens the workspace after selecting a movie from the image route', async () => {
    const user = userEvent.setup()
    renderPage('/images', true)
    expect(await screen.findByRole('heading', { name: '이미지를 생성할 영상 선택' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /이미지 생성 영상/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/images/7')
    expect(await screen.findByRole('heading', { name: '이미지 생성 영상' })).toBeInTheDocument()
  })

  it('uses model defaults and sends the current player timestamp through one generation request', async () => {
    const user = userEvent.setup()
    renderPage('/images/7')
    await screen.findByRole('heading', { name: '이미지 생성 영상' })
    expect(await screen.findByLabelText('Step')).toHaveValue(24)
    expect(screen.getByLabelText('CFG')).toHaveValue(6.5)
    expect(screen.getByLabelText('Width')).toHaveValue(768)
    expect(screen.getByLabelText('Strength')).toHaveValue(0.75)

    const player = document.querySelector('video') as HTMLVideoElement
    player.currentTime = 12.345
    fireEvent.timeUpdate(player)
    fireEvent.keyDown(window, { key: 's' })
    expect(mockedGenerate).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '이미지 생성' }))

    await waitFor(() => expect(mockedGenerate).toHaveBeenCalledWith(7, {
      timestamp_ms: 12_345,
      model: 'main',
      count: 1,
      negative_prompt: '',
      seed: null,
      step: 24,
      cfg: 6.5,
      strength: 0.75,
      width: 768,
      height: 1024,
      format: 'png',
    }))
    expect(await screen.findByRole('img', { name: 'blue sky, 1girl' })).toBeInTheDocument()
    expect(screen.getByText('1개의 생성 이미지')).toBeInTheDocument()
  })

  it('resets model-dependent settings when the selected model changes', async () => {
    const user = userEvent.setup()
    renderPage('/images/7')
    await screen.findByLabelText('Model')
    await user.selectOptions(screen.getByLabelText('Model'), 'detail')
    expect(screen.getByLabelText('Step')).toHaveValue(40)
    expect(screen.getByLabelText('CFG')).toHaveValue(8)
    expect(screen.getByLabelText('Strength')).toHaveValue(0.6)
    expect(screen.getByLabelText('Format')).toHaveValue('jpg')
  })

  it('loads older global images when the feed sentinel intersects', async () => {
    mockedGetImages
      .mockResolvedValueOnce({
        items: [{ id: 3, prompt: 'new', image_url: '/api/images/3/file' }],
        total: 2, next_cursor: 3, has_more: true,
      })
      .mockResolvedValueOnce({
        items: [{ id: 2, prompt: 'old', image_url: '/api/images/2/file' }],
        total: 2, next_cursor: null, has_more: false,
      })
    renderPage('/images/7')
    expect(await screen.findByRole('img', { name: 'new' })).toBeInTheDocument()
    act(() => globalThis.__latestIntersectionObserver?.trigger())
    expect(await screen.findByRole('img', { name: 'old' })).toBeInTheDocument()
    expect(mockedGetImages).toHaveBeenLastCalledWith(3)
  })
})
