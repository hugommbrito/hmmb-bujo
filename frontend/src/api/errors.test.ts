import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { domainErrorCode, domainErrorMessage, fieldErrorMessage } from './errors'

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

describe('fieldErrorMessage (Story 16.2c)', () => {
  const FUTURE = 'Não é possível marcar um dia futuro como não registrado.'

  it('400 de validação: devolve a PRIMEIRA mensagem do campo pedido', () => {
    const error = axiosErrorWith(400, { detail: 'Validation failed', fields: { date: [FUTURE, 'outra'] } })
    expect(fieldErrorMessage(error, 'date')).toBe(FUTURE)
  })

  it('400 sem o campo pedido (ou sem `fields`): null', () => {
    expect(
      fieldErrorMessage(axiosErrorWith(400, { detail: 'x', fields: { untracked: ['obrigatório'] } }), 'date'),
    ).toBeNull()
    expect(fieldErrorMessage(axiosErrorWith(400, { detail: 'x' }), 'date')).toBeNull()
    expect(fieldErrorMessage(axiosErrorWith(400, { fields: { date: [] } }), 'date')).toBeNull()
    expect(fieldErrorMessage(axiosErrorWith(400, { fields: { date: ['  '] } }), 'date')).toBeNull()
    expect(fieldErrorMessage(axiosErrorWith(400, { fields: { date: 'não-lista' } }), 'date')).toBeNull()
    expect(fieldErrorMessage(axiosErrorWith(400, 'texto cru'), 'date')).toBeNull()
    expect(fieldErrorMessage(axiosErrorWith(400, null), 'date')).toBeNull()
  })

  it('fora do 400 (409, 500, rede, undefined): null — o chamador cai no genérico', () => {
    expect(fieldErrorMessage(axiosErrorWith(409, { detail: 'gate', fields: { date: [FUTURE] } }), 'date')).toBeNull()
    expect(fieldErrorMessage(axiosErrorWith(500, { detail: 'Internal server error' }), 'date')).toBeNull()
    expect(fieldErrorMessage(new Error('Network Error'), 'date')).toBeNull()
    expect(fieldErrorMessage(undefined, 'date')).toBeNull()
  })

  it('não interfere em `domainErrorMessage` (envelopes distintos)', () => {
    const error = axiosErrorWith(400, { detail: 'Validation failed', fields: { date: [FUTURE] } })
    expect(domainErrorMessage(error, 'fallback')).toBe('fallback')
  })
})
