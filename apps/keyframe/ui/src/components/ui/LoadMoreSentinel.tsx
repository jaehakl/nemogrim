import { FiRefreshCw } from 'react-icons/fi'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import { Spinner } from './Spinner'
import './ui.css'

interface InfiniteQueryLike {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  fetchNextPage: () => unknown
}

interface LoadMoreSentinelProps {
  query: InfiniteQueryLike
  itemLabel: string
}

/** 무한 스크롤 목록의 끝. 화면에 가까워지면 다음 페이지를 불러오고 진행 상태를 알려준다. */
export function LoadMoreSentinel({ query, itemLabel }: LoadMoreSentinelProps) {
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query
  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    disabled: isFetchNextPageError,
  })

  return (
    <div ref={sentinelRef} className="load-sentinel">
      {isFetchingNextPage ? (
        <span role="status"><Spinner /> 다음 {itemLabel}을 불러오는 중</span>
      ) : isFetchNextPageError ? (
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => void fetchNextPage()}>
          <FiRefreshCw aria-hidden="true" /> 다음 {itemLabel} 다시 불러오기
        </button>
      ) : hasNextPage ? (
        <span className="sr-only">더 많은 {itemLabel}이 있습니다.</span>
      ) : (
        <span>모든 {itemLabel}을 불러왔습니다.</span>
      )}
    </div>
  )
}
