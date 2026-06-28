import { describe, it, expect } from 'vitest'
import { keys } from './keys'

describe('query-key factory (AC2)', () => {
  it('brainDump.count retorna tupla com escopo correto', () => {
    const key = keys.brainDump.count('user-abc')
    expect(key).toEqual(['brainDump', 'count', 'user-abc'])
  })

  it('chaves com userId diferentes são distintas', () => {
    const k1 = keys.brainDump.count('user-1')
    const k2 = keys.brainDump.count('user-2')
    expect(k1).not.toEqual(k2)
  })

  it('padrão de escopo: primeiro elemento identifica domínio', () => {
    expect(keys.brainDump.count('u')[0]).toBe('brainDump')
  })
})
