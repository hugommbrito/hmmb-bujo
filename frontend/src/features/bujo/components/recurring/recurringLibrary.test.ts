import { describe, expect, it } from 'vitest'

import { RECURRENCE_GROUPS, sublineOf, visibleByGroup } from './recurringLibrary'
import type { RecurringTaskTemplate } from '../../types'

function tpl(overrides: Partial<RecurringTaskTemplate> = {}): RecurringTaskTemplate {
  return {
    id: 'tpl-1',
    title: 'Template',
    description: null,
    eisenhower: null,
    category: null,
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda segunda',
    active: true,
    ...overrides,
  }
}

describe('RECURRENCE_GROUPS — ordem canônica das abas', () => {
  it('é Semanal → Mensal → Anual (mockup frame A)', () => {
    expect(RECURRENCE_GROUPS).toEqual(['weekly', 'monthly', 'annual'])
  })
})

describe('visibleByGroup — fonte única da lista e da contagem (AC1)', () => {
  it('segmenta por grupo preservando a ORDEM da resposta do servidor', () => {
    const templates = [
      tpl({ id: 'a', recurrenceText: 'aaa' }),
      tpl({ id: 'b', recurrenceGroup: 'monthly' }),
      tpl({ id: 'c', recurrenceText: 'ccc' }),
      tpl({ id: 'd', recurrenceGroup: 'annual' }),
    ]
    const visible = visibleByGroup(templates, false)
    expect(visible.weekly.map((t) => t.id)).toEqual(['a', 'c'])
    expect(visible.monthly.map((t) => t.id)).toEqual(['b'])
    expect(visible.annual.map((t) => t.id)).toEqual(['d'])
  })

  it('showInactive=false esconde os inativos', () => {
    const visible = visibleByGroup([tpl({ id: 'a' }), tpl({ id: 'b', active: false })], false)
    expect(visible.weekly.map((t) => t.id)).toEqual(['a'])
  })

  it('showInactive=true traz os inativos de volta (não-vacuidade do caso acima)', () => {
    const visible = visibleByGroup([tpl({ id: 'a' }), tpl({ id: 'b', active: false })], true)
    expect(visible.weekly.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('ligar o filtro muda a contagem dos TRÊS grupos ao mesmo tempo (AC1)', () => {
    const templates = [
      tpl({ id: 'w1' }),
      tpl({ id: 'w2', active: false }),
      tpl({ id: 'm1', recurrenceGroup: 'monthly', active: false }),
      tpl({ id: 'a1', recurrenceGroup: 'annual' }),
      tpl({ id: 'a2', recurrenceGroup: 'annual', active: false }),
    ]
    const semInativos = visibleByGroup(templates, false)
    expect([semInativos.weekly.length, semInativos.monthly.length, semInativos.annual.length]).toEqual([1, 0, 1])

    const comInativos = visibleByGroup(templates, true)
    expect([comInativos.weekly.length, comInativos.monthly.length, comInativos.annual.length]).toEqual([2, 1, 2])
  })

  it('lista vazia devolve os três grupos vazios (nunca undefined)', () => {
    const visible = visibleByGroup([], false)
    expect(visible).toEqual({ weekly: [], monthly: [], annual: [] })
  })

  it('grupo desconhecido não derruba a derivação nem entra em nenhuma aba', () => {
    const visible = visibleByGroup(
      [tpl({ id: 'x', recurrenceGroup: 'daily' as never }), tpl({ id: 'w' })],
      false,
    )
    expect(visible.weekly.map((t) => t.id)).toEqual(['w'])
    expect(visible.monthly).toEqual([])
    expect(visible.annual).toEqual([])
  })
})

describe('sublineOf — "{Grupo} — {recurrenceText}"', () => {
  it('rotula o grupo em pt-BR', () => {
    expect(sublineOf(tpl({ recurrenceText: 'toda segunda de manhã' }))).toBe(
      'Semanal — toda segunda de manhã',
    )
    expect(sublineOf(tpl({ recurrenceGroup: 'monthly', recurrenceText: 'todo dia 5' }))).toBe(
      'Mensal — todo dia 5',
    )
    expect(sublineOf(tpl({ recurrenceGroup: 'annual', recurrenceText: 'todo dezembro' }))).toBe(
      'Anual — todo dezembro',
    )
  })

  it('NÃO concatena "(inativo)" — o estado inativo virou chip (delta do M09)', () => {
    expect(sublineOf(tpl({ active: false, recurrenceText: 'todo dia útil' }))).toBe(
      'Semanal — todo dia útil',
    )
  })
})
