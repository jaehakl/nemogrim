import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import {
  createMovieScene,
  deleteScene,
  getMovieScenes,
  getScene,
  getScenes,
  getSimilarScenes,
  retryScene,
} from '../api/scenes'
import type { ExplorerScene, Scene } from '../api/types'
import { isWorking } from '../lib/status'

const SCENE_POLL_MS = 2000
const FEED_POLL_MS = 3000

function sortByTimestamp(scenes: Scene[]): Scene[] {
  return [...scenes].sort((left, right) => left.timestamp_ms - right.timestamp_ms || left.id - right.id)
}

function anyWorking(scenes: Scene[] | undefined): boolean {
  return Boolean(scenes?.some((scene) => isWorking(scene.analysis_status)))
}

/** 검색어가 없으면 최신순 목록, 있으면 CLIP 검색 결과. 분석 중인 Scene이 보이면 목록을 갱신한다. */
export function useSceneFeed(query: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.scenes.feed(query),
    queryFn: ({ pageParam }) => getScenes(query, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    refetchInterval: (state) =>
      !query && state.state.data?.pages.some((page) => anyWorking(page.items)) ? FEED_POLL_MS : false,
  })
}

export function useScene(sceneId: number | null) {
  return useQuery({
    queryKey: queryKeys.scenes.detail(sceneId ?? -1),
    queryFn: () => getScene(sceneId as number),
    enabled: sceneId !== null,
    refetchInterval: (state) =>
      state.state.data && isWorking(state.state.data.analysis_status) ? SCENE_POLL_MS : false,
  })
}

/** 기준 Scene의 분석 상태가 키에 포함되어 있어 분석이 끝나면 자동으로 다시 조회한다. */
export function useSimilarScenes(scene: ExplorerScene | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.scenes.similar(scene?.id ?? -1, scene?.analysis_status ?? 'unknown'),
    queryFn: ({ pageParam }) => getSimilarScenes(scene!.id, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: Boolean(scene),
  })
}

export function useMovieScenes(movieId: number | null) {
  return useQuery({
    queryKey: queryKeys.movies.scenes(movieId ?? -1),
    queryFn: () => getMovieScenes(movieId as number),
    enabled: movieId !== null,
    refetchInterval: (state) => (anyWorking(state.state.data) ? SCENE_POLL_MS : false),
  })
}

export function useCreateScene(movieId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (timestampMs: number) => createMovieScene(movieId, timestampMs),
    onSuccess: (scene) => {
      queryClient.setQueryData<Scene[]>(queryKeys.movies.scenes(movieId), (current) =>
        current ? sortByTimestamp([...current.filter((item) => item.id !== scene.id), scene]) : current)
      void queryClient.invalidateQueries({ queryKey: queryKeys.movies.detail(movieId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.scenes.feeds() })
    },
  })
}

export function useRetryScene() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scene: Scene) => retryScene(scene.id),
    onSuccess: (scene) => {
      queryClient.setQueryData<Scene[]>(queryKeys.movies.scenes(scene.movie_file_id), (current) =>
        current?.map((item) => (item.id === scene.id ? scene : item)))
      void queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all })
    },
  })
}

export function useDeleteScene() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scene: Scene) => deleteScene(scene.id),
    onSuccess: (_result, scene) => {
      queryClient.setQueryData<Scene[]>(queryKeys.movies.scenes(scene.movie_file_id), (current) =>
        current?.filter((item) => item.id !== scene.id))
      void queryClient.invalidateQueries({ queryKey: queryKeys.movies.detail(scene.movie_file_id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.scenes.feeds() })
      // 삭제된 Scene 자신의 상세/유사 목록은 다시 조회하지 않는다(404).
      void queryClient.invalidateQueries({
        queryKey: queryKeys.scenes.similarAll(),
        predicate: (query) => query.queryKey[2] !== scene.id,
      })
    },
  })
}
