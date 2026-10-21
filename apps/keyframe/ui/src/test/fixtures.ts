import type { AiStatus, ExplorerScene, Movie, MovieDetail, MoviePage, Scene, ScenePage, SimilarScenePage } from '../api/types'

export function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 7,
    title: '테스트 영상',
    path: 'E:\\videos\\test.mp4',
    ext: '.mp4',
    size_bytes: 1024 * 1024 * 300,
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
    ...overrides,
  }
}

export function movieDetail(overrides: Partial<MovieDetail> = {}): MovieDetail {
  return {
    ...movie(),
    video_codec: 'h264',
    audio_codec: 'aac',
    playback_status: 'direct',
    playback_error: null,
    stream_url: '/api/movies/7/stream',
    scene_count: 0,
    ...overrides,
  }
}

export function moviePage(items: Movie[], overrides: Partial<MoviePage> = {}): MoviePage {
  return { items, total: items.length, processing_count: 0, next_cursor: null, ...overrides }
}

export function scene(overrides: Partial<Scene> = {}): Scene {
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

export function explorerScene(overrides: Partial<ExplorerScene> = {}): ExplorerScene {
  return { ...scene(), movie_title: '테스트 영상', ...overrides }
}

export function scenePage(items: ExplorerScene[], overrides: Partial<ScenePage> = {}): ScenePage {
  return { items, total: items.length, next_cursor: null, ...overrides }
}

export function similarPage(items: ExplorerScene[], overrides: Partial<SimilarScenePage> = {}): SimilarScenePage {
  return { items, total: items.length, next_cursor: null, available: true, ...overrides }
}

export function aiStatus(overrides: Partial<AiStatus> = {}): AiStatus {
  const state = overrides.state ?? 'not_loaded'
  return {
    state,
    requested_device: 'auto',
    device: 'cuda:0',
    device_name: 'NVIDIA GeForce RTX 3090 Ti',
    note: null,
    models: {
      clip: { name: 'OpenAI CLIP ViT-L/14', state, error: null },
      tagger: { name: 'SmilingWolf/wd-eva02-large-tagger-v3', state, error: null },
    },
    ...overrides,
  }
}
