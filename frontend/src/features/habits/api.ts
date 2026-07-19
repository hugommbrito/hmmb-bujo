import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import { useOptimisticMutation } from '../../shared/hooks/useOptimisticMutation'
import type {
  Habit,
  HabitDay,
  HabitDayEntry,
  HabitGroup,
  HabitType,
  HabitVersion,
} from './types'

// --- Queries -----------------------------------------------------------------

async function fetchHabits(includeInactive: boolean): Promise<Habit[]> {
  const response = await client.get<Habit[]>(
    `/api/habits/${includeInactive ? '?includeInactive=true' : ''}`,
  )
  return response.data
}

export function useHabitsQuery(params?: { includeInactive?: boolean }) {
  const includeInactive = params?.includeInactive ?? false
  return useQuery({
    queryKey: keys.habits.list(params),
    queryFn: () => fetchHabits(includeInactive),
  })
}

async function fetchHabitGroups(): Promise<HabitGroup[]> {
  const response = await client.get<HabitGroup[]>('/api/habit-groups/')
  return response.data
}

export function useHabitGroupsQuery() {
  return useQuery({ queryKey: keys.habits.groups(), queryFn: fetchHabitGroups })
}

// --- Tracker do dia (Story 6.2) ----------------------------------------------

async function fetchHabitDay(date?: string): Promise<HabitDay> {
  const response = await client.get<HabitDay>('/api/habits/days/', {
    params: date ? { date } : undefined,
  })
  return response.data
}

export function useHabitDayQuery(date?: string) {
  return useQuery({
    queryKey: keys.habits.day(date),
    queryFn: () => fetchHabitDay(date),
  })
}

// --- Mutations ---------------------------------------------------------------
// Escrita = useMutation + invalidateQueries por prefixo (sem otimismo — a story
// 6.1 não o exige). O prefixo ['habits'] cobre tanto a lista quanto os grupos.

interface CreateHabitVariables {
  name: string
  emoticon?: string
  unit?: string
  group: string
  type: HabitType
  weight: string
  meta?: string | null
  bonus?: string | null
}

async function createHabit(fields: CreateHabitVariables): Promise<Habit> {
  const response = await client.post<Habit>('/api/habits/', fields)
  return response.data
}

export function useCreateHabitMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createHabit,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  })
}

interface UpdateHabitIdentityVariables {
  habitId: string
  name?: string
  emoticon?: string
  unit?: string
  group?: string
}

async function updateHabitIdentity({
  habitId,
  ...fields
}: UpdateHabitIdentityVariables): Promise<Habit> {
  const response = await client.patch<Habit>(`/api/habits/${habitId}/`, fields)
  return response.data
}

export function useUpdateHabitIdentityMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateHabitIdentity,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  })
}

interface AddHabitVersionVariables {
  habitId: string
  weight?: string
  meta?: string | null
  bonus?: string | null
  active?: boolean
}

async function addHabitVersion({
  habitId,
  ...fields
}: AddHabitVersionVariables): Promise<HabitVersion> {
  const response = await client.post<HabitVersion>(`/api/habits/${habitId}/versions/`, fields)
  return response.data
}

export function useAddHabitVersionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addHabitVersion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  })
}

interface CreateHabitGroupVariables {
  name: string
}

async function createHabitGroup(fields: CreateHabitGroupVariables): Promise<HabitGroup> {
  const response = await client.post<HabitGroup>('/api/habit-groups/', fields)
  return response.data
}

export function useCreateHabitGroupMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createHabitGroup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  })
}

// Marcação otimista do tracker (AC2): a UI atualiza o `value` da linha antes do
// servidor; rollback em erro. `totalCompletion`/`groups[].completion` vêm
// calculados do backend e reconciliam no onSettled (invalidate → refetch) —
// o % pisca para o valor correto após o servidor. Espelha useTransitionTaskMutation.
interface MarkHabitEntryVariables {
  entryId: string
  value: string | null
}

async function markHabitEntry({
  entryId,
  value,
}: MarkHabitEntryVariables): Promise<HabitDayEntry> {
  const response = await client.patch<HabitDayEntry>(`/api/habits/days/${entryId}/`, { value })
  return response.data
}

export function useMarkHabitEntryMutation(date?: string) {
  return useOptimisticMutation<HabitDayEntry, unknown, MarkHabitEntryVariables, HabitDay>({
    mutationFn: markHabitEntry,
    queryKey: keys.habits.day(date),
    updater: (current, { entryId, value }) => {
      if (!current) return current as unknown as HabitDay
      return {
        ...current,
        entries: current.entries.map((entry) =>
          entry.id === entryId ? { ...entry, value } : entry,
        ),
      }
    },
  })
}
