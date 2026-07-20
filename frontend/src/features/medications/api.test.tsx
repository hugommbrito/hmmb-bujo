import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import {
  useAddSubstanceVersionMutation,
  useConfirmBlockMutation,
  useConfirmMedicationEntryMutation,
  useCreateAdHocEntryMutation,
  useCreateDoctorMutation,
  useCreateMedicationMutation,
  useCreateTimeBlockMutation,
  useDoctorsQuery,
  useMedicationDayQuery,
  useMedicationsQuery,
  useSetMedicationActiveMutation,
  useSetScheduleMutation,
  useTimeBlocksQuery,
  useUpdateMedicationTitleMutation,
} from './api'
import { keys } from '../../api/keys'
import type { Doctor, Medication, MedicationDay, TimeBlock } from './types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPatch = client.patch as ReturnType<typeof vi.fn>

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  }
}

const MED: Medication = {
  id: 'med-1',
  title: 'Remédio de pressão',
  active: true,
  substance: {
    id: 'sub-1',
    medication: 'med-1',
    substanceName: 'Losartana',
    laboratory: 'EMS',
    prescribedBy: null,
    effectiveFrom: '2026-07-20',
  },
  schedules: [],
}

const DOCTOR: Doctor = { id: 'doc-1', name: 'Dra. Ana', specialty: 'Cardiologia' }
const BLOCK: TimeBlock = { id: 'blk-1', name: 'Manhã', displayOrder: 0, active: true }

describe('useMedicationsQuery', () => {
  beforeEach(() => vi.resetAllMocks())

  it('busca a lista de medicamentos', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: [MED] })

    const { result } = renderHook(() => useMedicationsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/medications/', { params: undefined })
    expect(result.current.data).toEqual([MED])
  })

  it('passa onDate quando informado', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: [MED] })

    const { result } = renderHook(() => useMedicationsQuery({ onDate: '2026-07-20' }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/medications/', {
      params: { onDate: '2026-07-20' },
    })
  })
})

describe('useDoctorsQuery / useTimeBlocksQuery', () => {
  beforeEach(() => vi.resetAllMocks())

  it('busca médicos em /api/doctors/', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: [DOCTOR] })
    const { result } = renderHook(() => useDoctorsQuery(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/doctors/')
  })

  it('busca blocos ativos por padrão e inclui inativos com a flag', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValue({ data: [BLOCK] })
    const { result, rerender } = renderHook(
      ({ inactive }: { inactive: boolean }) =>
        useTimeBlocksQuery({ includeInactive: inactive }),
      { wrapper, initialProps: { inactive: false } },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/time-blocks/')

    rerender({ inactive: true })
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/time-blocks/?includeInactive=true'),
    )
  })
})

describe('useCreateMedicationMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('envia o payload camelCase e invalida o prefixo medications', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({ data: MED })

    const { result } = renderHook(() => useCreateMedicationMutation(), { wrapper })
    result.current.mutate({
      title: 'Remédio de pressão',
      substanceName: 'Losartana',
      laboratory: 'EMS',
      prescribedById: 'doc-1',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/medications/', {
      title: 'Remédio de pressão',
      substanceName: 'Losartana',
      laboratory: 'EMS',
      prescribedById: 'doc-1',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['medications'] })
  })
})

describe('useUpdateMedicationTitleMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('faz PATCH do título no recurso base (identidade)', async () => {
    const { wrapper } = makeWrapper()
    mockPatch.mockResolvedValueOnce({ data: { ...MED, title: 'Novo' } })

    const { result } = renderHook(() => useUpdateMedicationTitleMutation(), { wrapper })
    result.current.mutate({ medicationId: 'med-1', title: 'Novo' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/api/medications/med-1/', { title: 'Novo' })
  })
})

describe('useAddSubstanceVersionMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('faz POST no sub-recurso substance-versions/', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({ data: MED.substance })

    const { result } = renderHook(() => useAddSubstanceVersionMutation(), { wrapper })
    result.current.mutate({ medicationId: 'med-1', substanceName: 'Novo', laboratory: null })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/medications/med-1/substance-versions/', {
      substanceName: 'Novo',
      laboratory: null,
    })
  })
})

describe('useSetScheduleMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('faz POST no sub-recurso schedule-versions/ com dose multi-componente', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({ data: {} })

    const { result } = renderHook(() => useSetScheduleMutation(), { wrapper })
    result.current.mutate({
      medicationId: 'med-1',
      timeBlockId: 'blk-1',
      dose: [{ label: '', amount: 1, unit: 'comp' }],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Chaves da dose (palavra única) preservadas no body — sem camelização.
    expect(mockPost).toHaveBeenCalledWith('/api/medications/med-1/schedule-versions/', {
      timeBlockId: 'blk-1',
      dose: [{ label: '', amount: 1, unit: 'comp' }],
    })
  })

  it('desativa uma agenda com active:false (sem dose)', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({ data: {} })

    const { result } = renderHook(() => useSetScheduleMutation(), { wrapper })
    result.current.mutate({ medicationId: 'med-1', timeBlockId: 'blk-1', active: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/medications/med-1/schedule-versions/', {
      timeBlockId: 'blk-1',
      active: false,
    })
  })
})

