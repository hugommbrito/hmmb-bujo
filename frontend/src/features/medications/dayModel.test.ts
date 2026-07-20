import { describe, it, expect } from 'vitest'
import { deriveEntryStatus } from './dayModel'
import type { MedicationDayEntry } from './types'

// Story 8.3 (AC3): matriz temporal de deriveEntryStatus. A distinção "perdida vs.
// pendente" é temporal sobre dados idênticos (mesma linha scheduled sem confirmedAt).

function entry(overrides: Partial<MedicationDayEntry> = {}): MedicationDayEntry {
  return {
    id: 'e1',
    medicationId: 'm1',
    medicationTitle: 'Losartana',
    substanceName: 'Losartana K',
    doseAtTime: [{ label: '', amount: 50, unit: 'mg' }],
    confirmedAt: null,
    source: 'scheduled',
    timeBlockId: 'b1',
    ...overrides,
  }
}

describe('deriveEntryStatus (unidade pura, AC3)', () => {
  it('scheduled com confirmedAt → confirmed (independente de isPast)', () => {
    const e = entry({ confirmedAt: '2026-03-01T10:00:00Z' })
    expect(deriveEntryStatus(e, false)).toBe('confirmed')
    expect(deriveEntryStatus(e, true)).toBe('confirmed')
  })

  it('scheduled sem confirmedAt num dia PASSADO → missed (dose perdida)', () => {
    expect(deriveEntryStatus(entry({ confirmedAt: null }), true)).toBe('missed')
  })

  it('scheduled sem confirmedAt hoje/futuro → pending', () => {
    expect(deriveEntryStatus(entry({ confirmedAt: null }), false)).toBe('pending')
  })

  it('ad_hoc → confirmed (avulso, ausência sem sentido) mesmo sem confirmedAt', () => {
    const adHoc = entry({ source: 'ad_hoc', confirmedAt: null, timeBlockId: null })
    expect(deriveEntryStatus(adHoc, true)).toBe('confirmed')
    expect(deriveEntryStatus(adHoc, false)).toBe('confirmed')
  })
})
