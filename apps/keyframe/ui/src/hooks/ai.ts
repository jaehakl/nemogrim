import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAiStatus, warmupAi } from '../api/ai'
import { queryKeys } from '../api/queryKeys'

export function useAiStatus() {
  return useQuery({
    queryKey: queryKeys.ai.status,
    queryFn: getAiStatus,
    refetchInterval: (query) => (query.state.data?.state === 'loading' ? 2000 : 15_000),
  })
}

export function useWarmupAi() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: warmupAi,
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.ai.status, status)
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.status })
    },
  })
}