describe('useSetMedicationActiveMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('aplica active em lote a cada bloco (Promise.all)', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValue({ data: {} })

    const { result } = renderHook(() => useSetMedicationActiveMutation(), { wrapper })
    result.current.mutate({
      medicationId: 'med-1',
      timeBlockIds: ['blk-1', 'blk-2'],
      active: false,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/medications/med-1/schedule-versions/', {
      timeBlockId: 'blk-1',
      active: false,
    })
    expect(mockPost).toHaveBeenCalledWith('/api/medications/med-1/schedule-versions/', {
      timeBlockId: 'blk-2',
      active: false,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['medications'] })
  })
})

describe('useCreateTimeBlockMutation / useCreateDoctorMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('cria bloco e invalida medications', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({ data: BLOCK })
    const { result } = renderHook(() => useCreateTimeBlockMutation(), { wrapper })
    result.current.mutate({ name: 'Manhã' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/time-blocks/', { name: 'Manhã' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['medications'] })
  })

  it('cria médico', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({ data: DOCTOR })
    const { result } = renderHook(() => useCreateDoctorMutation(), { wrapper })
    result.current.mutate({ name: 'Dra. Ana', specialty: 'Cardiologia' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/doctors/', {
      name: 'Dra. Ana',
      specialty: 'Cardiologia',
    })
  })
})

// --- Story 8.2 — superfície diária realizada -------------------------------

const DAY: MedicationDay = {
  date: '2026-03-01',
  blocks: [
    {
      timeBlockId: 'b1',
      timeBlockName: 'Manhã',
      status: 'pending',
      entries: [
        {
          id: 'e1',
          medicationId: 'm1',
          medicationTitle: 'Losartana',
          substanceName: 'Losartana K',
          doseAtTime: [{ label: '', amount: 50, unit: 'mg' }],
          confirmedAt: null,
          source: 'scheduled',
          timeBlockId: 'b1',
        },
      ],
    },
  ],
  adHoc: [],
}

describe('useMedicationDayQuery', () => {
  beforeEach(() => vi.resetAllMocks())

  it('busca o dia sem params (hoje)', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: DAY })
    const { result } = renderHook(() => useMedicationDayQuery(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/medications/days/', { params: undefined })
    expect(result.current.data).toEqual(DAY)
  })

  it('passa date quando informado', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: DAY })
    renderHook(() => useMedicationDayQuery('2026-03-01'), { wrapper })
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/medications/days/', {
        params: { date: '2026-03-01' },
      }),
    )
  })
})

describe('mutações otimistas do dia (AC4)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('confirm entry faz PATCH e aplica update otimista no cache', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.medications.day(undefined), DAY)
    mockPatch.mockResolvedValueOnce({ data: DAY })
    const { result } = renderHook(() => useConfirmMedicationEntryMutation(), { wrapper })

    result.current.mutate({ entryId: 'e1', confirmed: true })

    // Otimismo aplicado no onMutate (antes do await do servidor).
    await waitFor(() => {
      const cached = qc.getQueryData<MedicationDay>(keys.medications.day(undefined))
      expect(cached?.blocks[0].entries[0].confirmedAt).not.toBeNull()
      expect(cached?.blocks[0].status).toBe('confirmed')
    })
    expect(mockPatch).toHaveBeenCalledWith('/api/medications/days/e1/', { confirmed: true })
  })

  it('confirm block faz POST com o payload correto', async () => {
    const { qc, wrapper } = makeWrapper()
    qc.setQueryData(keys.medications.day(undefined), DAY)
    mockPost.mockResolvedValueOnce({ data: DAY })
    const { result } = renderHook(() => useConfirmBlockMutation(), { wrapper })

    result.current.mutate({ date: '2026-03-01', timeBlockId: 'b1', confirmed: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/medications/days/confirm-block/', {
      date: '2026-03-01',
      timeBlockId: 'b1',
      confirmed: true,
    })
  })

  it('avulso faz POST e invalida a chave do dia', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({ data: DAY })
    const { result } = renderHook(() => useCreateAdHocEntryMutation(), { wrapper })

    result.current.mutate({
      date: '2026-03-01',
      medicationId: 'm1',
      dose: [{ label: '', amount: 1, unit: 'comp' }],
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/medications/days/ad-hoc/', {
      date: '2026-03-01',
      medicationId: 'm1',
      dose: [{ label: '', amount: 1, unit: 'comp' }],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys.medications.day(undefined) })
  })
})
