import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import { useOptimisticMutation } from '../../shared/hooks/useOptimisticMutation'
import type { GratitudeDay, GratitudeEntry, GratitudeMonth } from './types'

// --- Query -------------------------------------------------------------------
// Read-model do dia: {date, entries[]}. `params: date ? {date} : undefined` —
// ausência → o backend resolve para today_for(user) (autoridade temporal do
// servidor, AD-04). A superfície sempre passa uma data ISO explícita (default hoje).

async function fetchGratitudeDay(date?: string): Promise<GratitudeDay> {
  const response = await client.get<GratitudeDay>('/api/gratitude/days/', {
    params: date ? { date } : undefined,
  })
  return response.data
}

export function useGratitudeDayQuery(date?: string) {
  return useQuery({
    queryKey: keys.gratitude.day(date),
    queryFn: () => fetchGratitudeDay(date),
  })
}

// --- Query: histórico por mês (Story 9.2) ------------------------------------
// Read-model do mês: {month, days:[{date, entries[]}]}. `params: monthFirst ?
// {month} : undefined` — ausência → o backend resolve o mês corrente (today_for).
// Read-only puro (useQuery, sem otimismo). A visão "por data" reusa
// useGratitudeDayQuery (days/?date=) — sem query nova.

async function fetchGratitudeMonth(monthFirst?: string): Promise<GratitudeMonth> {
  const response = await client.get<GratitudeMonth>('/api/gratitude/months/', {
    params: monthFirst ? { month: monthFirst } : undefined,
  })
  return response.data
}

export function useGratitudeMonthQuery(monthFirst?: string) {
  return useQuery({
    queryKey: keys.gratitude.month(monthFirst),
    queryFn: () => fetchGratitudeMonth(monthFirst),
  })
}

// --- Mutation (append otimista) ----------------------------------------------
// Alta frequência de escrita no ritual da manhã → OTIMISTA (via useOptimisticMutation),
// molde do `useCreateTaskMutation` de bujo (features/bujo/api.ts): cria a entrada com id
// temporário `crypto.randomUUID()`, faz APPEND em `current.entries`, e reconcilia com o
// id real do servidor no `onSettled` (invalidação por chave). Erro → rollback do snapshot.

interface CreateGratitudeEntryVariables {
  text: string
  // Data selecionada no composer (também o corpo do POST e a data da entrada otimista).
  date: string
}

async function createGratitudeEntry({
  text,
  date,
}: CreateGratitudeEntryVariables): Promise<GratitudeEntry> {
  const response = await client.post<GratitudeEntry>('/api/gratitude/entries/', {
    text,
    date,
  })
  return response.data
}

export function useCreateGratitudeEntryMutation(date?: string) {
  return useOptimisticMutation<
    GratitudeEntry,
    unknown,
    CreateGratitudeEntryVariables,
    GratitudeDay
  >({
    mutationFn: createGratitudeEntry,
    queryKey: keys.gratitude.day(date),
    updater: (current, variables) => {
      if (!current) return current as unknown as GratitudeDay
      const optimistic: GratitudeEntry = {
        id: crypto.randomUUID(),
        date: variables.date,
        text: variables.text,
        createdAt: new Date().toISOString(),
      }
      return { ...current, entries: [...current.entries, optimistic] }
    },
  })
}
