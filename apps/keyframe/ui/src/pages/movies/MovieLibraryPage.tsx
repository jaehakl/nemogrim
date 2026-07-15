import { useEffect, useRef } from 'react'
import { FiAlertCircle, FiCheckCircle, FiFilm, FiFolder, FiLoader, FiRefreshCw, FiX } from 'react-icons/fi'
import { AddMovieMenu } from './AddMovieMenu'
import { MovieCard } from './MovieCard'
import { useMovieLibrary } from './useMovieLibrary'
import './MovieLibraryPage.css'

export function MovieLibraryPage() {
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
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">VIDEO LIBRARY</p><h1>영상 라이브러리</h1>
          <p className="page-header__description">장면을 만들 영상을 추가하고 미디어 정보를 한곳에서 확인하세요.</p>
        </div>
        <AddMovieMenu importing={library.importing} onImport={(mode) => void library.handleImport(mode)} />
      </header>

      <section className="library-summary" aria-label="라이브러리 요약">
        <div><span className="library-summary__value">{library.total.toLocaleString('ko-KR')}</span><span>개의 영상</span></div>
        {library.processingCount > 0 ? (
          <div className="processing-chip" role="status"><FiLoader aria-hidden="true" />{library.processingCount.toLocaleString('ko-KR')}개 미리보기 처리 중</div>
        ) : (
          <div className="ready-chip"><FiCheckCircle aria-hidden="true" />모든 작업 완료</div>
        )}
      </section>

      {library.notice ? (
        <div className={`notice notice--${library.notice.tone}`} role={library.notice.tone === 'error' ? 'alert' : 'status'}>
          <span><strong>{library.notice.text}</strong>{library.notice.detail ? <small title={library.notice.detail}>{library.notice.detail}</small> : null}</span>
          <button type="button" onClick={() => library.setNotice(null)} aria-label="알림 닫기"><FiX aria-hidden="true" /></button>
        </div>
      ) : null}

      {library.loadingInitial ? (
        <div className="initial-loading" role="status"><FiLoader aria-hidden="true" /><span>영상 라이브러리를 불러오는 중입니다.</span></div>
      ) : library.error ? (
        <div className="state-panel state-panel--error" role="alert">
          <FiAlertCircle aria-hidden="true" /><h2>라이브러리를 불러오지 못했습니다</h2><p>{library.error}</p>
          <button type="button" className="secondary-button" onClick={() => void library.loadFirstPage()}><FiRefreshCw aria-hidden="true" /> 다시 시도</button>
        </div>
      ) : library.movies.length === 0 ? (
        <div className="state-panel state-panel--empty">
          <span className="state-panel__icon" aria-hidden="true"><FiFilm /></span><h2>아직 추가된 영상이 없습니다</h2>
          <p>파일 또는 폴더를 선택하면 새 영상만 자동으로 라이브러리에 등록됩니다.</p>
          <div className="empty-actions">
            <button type="button" className="primary-button" disabled={Boolean(library.importing)} onClick={() => void library.handleImport('files')}><FiFilm aria-hidden="true" /> 파일 선택</button>
            <button type="button" className="secondary-button" disabled={Boolean(library.importing)} onClick={() => void library.handleImport('folder')}><FiFolder aria-hidden="true" /> 폴더 선택</button>
          </div>
        </div>
      ) : (
        <>
          <section className="movie-grid" aria-label="영상 목록">{library.movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</section>
          <div ref={sentinelRef} className="load-sentinel" aria-hidden={!library.loadingMore}>
            {library.loadingMore ? <span><FiLoader aria-hidden="true" /> 다음 영상을 불러오는 중</span>
              : library.nextCursor ? <span className="sr-only">더 많은 영상이 있습니다.</span>
                : <span>모든 영상을 불러왔습니다.</span>}
          </div>
        </>
      )}
    </>
  )
}
