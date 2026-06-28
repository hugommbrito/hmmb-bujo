import { describe, it, expect } from 'vitest'
import client from './client'

describe('api/client (AC2)', () => {
  it('é uma instância Axios (tem método get)', () => {
    expect(typeof client.get).toBe('function')
  })

  it('Content-Type padrão é application/json', () => {
    const contentType =
      client.defaults.headers?.['Content-Type'] ??
      client.defaults.headers?.common?.['Content-Type']
    expect(contentType).toBe('application/json')
  })

  it('não tem Authorization header configurado (JWT é Story 2.2)', () => {
    const authHeader =
      client.defaults.headers?.['Authorization'] ??
      client.defaults.headers?.common?.['Authorization']
    expect(authHeader).toBeUndefined()
  })
})
