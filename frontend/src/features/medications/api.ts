import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { keys } from '../../api/keys'
import { useOptimisticMutation } from '../../shared/hooks/useOptimisticMutation'
import { deriveBlockStatus } from './dayModel'
import type {
  Doctor,
  DoseComponent,
  Medication,
  MedicationDay,
  MedicationScheduleVersion,
  MedicationSubstanceVersion,
  TimeBlock,
} from './types'

// --- Queries -----------------------------------------------------------------

async function fetchMedications(onDate?: string): Promise<Medication[]> {
  const response = await client.get<Medication[]>('/api/medications/', {
    params: onDate ? { onDate } : undefined,
  })
  return response.data
}

export function useMedicationsQuery(params?: { onDate?: string }) {
  return useQuery({
    queryKey: keys.medications.list(params),
    queryFn: () => fetchMedications(params?.onDate),
  })
}

async function fetchDoctors(): Promise<Doctor[]> {
  const response = await client.get<Doctor[]>('/api/doctors/')
  return response.data
}

export function useDoctorsQuery() {
  return useQuery({ queryKey: keys.medications.doctors(), queryFn: fetchDoctors })
}

async function fetchTimeBlocks(includeInactive: boolean): Promise<TimeBlock[]> {
  const response = await client.get<TimeBlock[]>(
    `/api/time-blocks/${includeInactive ? '?includeInactive=true' : ''}`,
  )
  return response.data
}

export function useTimeBlocksQuery(params?: { includeInactive?: boolean }) {
  const includeInactive = params?.includeInactive ?? false
  return useQuery({
    queryKey: keys.medications.timeBlocks(params),
    queryFn: () => fetchTimeBlocks(includeInactive),
  })
}

// --- Mutations ---------------------------------------------------------------
// Config-CRUD: useMutation + invalidateQueries pelo prefixo ['medications'] (sem
// otimismo — configuração não precisa, ao contrário de toggles de alta frequência
// como a confirmação diária da 8.2). O prefixo cobre list + doctors + timeBlocks.
//
// Divisão identidade-vs-versão (molde habits/api.ts): `title` = PATCH no recurso
// base; substância/agenda = POST em sub-recurso (`substance-versions/` /
// `schedule-versions/`) — cada mudança insere nova versão prospectiva (AD-07).

interface CreateMedicationVariables {
  title: string
  substanceName: string
  laboratory?: string | null
  prescribedById?: string | null
}

async function createMedication(fields: CreateMedicationVariables): Promise<Medication> {
  const response = await client.post<Medication>('/api/medications/', fields)
  return response.data
}

export function useCreateMedicationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createMedication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medications'] }),
  })
}

interface UpdateMedicationTitleVariables {
  medicationId: string
  title: string
}

async function updateMedicationTitle({
  medicationId,
  title,
}: UpdateMedicationTitleVariables): Promise<Medication> {
  const response = await client.patch<Medication>(`/api/medications/${medicationId}/`, {
    title,
  })
  return response.data
}

export function useUpdateMedicationTitleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMedicationTitle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medications'] }),
  })
}

interface AddSubstanceVersionVariables {
  medicationId: string
  substanceName?: string
  laboratory?: string | null
  prescribedById?: string | null
}

async function addSubstanceVersion({
  medicationId,
  ...fields
}: AddSubstanceVersionVariables): Promise<MedicationSubstanceVersion> {
  const response = await client.post<MedicationSubstanceVersion>(
    `/api/medications/${medicationId}/substance-versions/`,
    fields,
  )
  return response.data
}

export function useAddSubstanceVersionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addSubstanceVersion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medications'] }),
  })
}

interface SetScheduleVariables {
  medicationId: string
  timeBlockId: string
  // `dose` omitida = herda a vigente no backend (usado ao só desativar/reativar).
  dose?: DoseComponent[]
  active?: boolean
}

async function setSchedule({
  medicationId,
  ...fields
}: SetScheduleVariables): Promise<MedicationScheduleVersion> {
  const response = await client.post<MedicationScheduleVersion>(
    `/api/medications/${medicationId}/schedule-versions/`,
    fields,
  )
  return response.data
}

export function useSetScheduleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setSchedule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medications'] }),
  })
}

// Atalho de nível-medicamento (Decisão 5): "Desativar/Ativar" no Item Row aplica
// `active` em lote a todas as agendas dos blocos informados (prospectivo; dose
// herdada). O primitivo de backend é por-bloco, então o atalho itera via
// `schedule-versions/` — mesmo idioma do `overrideDayWorkday` de habits/api.ts.
interface SetMedicationActiveVariables {
  medicationId: string
  timeBlockIds: string[]
  active: boolean
}

async function setMedicationActive({
  medicationId,
  timeBlockIds,
  active,
}: SetMedicationActiveVariables): Promise<void> {
  await Promise.all(
    timeBlockIds.map((timeBlockId) =>
      client.post(`/api/medications/${medicationId}/schedule-versions/`, {
        timeBlockId,
        active,
      }),
    ),
  )
}

export function useSetMedicationActiveMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setMedicationActive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medications'] }),
  })
}

// --- Blocos de horário (AC2) -------------------------------------------------

interface CreateTimeBlockVariables {
  name: string
  displayOrder?: number
}

