import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import type { Habit, HabitGroup, HabitType, HabitVersion } from './types'

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

// --- Mutations ---------------------------------------------------------------
// Escrita = useMutation + invalidateQueries por prefixo (sem otimismo — a story
// 6.1 não o exige). O prefixo ['habits'] cobre tanto a lista quanto os grupos.

interface CreateHabitVariables {
  name: string
  emoticon?: string
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
