import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FiAlertCircle, FiArrowLeft, FiFilm, FiImage, FiLoader,
  FiRefreshCw, FiSliders, FiX,
} from 'react-icons/fi'
import { Link, useParams } from 'react-router-dom'
import {
  generateMovieImages, getImages, getSdxlModels,
  type GeneratedImage, type ImageGenerationRequest, type SdxlModelDefaults,
} from '../../api/images'
import { getMovieDetail, prepareMoviePlayback, type MovieDetail } from '../../api/movies'
import { SceneVideoPlayer } from '../../components/scene/SceneVideoPlayer'
import { MovieCard } from '../movies/MovieCard'
import { useMovieLibrary } from '../movies/useMovieLibrary'
import './ImageGenerationPage.css'

const MAX_SEED = 2_147_483_647

interface FormSettings {
  model: string
  count: string
  negativePrompt: string
  seed: string
  step: string
  cfg: string
  strength: string
  width: string
  height: string
  format: 'png' | 'jpg'
}

export function ImageGenerationPage() {
  const params = useParams()
  const movieId = Number(params.movieId)
  if (!Number.isInteger(movieId) || movieId <= 0) return <ImageMovieSelection />
  return <ImageGenerationWorkspace movieId={movieId} />
}

function ImageMovieSelection() {
  const library = useMovieLibrary()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { loadMore, loadingInitial, nextCursor } = library

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !nextCursor || loadingInitial) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore() },
      { rootMargin: '320px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, loadingInitial, nextCursor])

  return (
    <div className="image-movie-selection">
      <header className="page-header">
        <div>
          <p className="eyebrow">IMAGE GENERATION</p>
          <h1>이미지를 생성할 영상 선택</h1>
          <p className="page-header__description">영상의 원하는 순간을 SDXL 이미지로 변환할 영상을 선택하세요.</p>
        </div>
      </header>

      {library.loadingInitial ? (
        <div className="initial-loading" role="status"><FiLoader /><span>영상 목록을 불러오는 중입니다.</span></div>
      ) : library.error ? (
        <div className="state-panel state-panel--error" role="alert">
          <FiAlertCircle /><h2>영상 목록을 불러오지 못했습니다</h2><p>{library.error}</p>
          <button type="button" className="secondary-button" onClick={() => void library.loadFirstPage()}><FiRefreshCw /> 다시 시도</button>
        </div>
      ) : library.movies.length === 0 ? (
        <div className="state-panel state-panel--empty">
          <span className="state-panel__icon"><FiFilm /></span><h2>선택할 영상이 없습니다</h2>
          <p>영상 라이브러리에서 먼저 영상을 추가하세요.</p>
          <Link className="primary-button" to="/movies">영상 라이브러리로 이동</Link>
        </div>
      ) : (
        <>
          <div className="image-movie-selection__summary"><strong>{library.total.toLocaleString('ko-KR')}</strong>개의 영상</div>
          <section className="movie-grid" aria-label="이미지를 생성할 영상 목록">
            {library.movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} to={`/images/${movie.id}`} />
            ))}
          </section>
          <div ref={sentinelRef} className="load-sentinel" aria-hidden={!library.loadingMore}>
            {library.loadingMore ? <span><FiLoader /> 다음 영상을 불러오는 중</span>
              : library.nextCursor ? <span className="sr-only">더 많은 영상이 있습니다.</span>
                : <span>모든 영상을 불러왔습니다.</span>}
          </div>
        </>
      )}
    </div>
  )
}

