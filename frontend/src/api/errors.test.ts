import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { domainErrorCode, domainErrorMessage } from './errors'

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const response = {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', response.config, undefined, response)
}

describe('domainErrorMessage (Story 14.11)', () => {
  it('409 de domínio: devolve o `detail` legível do backend', () => {
    const error = axiosErrorWith(409, {
      detail: 'Finalize o mês anterior (01/08/2026) antes de iniciar.',
      code: 'previous_finalized',
    })
    expect(domainErrorMessage(error, 'fallback')).toBe(
      'Finalize o mês anterior (01/08/2026) antes de iniciar.',
    )
    expect(domainErrorCode(error)).toBe('previous_finalized')
  })

  it('409 sem `code` (qualquer outro DomainError): detail sim, code null', () => {
    const error = axiosErrorWith(409, { detail: 'Já existe outro ciclo disputando este alvo.' })
    expect(domainErrorMessage(error, 'fallback')).toBe('Já existe outro ciclo disputando este alvo.')
    expect(domainErrorCode(error)).toBeNull()
  })

  it('fora do 409 (400 de validação, 500, rede): fallback genérico', () => {
    expect(
      domainErrorMessage(axiosErrorWith(400, { detail: 'Validation failed', fields: { monthFirst: ['x'] } }), 'fallback'),
    ).toBe('fallback')
    expect(domainErrorMessage(axiosErrorWith(500, { detail: 'Internal server error' }), 'fallback')).toBe('fallback')
    expect(domainErrorMessage(new Error('Network Error'), 'fallback')).toBe('fallback')
    expect(domainErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(domainErrorCode(new Error('boom'))).toBeNull()
  })

  it('409 com corpo inesperado (detail vazio/não-string) cai no fallback', () => {
    expect(domainErrorMessage(axiosErrorWith(409, { detail: '' }), 'fallback')).toBe('fallback')
    expect(domainErrorMessage(axiosErrorWith(409, { detail: ['lista'] }), 'fallback')).toBe('fallback')
    expect(domainErrorMessage(axiosErrorWith(409, 'texto cru'), 'fallback')).toBe('fallback')
    expect(domainErrorMessage(axiosErrorWith(409, null), 'fallback')).toBe('fallback')
  })
})
