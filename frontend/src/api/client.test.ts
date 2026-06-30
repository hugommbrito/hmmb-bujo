import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios, { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'

vi.mock('../features/auth/tokenStorage', () => ({
  getAccessToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

vi.mock('./queryClient', () => ({
  queryClient: { clear: vi.fn() },
}))

import client, { registerLogoutHandler } from './client'
import * as tokenStorage from '../features/auth/tokenStorage'

function makeAxiosError(status: number, config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    config,
    undefined,
    {
      data: {},
      status,
      statusText: status === 401 ? 'Unauthorized' : 'Error',
      headers: {},
      config,
    } as AxiosResponse,
  )
}

const originalAdapter = client.defaults.adapter

describe('api/client — configuração base', () => {
  it('é uma instância Axios (tem método get)', () => {
    expect(typeof client.get).toBe('function')
  })

  it('Content-Type padrão é application/json', () => {
    const contentType =
      client.defaults.headers?.['Content-Type'] ??
      client.defaults.headers?.common?.['Content-Type']
    expect(contentType).toBe('application/json')
  })

  it('Authorization não está no header estático (é adicionado dinamicamente pelo interceptor)', () => {
    const authHeader =
      client.defaults.headers?.['Authorization'] ??
      client.defaults.headers?.common?.['Authorization']
    expect(authHeader).toBeUndefined()
  })
})

describe('api/client — request interceptor', () => {
  let mockLogout: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetAllMocks()
    mockLogout = vi.fn()
    registerLogoutHandler(mockLogout)
  })

  afterEach(() => {
    client.defaults.adapter = originalAdapter
  })

  it('adiciona header Authorization quando token presente', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('meu-access-token')

    let capturedAuthHeader: string | undefined

    client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      capturedAuthHeader = config.headers.Authorization as string
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }

    await client.get('/api/test/')
    expect(capturedAuthHeader).toBe('Bearer meu-access-token')
  })

  it('não adiciona header Authorization quando token ausente', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue(null)

    let capturedAuthHeader: unknown

    client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      capturedAuthHeader = config.headers.Authorization
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }

    await client.get('/api/test/')
    expect(capturedAuthHeader).toBeUndefined()
  })
})

describe('api/client — response interceptor (401 single-flight)', () => {
  let mockLogout: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetAllMocks()
    mockLogout = vi.fn()
    registerLogoutHandler(mockLogout)
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue(null)
    vi.mocked(tokenStorage.getRefreshToken).mockReturnValue(null)
  })

  afterEach(() => {
    client.defaults.adapter = originalAdapter
  })

  it('401 único dispara refresh e faz retry com novo token', async () => {
    vi.mocked(tokenStorage.getRefreshToken).mockReturnValue('refresh-token')
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('new-access-token')

    let callCount = 0
    client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      callCount++
      if (callCount === 1) throw makeAxiosError(401, config)
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config }
    }

    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { access: 'new-access', refresh: 'new-refresh' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    })

    const result = await client.get('/api/test/')
    expect(result.data).toEqual({ ok: true })
    expect(tokenStorage.setTokens).toHaveBeenCalledWith('new-access', 'new-refresh')
  })

  it('N 401 simultâneos disparam único refresh (single-flight)', async () => {
    vi.mocked(tokenStorage.getRefreshToken).mockReturnValue('refresh-token')
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('new-token')

    const refreshSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { access: 'new-access', refresh: 'new-refresh' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    })

    const seen = new Set<string>()
    client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const url = config.url ?? 'unknown'
      if (!seen.has(url)) {
        seen.add(url)
        throw makeAxiosError(401, config)
      }
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }

    await Promise.all([
      client.get('/api/a/'),
      client.get('/api/b/'),
      client.get('/api/c/'),
    ])

    expect(refreshSpy).toHaveBeenCalledTimes(1)
  })

  it('401 no endpoint de refresh → logout imediato, promise rejeitada', async () => {
    client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      throw makeAxiosError(401, config)
    }

    await expect(client.get('/api/accounts/token/refresh/')).rejects.toThrow()
    expect(mockLogout).toHaveBeenCalledTimes(1)
    expect(tokenStorage.clearTokens).toHaveBeenCalled()
  })

  it('non-401 passa adiante sem tentar refresh', async () => {
    client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      throw makeAxiosError(500, config)
    }

    const refreshSpy = vi.spyOn(axios, 'post')

    await expect(client.get('/api/test/')).rejects.toThrow()
    expect(refreshSpy).not.toHaveBeenCalled()
  })

  it('retry com novo token retornando 401 → logout chamado', async () => {
    let refreshCallCount = 0
    vi.mocked(tokenStorage.getRefreshToken).mockImplementation(
      () => (refreshCallCount === 0 ? 'refresh-token' : null),
    )

    client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      throw makeAxiosError(401, config)
    }

    vi.spyOn(axios, 'post').mockImplementation(async () => {
      refreshCallCount++
      return {
        data: { access: 'new-access', refresh: 'new-refresh' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }
    })

    await expect(client.get('/api/test/')).rejects.toThrow()
    expect(mockLogout).toHaveBeenCalled()
  })
})
