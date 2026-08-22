import { describe, expect, it } from 'vitest'

import {
  CAPTURE_MONTH_REJECTED,
  dayPrefixLabelOf,
  dayPrefixOf,
  focusCountsOf,
  formatFocusCounts,
  formatMonthTitle,
  groupDistantByYear,
  horizonMonthsFrom,
  isCaptureMonthInFuture,
  sortByDayThenUndated,
} from './futureHorizon'
import { futureBoard } from '../../../../shared/design/tokens'
import type { Task } from '../../types'

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: `Tarefa ${overrides.id}`,
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    scheduledDate: null,
    ...overrides,
  } as Task
}

describe('sortByDayThenUndated (AC3) — espelho de _by_day_then_undated', () => {
  it('mês só com datados: ordena por dia ascendente', () => {
    const ordenado = sortByDayThenUndated([
      task({ id: 'c', scheduledDate: '2026-08-20' }),
      task({ id: 'a', scheduledDate: '2026-08-03' }),
      task({ id: 'b', scheduledDate: '2026-08-14' }),
    ])
    expect(ordenado.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('mês só com sem-dia: preserva a ordem de entrada (order_index do servidor)', () => {
    const ordenado = sortByDayThenUndated([task({ id: 'x' }), task({ id: 'y' }), task({ id: 'z' })])
    expect(ordenado.map((t) => t.id)).toEqual(['x', 'y', 'z'])
  })

  it('misto: TODOS os datados vêm antes de TODOS os sem-dia', () => {
    const ordenado = sortByDayThenUndated([
      task({ id: 'sem-1' }),
      task({ id: 'dia-20', scheduledDate: '2026-08-20' }),
      task({ id: 'sem-2' }),
      task({ id: 'dia-01', scheduledDate: '2026-08-01' }),
    ])
    expect(ordenado.map((t) => t.id)).toEqual(['dia-01', 'dia-20', 'sem-1', 'sem-2'])
  })

  it('empate de data: desempata pela ordem de entrada (sort estável = order_index)', () => {
    const ordenado = sortByDayThenUndated([
      task({ id: 'primeiro', scheduledDate: '2026-08-14' }),
      task({ id: 'segundo', scheduledDate: '2026-08-14' }),
      task({ id: 'terceiro', scheduledDate: '2026-08-14' }),
    ])
    expect(ordenado.map((t) => t.id)).toEqual(['primeiro', 'segundo', 'terceiro'])
  })

  it('não muta a lista original', () => {
    const original = [task({ id: 'b', scheduledDate: '2026-08-20' }), task({ id: 'a', scheduledDate: '2026-08-01' })]
    sortByDayThenUndated(original)
    expect(original.map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('dayPrefixOf / dayPrefixLabelOf (AC3) — data parcial vs. completa', () => {
  it('com dia usa (14), sem zero à esquerda', () => {
    expect(dayPrefixOf(task({ id: '1', scheduledDate: '2026-08-04' }), '2026-08-01')).toBe('(4)')
    expect(dayPrefixOf(task({ id: '2', scheduledDate: '2026-08-14' }), '2026-08-01')).toBe('(14)')
  })

  it('só com mês usa a abreviação de 3 letras em minúsculas', () => {
    expect(dayPrefixOf(task({ id: '1' }), '2026-08-01')).toBe('— ago')
    expect(dayPrefixOf(task({ id: '2' }), '2027-01-01')).toBe('— jan')
    expect(dayPrefixOf(task({ id: '3' }), '2026-12-01')).toBe('— dez')
  })

  it('o rótulo acessível distingue os dois casos por PALAVRA, não pela forma', () => {
    expect(dayPrefixLabelOf(task({ id: '1', scheduledDate: '2026-08-14' }), '2026-08-01')).toBe(
      'Dia 14 de agosto',
    )
    expect(dayPrefixLabelOf(task({ id: '2' }), '2026-08-01')).toBe('Sem dia definido em agosto')
  })
})

describe('groupDistantByYear (AC1) — seletor "Ir para mês…"', () => {
  it('agrupa por ano preservando a ordem ascendente', () => {
    expect(
      groupDistantByYear([
        { monthFirst: '2027-06-01', taskCount: 2 },
        { monthFirst: '2027-09-01', taskCount: 1 },
        { monthFirst: '2028-01-01', taskCount: 4 },
        { monthFirst: '2028-07-01', taskCount: 1 },
      ]),
    ).toEqual([
      {
        year: 2027,
        months: [
          { monthFirst: '2027-06-01', taskCount: 2 },
          { monthFirst: '2027-09-01', taskCount: 1 },
        ],
      },
      {
        year: 2028,
        months: [
          { monthFirst: '2028-01-01', taskCount: 4 },
          { monthFirst: '2028-07-01', taskCount: 1 },
        ],
      },
    ])
  })

  it('virada dez → jan abre grupo novo (não funde os dois anos)', () => {
    const grupos = groupDistantByYear([
      { monthFirst: '2027-12-01', taskCount: 1 },
      { monthFirst: '2028-01-01', taskCount: 3 },
    ])
    expect(grupos.map((g) => g.year)).toEqual([2027, 2028])
    expect(grupos[0].months).toHaveLength(1)
    expect(grupos[1].months).toHaveLength(1)
  })

  it('lista vazia devolve nenhum grupo (estado vazio do seletor)', () => {
    expect(groupDistantByYear([])).toEqual([])
  })
})

describe('focusCountsOf / formatFocusCounts (AC1)', () => {
  it('deriva total, com dia e sem dia da própria lista', () => {
    const counts = focusCountsOf([
      task({ id: '1', scheduledDate: '2026-08-14' }),
      task({ id: '2', scheduledDate: '2026-08-20' }),
      task({ id: '3' }),
    ])
    expect(counts).toEqual({ total: 3, dated: 2, undated: 1 })
    expect(formatFocusCounts(counts)).toBe('3 itens · 2 com dia · 1 sem dia')
  })

  it('singular de "item" e mês vazio zerado', () => {
    expect(formatFocusCounts(focusCountsOf([task({ id: '1' })]))).toBe('1 item · 0 com dia · 1 sem dia')
    expect(formatFocusCounts(focusCountsOf([]))).toBe('0 itens · 0 com dia · 0 sem dia')
  })
})

describe('horizonMonthsFrom (AC1/AC8)', () => {
  it('produz exatamente futureBoard.horizonMonths meses consecutivos a partir do âncora + 1', () => {
    const meses = horizonMonthsFrom('2026-07-01')
    expect(meses).toHaveLength(futureBoard.horizonMonths)
    expect(meses[0]).toBe('2026-08-01')
    expect(meses).toEqual([
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
      '2027-03-01',
    ])
  })

  it('nunca inclui o próprio âncora (o horizonte começa no mês SEGUINTE)', () => {
    expect(horizonMonthsFrom('2026-12-01')).not.toContain('2026-12-01')
    expect(horizonMonthsFrom('2026-12-01')[0]).toBe('2027-01-01')
  })
})

describe('isCaptureMonthInFuture (AC3)', () => {
  it('rejeita o próprio âncora e qualquer mês anterior', () => {
    expect(isCaptureMonthInFuture('2026-07-01', '2026-07-01')).toBe(false)
    expect(isCaptureMonthInFuture('2026-06-01', '2026-07-01')).toBe(false)
    expect(isCaptureMonthInFuture('2025-12-01', '2026-07-01')).toBe(false)
  })

  it('aceita o primeiro mês do horizonte e qualquer mês distante', () => {
    expect(isCaptureMonthInFuture('2026-08-01', '2026-07-01')).toBe(true)
    expect(isCaptureMonthInFuture('2030-01-01', '2026-07-01')).toBe(true)
  })

  it('a mensagem de rejeição nomeia a saída, não só o erro', () => {
    expect(CAPTURE_MONTH_REJECTED).toContain('Use o Mês ou a Semana')
  })
})

describe('formatMonthTitle', () => {
  it('capitaliza o mês por extenso com o ano', () => {
    expect(formatMonthTitle('2026-08-01')).toBe('Agosto de 2026')
    expect(formatMonthTitle('2027-03-01')).toBe('Março de 2027')
  })
})
