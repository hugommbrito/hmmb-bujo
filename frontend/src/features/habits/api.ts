import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import { useOptimisticMutation } from '../../shared/hooks/useOptimisticMutation'
import type {
  GroupMultipliers,
  Habit,
  HabitDay,
  HabitDayEntry,
  HabitGroup,
  HabitHistoryRange,
  HabitSeries,
  HabitType,
  HabitVersion,
  HolidayResult,
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

// --- Histórico read-only (Story 6.4) -----------------------------------------
// `useQuery` puro: a superfície é read-only, sem otimismo/prefetch (AD-14 não
// impõe NFR ao modo de revisão histórica).

interface HistoryRange {
  start: string
  end: string
}

async function fetchHabitHistory({ start, end }: HistoryRange): Promise<HabitHistoryRange> {
  const response = await client.get<HabitHistoryRange>('/api/habits/history/', {
    params: { start, end },
  })
  return response.data
}

export function useHabitHistoryQuery(range: HistoryRange) {
  return useQuery({
    queryKey: keys.habits.history(range),
    queryFn: () => fetchHabitHistory(range),
  })
}

async function fetchHabitSeries(
  habitId: string,
  { start, end }: HistoryRange,
): Promise<HabitSeries> {
  const response = await client.get<HabitSeries>(`/api/habits/${habitId}/series/`, {
    params: { start, end },
  })
  return response.data
}

export function useHabitSeriesQuery(habitId: string, range: HistoryRange) {
  return useQuery({
    queryKey: keys.habits.series(habitId, range),
    queryFn: () => fetchHabitSeries(habitId, range),
    // Só busca quando há um hábito selecionado (o seletor pode iniciar vazio).
    enabled: habitId !== '',
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

// --- Story 6.3 — multiplicador por tipo de dia + feriado ---------------------

async function fetchGroupMultipliers(groupId: string): Promise<GroupMultipliers> {
  const response = await client.get<GroupMultipliers>(
    `/api/habit-groups/${groupId}/multipliers/`,
  )
  return response.data
}

export function useGroupMultipliersQuery(groupId: string) {
  return useQuery({
    queryKey: keys.habits.groupMultipliers(groupId),
    queryFn: () => fetchGroupMultipliers(groupId),
  })
}

interface SetGroupMultipliersVariables {
  groupId: string
  weekend?: string | null
  holiday?: string | null
}

async function setGroupMultipliers({
  groupId,
  ...fields
}: SetGroupMultipliersVariables): Promise<GroupMultipliers> {
  const response = await client.put<GroupMultipliers>(
    `/api/habit-groups/${groupId}/multipliers/`,
    fields,
  )
  return response.data
}

// Config prospectiva (AC1). Invalida ['habits'] no sucesso — cobre a query de
// config e o tracker (os % recalculam no backend só para dias abertos daqui em diante).
export function useSetGroupMultipliersMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setGroupMultipliers,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  })
}

// Toggle de feriado otimista (AC1/AC3): flipa `dayType` do dia na hora; os %
// e os multiplierAtTime das linhas reconciliam no onSettled (invalidate → refetch).
interface SetHolidayVariables {
  date: string
  isHoliday: boolean
}

async function setHoliday({ date, isHoliday }: SetHolidayVariables): Promise<HolidayResult> {
  const response = await client.post<HolidayResult>('/api/habits/holidays/', {
    date,
    isHoliday,
  })
  return response.data
}

export function useSetHolidayMutation(date?: string) {
  return useOptimisticMutation<HolidayResult, unknown, SetHolidayVariables, HabitDay>({
    mutationFn: setHoliday,
    queryKey: keys.habits.day(date),
    updater: (current, { isHoliday }) => {
      if (!current) return current as unknown as HabitDay
      return { ...current, dayType: isHoliday ? 'holiday' : 'weekday' }
    },
  })
}

// Override avulso de dia (AC3): "tratar este dia como dia útil (peso cheio)" —
// seta multiplierAtTime = 1.0 em cada linha do dia. Primitivo de backend é
// por-linha; o controle de dia itera via o PATCH de entry existente.
async function overrideDayWorkday(entryIds: string[]): Promise<void> {
  await Promise.all(
    entryIds.map((id) =>
      client.patch(`/api/habits/days/${id}/`, { multiplierAtTime: '1.00' }),
    ),
  )
}

export function useOverrideDayWorkdayMutation(date?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: overrideDayWorkday,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keys.habits.day(date) }),
  })
}
