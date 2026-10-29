import { describe, expect, it } from 'vitest'

import { capitalize, formatMonthTitle, MONTH_ABBREV_PT, MONTH_NAMES_PT } from './monthNames'

describe('formatMonthTitle (Story 14.11)', () => {
  it('nome por extenso capitalizado + ano', () => {
    expect(formatMonthTitle('2026-09-01')).toBe('Setembro de 2026')
    expect(formatMonthTitle('2026-01-01')).toBe('Janeiro de 2026')
    expect(formatMonthTitle('2027-12-01')).toBe('Dezembro de 2027')
  })

  it('tabelas de meses têm 12 entradas coerentes', () => {
    expect(MONTH_NAMES_PT).toHaveLength(12)
    expect(MONTH_ABBREV_PT).toHaveLength(12)
    MONTH_NAMES_PT.forEach((name, index) => expect(name.startsWith(MONTH_ABBREV_PT[index])).toBe(true))
    expect(capitalize('março')).toBe('Março')
  })
})
