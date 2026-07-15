import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { FiAlertCircle, FiImage, FiLoader, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi'
import { type ExplorerScene, getScenes } from '../../api/scenes'
import { SceneTile } from '../../components/scene/SceneTile'
import './SceneExplorerPage.css'

export function SceneExplorerPage() {
  const [draftQuery, setDraftQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [scenes, setScenes] = useState<ExplorerScene[]>([])
  const [total, setTotal] = useState(0)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const requestGenerationRef = useRef(0)
  const loadingMoreRef = useRef(false)

  const loadFirstPage = useCallback(async (query: string) => {
    const generation = ++requestGenerationRef.current
    setSubmittedQuery(query)
    setScenes([])
    setTotal(0)
    setNextOffset(null)
    setError(null)
    setLoadingInitial(true)
    loadingMoreRef.current = false
    setLoadingMore(false)
    try {
      const response = await getScenes(query, 0)
      if (requestGenerationRef.current !== generation) return
      setScenes(response.items)
      setTotal(response.total)
      setNextOffset(response.next_offset)
    } catch (loadError) {
      if (requestGenerationRef.current !== generation) return
      setError(loadError instanceof Error ? loadError.message : 'Scene을 불러오지 못했습니다.')
    } finally {
      if (requestGenerationRef.current === generation) setLoadingInitial(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loadingMoreRef.current) return
    const generation = requestGenerationRef.current
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const response = await getScenes(submittedQuery, nextOffset)
      if (requestGenerationRef.current !== generation) return
      setScenes((current) => [...current, ...response.items])
      setTotal(response.total)
      setNextOffset(response.next_offset)
    } catch (loadError) {
      if (requestGenerationRef.current !== generation) return
      setError(loadError instanceof Error ? loadError.message : '다음 Scene을 불러오지 못했습니다.')
    } finally {
      if (requestGenerationRef.current === generation) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
    }
  }, [nextOffset, submittedQuery])

  useEffect(() => { void loadFirstPage('') }, [loadFirstPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || nextOffset === null || loadingInitial) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore() },
      { rootMargin: '320px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, loadingInitial, nextOffset])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = draftQuery.trim()
    setDraftQuery(query)
    void loadFirstPage(query)
  }

  function clearSearch() {
    setDraftQuery('')
    void loadFirstPage('')
  }

  const emptySearch = Boolean(submittedQuery)
  return (
    <div className="scene-explorer-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SCENE EXPLORER</p>
          <h1>Scene 탐색</h1>
          <p className="page-header__description">저장된 장면을 둘러보거나 CLIP 이미지 임베딩으로 비슷한 Scene을 찾으세요.</p>
        </div>
      </header>

      <form className="scene-search" role="search" onSubmit={handleSubmit}>
        <FiSearch aria-hidden="true" />
        <label className="sr-only" htmlFor="scene-search-query">Scene 검색어</label>
        <input
          id="scene-search-query"
          value={draftQuery}
          maxLength={500}
          placeholder="예: sunset over the ocean"
          onChange={(event) => setDraftQuery(event.target.value)}
        />
        {submittedQuery ? (
          <button type="button" className="scene-search__clear" onClick={clearSearch} aria-label="검색 초기화">
            <FiX aria-hidden="true" />
          </button>
        ) : null}
        <button type="submit" className="primary-button" disabled={loadingInitial}>
          {loadingInitial && submittedQuery ? <FiLoader className="button-spinner" aria-hidden="true" /> : <FiSearch aria-hidden="true" />}
          검색
        </button>
      </form>

      {!loadingInitial && !error ? (
        <div className="scene-explorer-summary" role="status">
          <strong>{total.toLocaleString('ko-KR')}</strong>개의 Scene
          {submittedQuery ? <span>“{submittedQuery}” 검색 결과</span> : <span>최신순</span>}
        </div>
      ) : null}

      {loadingInitial ? (
        <div className="initial-loading" role="status"><FiLoader aria-hidden="true" /><span>Scene을 불러오는 중입니다.</span></div>
      ) : error ? (
        <div className="state-panel state-panel--error" role="alert">
          <FiAlertCircle aria-hidden="true" />
          <h2>{submittedQuery ? 'Scene 검색을 완료하지 못했습니다' : 'Scene을 불러오지 못했습니다'}</h2>
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => void loadFirstPage(submittedQuery)}>
            <FiRefreshCw aria-hidden="true" /> 다시 시도
          </button>
        </div>
      ) : scenes.length === 0 ? (
        <div className="state-panel state-panel--empty">
          <span className="state-panel__icon" aria-hidden="true">{emptySearch ? <FiSearch /> : <FiImage />}</span>
          <h2>{emptySearch ? '일치하는 Scene이 없습니다' : '아직 생성된 Scene이 없습니다'}</h2>
          <p>{emptySearch ? '다른 영어 검색어로 다시 검색해 보세요. 분석이 완료된 Scene만 검색할 수 있습니다.' : '영상 상세 페이지에서 원하는 위치의 Scene을 생성하세요.'}</p>
        </div>
      ) : (
        <>
          <section className="scene-explorer-grid" aria-label="Scene 목록">
            {scenes.map((scene) => <SceneTile key={scene.id} scene={scene} />)}
          </section>
          <div ref={sentinelRef} className="load-sentinel" aria-hidden={!loadingMore}>
            {loadingMore ? <span><FiLoader aria-hidden="true" /> 다음 Scene을 불러오는 중</span>
              : nextOffset !== null ? <span className="sr-only">더 많은 Scene이 있습니다.</span>
                : <span>모든 Scene을 불러왔습니다.</span>}
          </div>
        </>
      )}
    </div>
  )
}
