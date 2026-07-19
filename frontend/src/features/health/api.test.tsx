import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import {
  useCreateHealthFieldMutation,
  useHealthFieldDefinitionsQuery,
  useUpdateHealthFieldMutation,
} from './api'
import type { HealthFieldDefinition } from './types'

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

const FIELD: HealthFieldDefinition = {
  id: 'field-1',
  name: 'Peso',
  fieldType: 'decimal',
  enumOptions: [],
  active: true,
  displayOrder: 0,
}

describe('useHealthFieldDefinitionsQuery', () => {
  beforeEach(() => vi.resetAllMocks())

  it('busca campos ativos por padrão', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: [FIELD] })

    const { result } = renderHook(() => useHealthFieldDefinitionsQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/health-field-definitions/')
    expect(result.current.data).toEqual([FIELD])
  })

  it('inclui inativos quando includeInactive=true', async () => {
    const { wrapper } = makeWrapper()
    mockGet.mockResolvedValueOnce({ data: [FIELD] })

    const { result } = renderHook(
      () => useHealthFieldDefinitionsQuery({ includeInactive: true }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(
      '/api/health-field-definitions/?includeInactive=true',
    )
  })
})

describe('useCreateHealthFieldMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('envia o payload camelCase e invalida o prefixo health no sucesso', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPost.mockResolvedValueOnce({ data: FIELD })

    const { result } = renderHook(() => useCreateHealthFieldMutation(), { wrapper })
    result.current.mutate({ name: 'Peso', fieldType: 'decimal' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/health-field-definitions/', {
      name: 'Peso',
      fieldType: 'decimal',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['health'] })
  })

  it('envia enumOptions para campo do tipo enum', async () => {
    const { wrapper } = makeWrapper()
    mockPost.mockResolvedValueOnce({
      data: { ...FIELD, fieldType: 'enum', enumOptions: ['Bom', 'Ruim'] },
    })

    const { result } = renderHook(() => useCreateHealthFieldMutation(), { wrapper })
    result.current.mutate({ name: 'Humor', fieldType: 'enum', enumOptions: ['Bom', 'Ruim'] })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/api/health-field-definitions/', {
      name: 'Humor',
      fieldType: 'enum',
      enumOptions: ['Bom', 'Ruim'],
    })
  })
})

describe('useUpdateHealthFieldMutation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('faz PATCH do campo e invalida health', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    mockPatch.mockResolvedValueOnce({ data: { ...FIELD, name: 'Novo' } })

    const { result } = renderHook(() => useUpdateHealthFieldMutation(), { wrapper })
    result.current.mutate({ fieldId: 'field-1', name: 'Novo' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/api/health-field-definitions/field-1/', {
      name: 'Novo',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['health'] })
  })

  it('desativa via PATCH {active:false}', async () => {
    const { wrapper } = makeWrapper()
    mockPatch.mockResolvedValueOnce({ data: { ...FIELD, active: false } })

    const { result } = renderHook(() => useUpdateHealthFieldMutation(), { wrapper })
    result.current.mutate({ fieldId: 'field-1', active: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/api/health-field-definitions/field-1/', {
      active: false,
    })
  })
})
