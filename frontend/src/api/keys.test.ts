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

describe('bujo.weeklyCycle / ritualWeeklySource / ritualWeeklyDensity (Story 14.5)', () => {
  it('weeklyCycle é uma chave fixa (sem discriminador)', () => {
    expect(keys.bujo.weeklyCycle()).toEqual(['bujo', 'weeklyCycle'])
  })

  it('ritualWeeklySource discrimina por sourceId e weekStart', () => {
    expect(keys.bujo.ritualWeeklySource('recurring', '2026-07-20')).toEqual([
      'bujo',
      'ritualWeeklySource',
      'recurring',
      '2026-07-20',
    ])
    expect(keys.bujo.ritualWeeklySource('recurring', '2026-07-27')).not.toEqual(
      keys.bujo.ritualWeeklySource('recurring', '2026-07-20'),
    )
    expect(keys.bujo.ritualWeeklySource('previous-weekly', '2026-07-20')).not.toEqual(
      keys.bujo.ritualWeeklySource('recurring', '2026-07-20'),
    )
  })

  it('ritualWeeklyDensity discrimina por weekStart', () => {
    expect(keys.bujo.ritualWeeklyDensity('2026-07-20')).toEqual([
      'bujo',
      'ritualWeeklyDensity',
      '2026-07-20',
    ])
  })
})

describe('bujo.monthlyCycle / ritualMonthlySource / ritualMonthlyDensity (Story 14.6)', () => {
  it('monthlyCycle é uma chave fixa (sem discriminador)', () => {
    expect(keys.bujo.monthlyCycle()).toEqual(['bujo', 'monthlyCycle'])
  })

  it('ritualMonthlySource discrimina por sourceId e monthFirst', () => {
    expect(keys.bujo.ritualMonthlySource('recurring', '2026-08-01')).toEqual([
      'bujo',
      'ritualMonthlySource',
      'recurring',
      '2026-08-01',
    ])
    expect(keys.bujo.ritualMonthlySource('recurring', '2026-09-01')).not.toEqual(
      keys.bujo.ritualMonthlySource('recurring', '2026-08-01'),
    )
    expect(keys.bujo.ritualMonthlySource('previous-monthly', '2026-08-01')).not.toEqual(
      keys.bujo.ritualMonthlySource('recurring', '2026-08-01'),
    )
  })

  it('ritualMonthlyDensity discrimina por monthFirst', () => {
    expect(keys.bujo.ritualMonthlyDensity('2026-08-01')).toEqual([
      'bujo',
      'ritualMonthlyDensity',
      '2026-08-01',
    ])
  })
})

describe('bujo.futureHorizon (Story 14.7, AC9)', () => {
  it('vive sob o MESMO prefixo de futureLog, com discriminador próprio', () => {
    expect(keys.bujo.futureHorizon()).toEqual(['bujo', 'futureLog', 'horizon'])
    expect(keys.bujo.futureLog()).toEqual(['bujo', 'futureLog', 'list'])
  })

  it('a chave EXATA de futureLog() não é prefixo de futureHorizon() — a razão da AC9', () => {
    const horizon = keys.bujo.futureHorizon() as readonly string[]
    const list = keys.bujo.futureLog() as readonly string[]
    const isPrefixOf = (a: readonly string[], b: readonly string[]) =>
      a.every((segment, index) => b[index] === segment)

    // O match do TanStack Query é por prefixo: invalidar `['bujo','futureLog','list']`
    // NÃO alcança `['bujo','futureLog','horizon']`...
    expect(isPrefixOf(list, horizon)).toBe(false)
    // ...mas invalidar `['bujo','futureLog']` alcança as duas.
    expect(isPrefixOf(['bujo', 'futureLog'], horizon)).toBe(true)
    expect(isPrefixOf(['bujo', 'futureLog'], list)).toBe(true)
  })
})