function ImageGenerationWorkspace({ movieId }: { movieId: number }) {
  const [movie, setMovie] = useState<MovieDetail | null>(null)
  const [movieLoading, setMovieLoading] = useState(true)
  const [movieError, setMovieError] = useState('')
  const [models, setModels] = useState<SdxlModelDefaults[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState('')
  const [settings, setSettings] = useState<FormSettings>({
    model: '', count: '1', negativePrompt: '', seed: '', step: '30', cfg: '7',
    strength: '1', width: '1024', height: '1024', format: 'png',
  })
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [imagesLoading, setImagesLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [imagesError, setImagesError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  const loadMovie = useCallback(async () => {
    setMovieLoading(true)
    setMovieError('')
    try {
      let detail = await getMovieDetail(movieId)
      if (detail.playback_status === 'unprepared') detail = await prepareMoviePlayback(movieId)
      setMovie(detail)
    } catch (error) {
      setMovieError(error instanceof Error ? error.message : '영상 정보를 불러오지 못했습니다.')
    } finally {
      setMovieLoading(false)
    }
  }, [movieId])

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    setModelsError('')
    try {
      const catalog = await getSdxlModels()
      setModels(catalog.models)
      const selected = catalog.models.find((model) => model.name === catalog.default_model) || catalog.models[0]
      if (!selected) throw new Error('사용 가능한 SDXL 모델이 없습니다.')
      setSettings({
        model: selected.name, count: '1', negativePrompt: '', seed: '',
        step: String(selected.step), cfg: String(selected.cfg),
        strength: String(selected.strength), width: String(selected.width),
        height: String(selected.height), format: selected.format,
      })
    } catch (error) {
      setModelsError(error instanceof Error ? error.message : 'SDXL 모델 목록을 불러오지 못했습니다.')
    } finally {
      setModelsLoading(false)
    }
  }, [])

  const loadFirstImages = useCallback(async () => {
    setImagesLoading(true)
    setImagesError('')
    try {
      const response = await getImages()
      setImages(response.items)
      setTotal(response.total)
      setNextCursor(response.next_cursor)
    } catch (error) {
      setImagesError(error instanceof Error ? error.message : '이미지 목록을 불러오지 못했습니다.')
    } finally {
      setImagesLoading(false)
    }
  }, [])

  useEffect(() => { void loadMovie() }, [loadMovie])
  useEffect(() => { void loadModels() }, [loadModels])
  useEffect(() => { void loadFirstImages() }, [loadFirstImages])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const response = await getImages(nextCursor)
      setImages((current) => {
        const knownIds = new Set(current.map((image) => image.id))
        return [...current, ...response.items.filter((image) => !knownIds.has(image.id))]
      })
      setTotal(response.total)
      setNextCursor(response.next_cursor)
    } catch (error) {
      setImagesError(error instanceof Error ? error.message : '다음 이미지를 불러오지 못했습니다.')
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [nextCursor])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !nextCursor || imagesLoading) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore() },
      { rootMargin: '320px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [imagesLoading, loadMore, nextCursor])

  const formResult = useMemo(() => {
    const count = Number(settings.count)
    const step = Number(settings.step)
    const cfg = Number(settings.cfg)
    const strength = Number(settings.strength)
    const width = Number(settings.width)
    const height = Number(settings.height)
    const seed = settings.seed.trim() === '' ? null : Number(settings.seed)
    let error = ''
    if (!settings.model) error = 'SDXL 모델을 선택하세요.'
    else if (!Number.isInteger(count) || count < 1 || count > 8) error = '생성 개수는 1에서 8 사이의 정수여야 합니다.'
    else if (!Number.isInteger(step) || step < 1 || step > 150) error = 'Step은 1에서 150 사이의 정수여야 합니다.'
    else if (!Number.isFinite(cfg) || cfg < 0 || cfg > 30) error = 'CFG는 0에서 30 사이여야 합니다.'
    else if (!Number.isFinite(strength) || strength < 0 || strength > 1) error = 'Strength는 0에서 1 사이여야 합니다.'
    else if (!Number.isInteger(width) || width < 64 || width > 2048 || width % 8) error = 'Width는 64에서 2048 사이의 8의 배수여야 합니다.'
    else if (!Number.isInteger(height) || height < 64 || height > 2048 || height % 8) error = 'Height는 64에서 2048 사이의 8의 배수여야 합니다.'
    else if (seed !== null && (!Number.isInteger(seed) || seed < 0 || seed + count - 1 > MAX_SEED)) error = 'Seed와 생성 개수의 범위를 확인하세요.'
    else if (new TextEncoder().encode(settings.negativePrompt).length > 16 * 1024) error = 'Negative prompt는 16 KiB를 초과할 수 없습니다.'
    if (error) return { error, payload: null }
    return {
      error: '',
      payload: {
        model: settings.model, count, negative_prompt: settings.negativePrompt,
        seed, step, cfg, strength, width, height, format: settings.format,
      } satisfies Omit<ImageGenerationRequest, 'timestamp_ms'>,
    }
  }, [settings])

  async function createAt(timestampMs: number) {
    if (generating || !formResult.payload) return
    setGenerating(true)
    setGenerationError('')
    try {
      const response = await generateMovieImages(movieId, {
        timestamp_ms: timestampMs,
        ...formResult.payload,
      })
      setImages((current) => {
        const newIds = new Set(response.items.map((image) => image.id))
        return [...response.items, ...current.filter((image) => !newIds.has(image.id))]
      })
      setTotal((current) => current + response.items.length)
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '이미지를 생성하지 못했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  if (movieLoading) return <div className="detail-loading" role="status"><FiLoader /><span>이미지 생성 workspace를 준비하는 중입니다.</span></div>
  if (movieError || !movie) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <FiAlertCircle /><h2>영상을 불러오지 못했습니다</h2><p>{movieError || '영상을 찾을 수 없습니다.'}</p>
        <button type="button" className="secondary-button" onClick={() => void loadMovie()}><FiRefreshCw /> 다시 시도</button>
      </div>
    )
  }

  return (
    <div className="image-generation-page">
      <header className="image-generation-header">
        <div>
          <Link to="/images" className="detail-back"><FiArrowLeft /> 다른 영상 선택</Link>
          <p className="eyebrow">SDXL IMAGE TO IMAGE</p>
          <h1>{movie.title}</h1>
          <p title={movie.path}>{movie.path}</p>
        </div>
        <span className="image-generation-header__count"><FiImage />{total.toLocaleString('ko-KR')}개의 생성 이미지</span>
      </header>

      {generationError ? (
        <div className="notice notice--error" role="alert">
          <strong>{generationError}</strong>
          <button type="button" aria-label="오류 알림 닫기" onClick={() => setGenerationError('')}><FiX /></button>
        </div>
      ) : null}

      <div className="image-generation-layout">
        <SceneVideoPlayer
          streamUrl={movie.stream_url}
          durationMs={movie.duration_ms}
          playbackError={movie.playback_error}
          creating={generating}
          onCreateScene={(timestampMs) => void createAt(timestampMs)}
          actionLabel="이미지 생성"
          creatingLabel="이미지 생성 중"
          actionDisabled={modelsLoading || Boolean(modelsError) || Boolean(formResult.error)}
          shortcutKey={null}
        />

        <aside className="generation-settings" aria-label="이미지 생성 설정">
          <div className="generation-settings__header"><div><p className="eyebrow">SETTINGS</p><h2>이미지 생성 설정</h2></div><FiSliders /></div>
          {modelsLoading ? (
            <div className="generation-settings__state" role="status"><FiLoader /><span>SDXL 모델을 불러오는 중입니다.</span></div>
          ) : modelsError ? (
            <div className="generation-settings__state generation-settings__state--error" role="alert">
              <FiAlertCircle /><span>{modelsError}</span>
              <button type="button" className="secondary-button" onClick={() => void loadModels()}><FiRefreshCw /> 다시 시도</button>
            </div>
          ) : (
            <fieldset disabled={generating}>
              <label className="generation-field generation-field--wide"><span>Model</span>
                <select value={settings.model} onChange={(event) => {
                  const selected = models.find((model) => model.name === event.target.value)
                  if (!selected) return
                  setSettings((current) => ({
                    ...current, model: selected.name, step: String(selected.step), cfg: String(selected.cfg),
                    strength: String(selected.strength), width: String(selected.width),
                    height: String(selected.height), format: selected.format,
                  }))
                }}>
                  {models.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}
                </select>
              </label>
              <label className="generation-field"><span>생성 개수</span><input type="number" min="1" max="8" value={settings.count} onChange={(event) => setSettings((current) => ({ ...current, count: event.target.value }))} /></label>
              <label className="generation-field"><span>Seed <small>비우면 랜덤</small></span><input inputMode="numeric" value={settings.seed} placeholder="Random" onChange={(event) => setSettings((current) => ({ ...current, seed: event.target.value }))} /></label>
              <label className="generation-field generation-field--wide"><span>Negative prompt</span><textarea rows={3} value={settings.negativePrompt} placeholder="low quality, blurry" onChange={(event) => setSettings((current) => ({ ...current, negativePrompt: event.target.value }))} /></label>
              <label className="generation-field"><span>Step</span><input type="number" min="1" max="150" value={settings.step} onChange={(event) => setSettings((current) => ({ ...current, step: event.target.value }))} /></label>
              <label className="generation-field"><span>CFG</span><input type="number" min="0" max="30" step="0.1" value={settings.cfg} onChange={(event) => setSettings((current) => ({ ...current, cfg: event.target.value }))} /></label>
              <label className="generation-field"><span>Strength</span><input type="number" min="0" max="1" step="0.05" value={settings.strength} onChange={(event) => setSettings((current) => ({ ...current, strength: event.target.value }))} /></label>
              <label className="generation-field"><span>Format</span><select value={settings.format} onChange={(event) => setSettings((current) => ({ ...current, format: event.target.value as 'png' | 'jpg' }))}><option value="png">PNG</option><option value="jpg">JPG</option></select></label>
              <label className="generation-field"><span>Width</span><input type="number" min="64" max="2048" step="8" value={settings.width} onChange={(event) => setSettings((current) => ({ ...current, width: event.target.value }))} /></label>
              <label className="generation-field"><span>Height</span><input type="number" min="64" max="2048" step="8" value={settings.height} onChange={(event) => setSettings((current) => ({ ...current, height: event.target.value }))} /></label>
              {formResult.error ? <p className="generation-settings__validation" role="alert">{formResult.error}</p> : null}
            </fieldset>
          )}
        </aside>
      </div>

      <section className="generated-feed" aria-labelledby="generated-feed-title">
        <div className="generated-feed__header"><div><p className="eyebrow">GENERATED IMAGES</p><h2 id="generated-feed-title">Image 리스트</h2></div><span>전체 · 최신순</span></div>
        {imagesLoading ? (
          <div className="initial-loading" role="status"><FiLoader /><span>생성 이미지를 불러오는 중입니다.</span></div>
        ) : imagesError && images.length === 0 ? (
          <div className="state-panel state-panel--error" role="alert">
            <FiAlertCircle /><h2>이미지 목록을 불러오지 못했습니다</h2><p>{imagesError}</p>
            <button type="button" className="secondary-button" onClick={() => void loadFirstImages()}><FiRefreshCw /> 다시 시도</button>
          </div>
        ) : images.length === 0 ? (
          <div className="generated-feed__empty"><FiImage /><strong>아직 생성된 이미지가 없습니다</strong><p>영상을 재생하고 원하는 위치에서 첫 이미지를 생성하세요.</p></div>
        ) : (
          <>
            {imagesError ? <div className="notice notice--error" role="alert"><strong>{imagesError}</strong><button type="button" aria-label="목록 오류 닫기" onClick={() => setImagesError('')}><FiX /></button></div> : null}
            <div className="generated-image-grid">
              {images.map((image) => (
                <a key={image.id} className="generated-image-card" href={image.image_url} target="_blank" rel="noreferrer">
                  <div><img src={image.image_url} alt={image.prompt || `생성 이미지 ${image.id}`} loading="lazy" /></div>
                  <p title={image.prompt || ''}>{image.prompt || 'Prompt 없음'}</p>
                </a>
              ))}
            </div>
            <div ref={sentinelRef} className="load-sentinel" aria-hidden={!loadingMore}>
              {loadingMore ? <span><FiLoader /> 다음 이미지를 불러오는 중</span>
                : nextCursor ? <span className="sr-only">더 많은 이미지가 있습니다.</span>
                  : <span>모든 이미지를 불러왔습니다.</span>}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