async function createTimeBlock(fields: CreateTimeBlockVariables): Promise<TimeBlock> {
  const response = await client.post<TimeBlock>('/api/time-blocks/', fields)
  return response.data
}

export function useCreateTimeBlockMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTimeBlock,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medications'] }),
  })
}

interface UpdateTimeBlockVariables {
  timeBlockId: string
  name?: string
  displayOrder?: number
  active?: boolean
}

async function updateTimeBlock({
  timeBlockId,
  ...fields
}: UpdateTimeBlockVariables): Promise<TimeBlock> {
  const response = await client.patch<TimeBlock>(
    `/api/time-blocks/${timeBlockId}/`,
    fields,
  )
  return response.data
}

export function useUpdateTimeBlockMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTimeBlock,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medications'] }),
  })
}

// --- Médicos (AC6) -----------------------------------------------------------

interface CreateDoctorVariables {
  name: string
  specialty?: string | null
}

async function createDoctor(fields: CreateDoctorVariables): Promise<Doctor> {
  const response = await client.post<Doctor>('/api/doctors/', fields)
  return response.data
}

export function useCreateDoctorMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDoctor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medications'] }),
  })
}

interface UpdateDoctorVariables {
  doctorId: string
  name?: string
  specialty?: string | null
}

async function updateDoctor({
  doctorId,
  ...fields
}: UpdateDoctorVariables): Promise<Doctor> {
  const response = await client.patch<Doctor>(`/api/doctors/${doctorId}/`, fields)
  return response.data
}

export function useUpdateDoctorMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateDoctor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medications'] }),
  })
}

// --- Superfície diária realizada (Story 8.2) ---------------------------------
// A confirmação diária é o "toggle de alta frequência" antevisto no comentário do
// bloco de mutations acima → OTIMISTA (via useOptimisticMutation), ao contrário do
// CRUD de config. O updater atualiza `confirmedAt` da(s) linha(s) e recomputa o
// `status` do bloco via `deriveBlockStatus` (cabeçalho reage antes do refetch). O
// endpoint devolve o read-model do dia; o cache reconcilia no onSettled (refetch).

async function fetchMedicationDay(date?: string): Promise<MedicationDay> {
  const response = await client.get<MedicationDay>('/api/medications/days/', {
    params: date ? { date } : undefined,
  })
  return response.data
}

export function useMedicationDayQuery(date?: string) {
  return useQuery({
    queryKey: keys.medications.day(date),
    queryFn: () => fetchMedicationDay(date),
  })
}

interface ConfirmEntryVariables {
  entryId: string
  confirmed: boolean
}

async function confirmEntry({
  entryId,
  confirmed,
}: ConfirmEntryVariables): Promise<MedicationDay> {
  const response = await client.patch<MedicationDay>(
    `/api/medications/days/${entryId}/`,
    { confirmed },
  )
  return response.data
}

export function useConfirmMedicationEntryMutation(date?: string) {
  return useOptimisticMutation<MedicationDay, unknown, ConfirmEntryVariables, MedicationDay>({
    mutationFn: confirmEntry,
    queryKey: keys.medications.day(date),
    updater: (current, { entryId, confirmed }) => {
      if (!current) return current as unknown as MedicationDay
      const nextConfirmedAt = confirmed ? new Date().toISOString() : null
      return {
        ...current,
        blocks: current.blocks.map((block) => {
          const entries = block.entries.map((entry) =>
            entry.id === entryId ? { ...entry, confirmedAt: nextConfirmedAt } : entry,
          )
          return { ...block, entries, status: deriveBlockStatus(entries) }
        }),
      }
    },
  })
}

interface ConfirmBlockVariables {
  date: string
  timeBlockId: string
  confirmed: boolean
}

async function confirmBlockRequest({
  date,
  timeBlockId,
  confirmed,
}: ConfirmBlockVariables): Promise<MedicationDay> {
  const response = await client.post<MedicationDay>(
    '/api/medications/days/confirm-block/',
    { date, timeBlockId, confirmed },
  )
  return response.data
}

export function useConfirmBlockMutation(date?: string) {
  return useOptimisticMutation<MedicationDay, unknown, ConfirmBlockVariables, MedicationDay>({
    mutationFn: confirmBlockRequest,
    queryKey: keys.medications.day(date),
    updater: (current, { timeBlockId, confirmed }) => {
      if (!current) return current as unknown as MedicationDay
      const nextConfirmedAt = confirmed ? new Date().toISOString() : null
      return {
        ...current,
        blocks: current.blocks.map((block) => {
          if (block.timeBlockId !== timeBlockId) return block
          const entries = block.entries.map((entry) => ({
            ...entry,
            confirmedAt: nextConfirmedAt,
          }))
          return { ...block, entries, status: deriveBlockStatus(entries) }
        }),
      }
    },
  })
}

interface CreateAdHocVariables {
  date: string
  medicationId: string
  timeBlockId?: string | null
  dose?: DoseComponent[]
}

async function createAdHoc(fields: CreateAdHocVariables): Promise<MedicationDay> {
  const response = await client.post<MedicationDay>('/api/medications/days/ad-hoc/', fields)
  return response.data
}

// Avulso não é otimista (não há id até o servidor responder): useMutation +
// invalidate da chave do dia (refetch traz a nova linha na seção PRN).
export function useCreateAdHocEntryMutation(date?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAdHoc,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keys.medications.day(date) }),
  })
}
