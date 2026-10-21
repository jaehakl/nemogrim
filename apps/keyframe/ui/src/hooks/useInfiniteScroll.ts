import { useEffect, useState } from 'react'

interface InfiniteScrollOptions {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
  disabled?: boolean
  rootMargin?: string
}

/** 반환한 ref를 목록 끝의 sentinel 요소에 붙이면 화면에 가까워질 때 다음 페이지를 불러온다. */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  disabled = false,
  rootMargin = '320px 0px',
}: InfiniteScrollOptions) {
  const [node, setNode] = useState<Element | null>(null)

  useEffect(() => {
    if (!node || !hasNextPage || isFetchingNextPage || disabled) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void fetchNextPage() },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [disabled, fetchNextPage, hasNextPage, isFetchingNextPage, node, rootMargin])

  return setNode
}
