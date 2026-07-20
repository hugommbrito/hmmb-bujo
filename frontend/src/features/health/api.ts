import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import type {
  HealthDaily,
  HealthFieldDefinition,
  HealthFieldSeries,
  HealthFieldType,
  HealthHistory,
  HealthLog,
  HealthValue,
} from './types'

// --- Queries -----------------------------------------------------------------

async function fetchHealthFieldDefinitions(
  includeInactive: boolean,
): Promise<HealthFieldDefinition[]> {
  const response = await client.get<HealthFieldDefinition[]>(
    `/api/health-field-definitions/${includeInactive ? '?includeInactive=true' : ''}`,
  )
  return response.data
}

export function useHealthFieldDefinitionsQuery(params?: { includeInactive?: boolean }) {
  const includeInactive = params?.includeInactive ?? false
  return useQuery({
    queryKey: keys.health.fieldDefinitions(params),
    queryFn: () => fetchHealthFieldDefinitions(includeInactive),
  })
}

// --- Mutations ---------------------------------------------------------------
// Config-CRUD: useMutation + invalidateQueries por prefixo ['health'] (sem
// otimismo — configuração não precisa, ao contrário de toggles de alta frequência).

interface CreateHealthFieldVariables {
  name: string
  fieldType: HealthFieldType
  enumOptions?: string[]
  displayOrder?: number
}

async function createHealthField(
  fields: CreateHealthFieldVariables,
): Promise<HealthFieldDefinition> {
  const response = await client.post<HealthFieldDefinition>(
    '/api/health-field-definitions/',
    fields,
  )
  return response.data
}

export function useCreateHealthFieldMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createHealthField,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health'] }),
  })
}

interface UpdateHealthFieldVariables {
  fieldId: string
  name?: string
  enumOptions?: string[]
  displayOrder?: number
  active?: boolean
}

async function updateHealthField({
  fieldId,
  ...fields
}: UpdateHealthFieldVariables): Promise<HealthFieldDefinition> {
  const response = await client.patch<HealthFieldDefinition>(
    `/api/health-field-definitions/${fieldId}/`,
    fields,
  )
  return response.data
}

// Cobre edição de identidade/config (name/enumOptions/displayOrder) E
// desativar/reativar (active) — Saúde não versiona, então desativar é um PATCH
// {active} simples (sem sub-recurso versions/, ao contrário de hábitos).
export function useUpdateHealthFieldMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateHealthField,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health'] }),
  })
}

// --- Log diário do ritual (Story 7.2) ----------------------------------------
// Read-model ontem/hoje (GET) + upsert-merge por dia (PUT). Sem otimismo: o log
// tem save explícito por seção + confirmação inline "Dados de [ontem/hoje] salvos."
// (não é toggle de alta frequência como o tracker de hábitos).

async function fetchHealthDaily(): Promise<HealthDaily> {
  const response = await client.get<HealthDaily>('/api/health-logs/daily/')
  return response.data
}

export function useHealthDailyQuery() {
  return useQuery({
    queryKey: keys.health.daily(),
    queryFn: fetchHealthDaily,
  })
}

interface UpsertHealthLogVariables {
  date: string
  // `null` limpa a chave daquele campo no blob (o backend remove a chave; não grava
  // null). Por isso o valor é `HealthValue | null`, mais largo que `HealthValues`.
  values: Record<string, HealthValue | null>
}

async function upsertHealthLog({
  date,
  values,
}: UpsertHealthLogVariables): Promise<HealthLog> {
  // Body camelCase {date, values}; as chaves DINÂMICAS dentro de `values` (UUIDs)
  // NÃO são camelizadas (ignore_fields no backend + parser preserva o round-trip).
  const response = await client.put<HealthLog>('/api/health-logs/', { date, values })
  return response.data
}

export function useUpsertHealthLogMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: upsertHealthLog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health'] }),
  })
}

// --- Histórico read-only (Story 7.3) -----------------------------------------
// `useQuery` puro: a superfície é read-only, sem otimismo/prefetch (AD-14 não impõe
// NFR ao modo de revisão histórica). Mesmo idioma de useHabitHistoryQuery/Series (6.4).

interface HistoryRange {
  start: string
  end: string
}

async function fetchHealthHistory({ start, end }: HistoryRange): Promise<HealthHistory> {
  const response = await client.get<HealthHistory>('/api/health-logs/history/', {
    params: { start, end },
  })
  return response.data
}

export function useHealthHistoryQuery(range: HistoryRange) {
  return useQuery({
    queryKey: keys.health.history(range),
    queryFn: () => fetchHealthHistory(range),
  })
}

async function fetchHealthFieldSeries(
  fieldId: string,
  { start, end }: HistoryRange,
): Promise<HealthFieldSeries> {
  const response = await client.get<HealthFieldSeries>('/api/health-logs/series/', {
    params: { field: fieldId, start, end },
  })
  return response.data
}

export function useHealthFieldSeriesQuery(fieldId: string, range: HistoryRange) {
  return useQuery({
    queryKey: keys.health.series(fieldId, range),
    queryFn: () => fetchHealthFieldSeries(fieldId, range),
    // Só busca quando há um campo numérico selecionado (o seletor pode iniciar vazio).
    enabled: fieldId !== '',
  })
}
