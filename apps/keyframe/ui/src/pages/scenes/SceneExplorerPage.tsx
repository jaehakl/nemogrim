import { FiImage, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi'
import { Link, useSearchParams } from 'react-router-dom'
import { SceneTile } from '../../components/media/SceneTile'
import { LoadMoreSentinel } from '../../components/ui/LoadMoreSentinel'
import { Notice } from '../../components/ui/Notice'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatePanel } from '../../components/ui/StatePanel'
import { useAiStatus } from '../../hooks/ai'
import { useSceneFeed } from '../../hooks/scenes'
import { errorMessage } from '../../lib/errors'
import { formatCount } from '../../lib/format'

/** 검색어(`?q=`)가 없으면 최신 Scene, 있으면 CLIP 유사도 순 검색 결과를 보여준다. 검색 입력은 상단 바에 있다. */
export function SceneExplorerPage() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim()
  const feed = useSceneFeed(query)
  const ai = useAiStatus()
  const scenes = feed.data?.pages.flatMap((page) => page.items) ?? []
  const total = feed.data?.pages[0]?.total ?? 0
  const clipReady = ai.data?.models.clip.state === 'ready'

  return (
    <>
      <PageHeader
        eyebrow={query ? 'SEARCH' : 'SCENES'}
        title={query ? `“${query}”` : 'Scene 탐색'}
        description={query
          ? 'CLIP 이미지-텍스트 유사도가 높은 순서입니다. 영어 검색어가 가장 정확합니다.'
          : '저장한 장면을 최신순으로 둘러보세요. 상단 검색창(/ 키)으로 장면을 묘사해 찾을 수 있습니다.'}
        actions={query ? (
          <Link to="/scenes" className="btn btn--secondary"><FiX aria-hidden="true" /> 검색 초기화</Link>
        ) : null}
      >
        {feed.isSuccess ? (
          <div className="chip-row" role="status">
            <span className="chip">{formatCount(total)}개의 Scene{query ? ' 검색됨' : ''}</span>
          </div>
        ) : null}
      </PageHeader>

      {query && feed.isPending && !clipReady ? (
        <Notice
          tone="info"
          title="검색 모델을 준비하고 있습니다"
          description="첫 검색은 로컬 CLIP 모델을 불러오느라 시간이 걸릴 수 있습니다."
        />
      ) : null}

      {feed.isPending ? (
        <StatePanel kind="loading" title={query ? 'Scene을 검색하는 중입니다.' : 'Scene을 불러오는 중입니다.'} />
      ) : feed.isError ? (
        <StatePanel
          kind="error"
          title={query ? 'Scene 검색을 완료하지 못했습니다' : 'Scene을 불러오지 못했습니다'}
          description={errorMessage(feed.error)}
          actions={(
            <button type="button" className="btn btn--secondary" onClick={() => void feed.refetch()}>
              <FiRefreshCw aria-hidden="true" /> 다시 시도
            </button>
          )}
        />
      ) : scenes.length === 0 ? (
        <StatePanel
          kind="empty"
          icon={query ? <FiSearch aria-hidden="true" /> : <FiImage aria-hidden="true" />}
          title={query ? '일치하는 Scene이 없습니다' : '아직 생성된 Scene이 없습니다'}
          description={query
            ? '분석이 완료된 Scene만 검색됩니다. 다른 표현으로 다시 검색해 보세요.'
            : '영상 상세 페이지에서 원하는 위치의 Scene을 만들어 보세요.'}
          actions={query ? null : <Link to="/movies" className="btn btn--primary">영상 라이브러리로 이동</Link>}
        />
      ) : (
        <>
          <section className="tile-grid" aria-label="Scene 목록">
            {scenes.map((scene) => <SceneTile key={scene.id} scene={scene} />)}
          </section>
          <LoadMoreSentinel query={feed} itemLabel="Scene" />
        </>
      )}
    </>
  )
}
