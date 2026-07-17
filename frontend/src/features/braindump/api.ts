import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import { useAuth } from '../auth'
import { useOptimisticMutation } from '../../shared/hooks/useOptimisticMutation'
import type { BrainDumpCount, BrainDumpItem, BrainDumpTargetLog } from './types'

async function fetchBrainDumpItems(): Promise<BrainDumpItem[]> {
  const response = await client.get<BrainDumpItem[]>('/api/brain-dump/items/')
  return response.data
}

export function useBrainDumpItemsQuery() {
  return useQuery({ queryKey: keys.brainDump.list(), queryFn: fetchBrainDumpItems })
}

async function fetchBrainDumpCount(): Promise<BrainDumpCount> {
  const response = await client.get<BrainDumpCount>('/api/brain-dump/count/')
  return response.data
}

export function useBrainDumpCountQuery() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: keys.brainDump.count(userId ?? ''),
    queryFn: fetchBrainDumpCount,
    enabled: !!userId,
  })
}

interface CreateBrainDumpItemVariables {
  title: string
  description?: string | null
  targetLog?: BrainDumpTargetLog | null
}

async function createBrainDumpItem(fields: CreateBrainDumpItemVariables): Promise<BrainDumpItem> {
  const response = await client.post<BrainDumpItem>('/api/brain-dump/items/', fields)
  return response.data
}

export function useCreateBrainDumpItemMutation() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  return useOptimisticMutation<BrainDumpItem, unknown, CreateBrainDumpItemVariables, BrainDumpCount>({
    mutationFn: createBrainDumpItem,
    queryKey: keys.brainDump.count(userId ?? ''),
    updater: (current) => ({ count: (current?.count ?? 0) + 1 }),
    mutationOptions: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.brainDump.list() }),
    },
  })
}

interface ProcessBrainDumpItemVariables {
  itemId: string
  destination: 'today' | 'week' | 'month' | 'future'
  monthFirst?: string
  scheduledDate?: string | null
}

async function processBrainDumpItem({ itemId, ...fields }: ProcessBrainDumpItemVariables) {
  const response = await client.post(`/api/brain-dump/items/${itemId}/process/`, fields)
  return response.data
}

export function useProcessBrainDumpItemMutation() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  return useMutation({
    mutationFn: processBrainDumpItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.brainDump.list() })
      queryClient.invalidateQueries({ queryKey: keys.brainDump.count(userId ?? '') })
      // Container de destino é escolhido em tempo de processamento (pode ser
      // qualquer um dos 3) — invalidação por prefixo nas 3 chaves de log,
      // mesmo padrão de useDeleteTaskMutation (features/bujo/api.ts).
      queryClient.invalidateQueries({ queryKey: ['bujo', 'dailyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'monthlyLog'] })
      queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })
    },
  })
}

interface DiscardBrainDumpItemVariables {
  itemId: string
}

async function discardBrainDumpItem({ itemId }: DiscardBrainDumpItemVariables): Promise<void> {
  await client.delete(`/api/brain-dump/items/${itemId}/`)
}

export function useDiscardBrainDumpItemMutation() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  return useMutation({
    mutationFn: discardBrainDumpItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.brainDump.list() })
      queryClient.invalidateQueries({ queryKey: keys.brainDump.count(userId ?? '') })
    },
  })
}
