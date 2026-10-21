import { FiCheckCircle, FiFilm, FiFolder, FiRefreshCw } from 'react-icons/fi'
import type { ImportMode } from '../../api/movies'
import { MovieCard } from '../../components/media/MovieCard'
import { LoadMoreSentinel } from '../../components/ui/LoadMoreSentinel'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { StatePanel } from '../../components/ui/StatePanel'
import { useToast } from '../../components/ui/toastContext'
import { useImportMovies, useMovieLibrary } from '../../hooks/movies'
import { errorMessage } from '../../lib/errors'
import { formatCount } from '../../lib/format'
import { AddMovieMenu } from './AddMovieMenu'

export function MovieLibraryPage() {
  const library = useMovieLibrary()
  const importer = useImportMovies()
  const notify = useToast()

  const movies = library.data?.pages.flatMap((page) => page.items) ?? []
  const firstPage = library.data?.pages[0]
  const importing = importer.isPending ? importer.variables : null

  function startImport(mode: ImportMode) {
    importer.mutate(mode, {
      onSuccess: (result) => {
        if (result.cancelled) {
          notify({ tone: 'neutral', title: '영상 추가를 취소했습니다.' })
          return
        }
        notify({
          tone: result.failed_count ? 'warning' : 'success',
          title: `새 영상 ${result.added_count}개 · 중복 ${result.duplicate_count}개 · 실패 ${result.failed_count}개`,
          description: result.failures[0],
        })
      },
      onError: (error) => notify({ tone: 'danger', title: '영상을 추가하지 못했습니다', description: errorMessage(error) }),
    })
  }

  return (
    <>
      <PageHeader
        eyebrow="LIBRARY"
        title="영상 라이브러리"
        description="장면을 만들 영상을 추가하세요. 원본 파일은 이동하거나 복사하지 않습니다."
        actions={<AddMovieMenu importing={importing ?? null} onImport={startImport} />}
      >
        {firstPage ? (
          <div className="chip-row" aria-label="라이브러리 요약">
            <span className="chip"><FiFilm aria-hidden="true" />{formatCount(firstPage.total)}개의 영상</span>
            {firstPage.processing_count > 0 ? (
              <span className="chip" role="status"><Spinner />{formatCount(firstPage.processing_count)}개 미리보기 처리 중</span>
            ) : (
              <span className="chip"><FiCheckCircle aria-hidden="true" />모든 작업 완료</span>
            )}
          </div>
        ) : null}
      </PageHeader>

      {library.isPending ? (
        <StatePanel kind="loading" title="영상 라이브러리를 불러오는 중입니다." />
      ) : library.isError ? (
        <StatePanel
          kind="error"
          title="라이브러리를 불러오지 못했습니다"
          description={errorMessage(library.error)}
          actions={(
            <button type="button" className="btn btn--secondary" onClick={() => void library.refetch()}>
              <FiRefreshCw aria-hidden="true" /> 다시 시도
            </button>
          )}
        />
      ) : movies.length === 0 ? (
        <StatePanel
          kind="empty"
          icon={<FiFilm aria-hidden="true" />}
          title="아직 추가된 영상이 없습니다"
          description="파일 또는 폴더를 선택하면 새 영상만 자동으로 라이브러리에 등록됩니다."
          actions={(
            <>
              <button type="button" className="btn btn--primary" disabled={importer.isPending} onClick={() => startImport('files')}>
                <FiFilm aria-hidden="true" /> 파일 선택
              </button>
              <button type="button" className="btn btn--secondary" disabled={importer.isPending} onClick={() => startImport('folder')}>
                <FiFolder aria-hidden="true" /> 폴더 선택
              </button>
            </>
          )}
        />
      ) : (
        <>
          <section className="poster-grid" aria-label="영상 목록">
            {movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
          </section>
          <LoadMoreSentinel query={library} itemLabel="영상" />
        </>
      )}
    </>
  )
}
