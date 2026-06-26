import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query'

interface UseOptimisticMutationOptions<TData, TError, TVariables, TCacheItem> {
  mutationFn: (variables: TVariables) => Promise<TData>
  queryKey: QueryKey
  updater: (current: TCacheItem | undefined, variables: TVariables) => TCacheItem
  mutationOptions?: Omit<
    UseMutationOptions<TData, TError, TVariables, { snapshot: TCacheItem | undefined }>,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  >
}

export function useOptimisticMutation<TData, TError, TVariables, TCacheItem>({
  mutationFn,
  queryKey,
  updater,
  mutationOptions,
}: UseOptimisticMutationOptions<TData, TError, TVariables, TCacheItem>) {
  const qc = useQueryClient()

  return useMutation<TData, TError, TVariables, { snapshot: TCacheItem | undefined }>({
    mutationFn,
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<TCacheItem>(queryKey)
      qc.setQueryData<TCacheItem>(queryKey, (old) => updater(old, variables))
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context) qc.setQueryData<TCacheItem>(queryKey, context.snapshot)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey })
    },
    ...mutationOptions,
  })
}
