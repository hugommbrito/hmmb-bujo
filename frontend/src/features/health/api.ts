import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import type { HealthFieldDefinition, HealthFieldType } from './types'

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
