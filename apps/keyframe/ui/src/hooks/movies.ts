import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMovies, getPlayableMovie, importMovies } from '../api/movies'
import { queryKeys } from '../api/queryKeys'

const PROCESSING_POLL_MS = 2000

export function useMovieLibrary() {
  return useInfiniteQuery({
    queryKey: queryKeys.movies.list(),
    queryFn: ({ pageParam }) => getMovies(pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    refetchInterval: (query) =>
      query.state.data?.pages[0]?.processing_count ? PROCESSING_POLL_MS : false,
  })
}

export function usePlayableMovie(movieId: number | null) {
  return useQuery({
    queryKey: queryKeys.movies.detail(movieId ?? -1),
    queryFn: () => getPlayableMovie(movieId as number),
    enabled: movieId !== null,
  })
}

export function useImportMovies() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importMovies,
    onSuccess: (result) => {
      if (!result.cancelled) void queryClient.invalidateQueries({ queryKey: queryKeys.movies.list() })
    },
  })
}
