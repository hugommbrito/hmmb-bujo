import { describe, expect, it } from 'vitest'

import {
  itemsForView,
  normalizeAlreadyPlacedBuckets,
  normalizeSource,
  normalizeTaskItems,
  normalizeTemplateItems,
  sameDayOfMonthClamped,
  MONTHLY_RITUAL_SOURCE_ACTIONS,
  MONTHLY_RITUAL_SOURCE_ORDER,
  type NormalizedRitualItem,
} from './monthlyRitualSources'
import type { MonthlyRecurringSource, RitualTaskItem, RitualTemplateItem, Task } from '../../types'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    title: 'Tarefa',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

function templateItem(overrides: Partial<RitualTemplateItem['template']> = {}): RitualTemplateItem {
  return {
    template: {
      id: 'tpl-1',
      title: 'Template',
      recurrenceGroup: 'monthly',
      recurrenceText: 'todo dia 1',
      ...overrides,
    },
    decision: null,
    instancesInTargetCount: 0,
  }
}

describe('MONTHLY_RITUAL_SOURCE_ORDER — ordem fixa das 3 fontes (AC5)', () => {
  it('a ordem é EXATAMENTE a do spine: Recorrentes → Future Log → Monthly anterior', () => {
    expect(MONTHLY_RITUAL_SOURCE_ORDER).toEqual(['recurring', 'future-log', 'previous-monthly'])
  })
})

describe('MONTHLY_RITUAL_SOURCE_ACTIONS — guardrail de decisão-snapshot (AC5)', () => {
  it('"keep_undated" (Manter sem dia) SÓ existe em future-log', () => {
    for (const sourceId of MONTHLY_RITUAL_SOURCE_ORDER) {
      const hasKeepUndated = MONTHLY_RITUAL_SOURCE_ACTIONS[sourceId].includes('keep_undated')
      expect(hasKeepUndated).toBe(sourceId === 'future-log')
    }
  })

  it('"allocate" (Alocar) SÓ existe em recurring — nenhuma decisão-snapshot para (monthly, template)', () => {
    for (const sourceId of MONTHLY_RITUAL_SOURCE_ORDER) {
      const hasAllocate = MONTHLY_RITUAL_SOURCE_ACTIONS[sourceId].includes('allocate')
      expect(hasAllocate).toBe(sourceId === 'recurring')
    }
  })

  it('previous-monthly (a fonte bloqueante) NUNCA oferece keep_undated nem allocate — só mutação', () => {
    expect(MONTHLY_RITUAL_SOURCE_ACTIONS['previous-monthly']).not.toContain('keep_undated')
    expect(MONTHLY_RITUAL_SOURCE_ACTIONS['previous-monthly']).not.toContain('allocate')
    expect(MONTHLY_RITUAL_SOURCE_ACTIONS['previous-monthly']).toEqual(
      expect.arrayContaining(['migrate_named_day', 'choose_destination', 'complete', 'cancel']),
    )
  })

  it('recurring NUNCA oferece complete/cancel (não é a fonte bloqueante)', () => {
    expect(MONTHLY_RITUAL_SOURCE_ACTIONS.recurring).not.toContain('complete')
    expect(MONTHLY_RITUAL_SOURCE_ACTIONS.recurring).not.toContain('cancel')
  })

  it('migrate_named_day e choose_destination aparecem SEMPRE juntos (fontes com itens de Task)', () => {
    for (const sourceId of ['future-log', 'previous-monthly'] as const) {
      const actions = MONTHLY_RITUAL_SOURCE_ACTIONS[sourceId]
      expect(actions.includes('migrate_named_day')).toBe(actions.includes('choose_destination'))
    }
  })
})

describe('normalizeTaskItems / normalizeTemplateItems', () => {
  it('normaliza itens de Task preservando decision e scheduledDate (future-log/previous-monthly)', () => {
    const items: RitualTaskItem[] = [
      { task: task({ id: 't-1', scheduledDate: null }), decision: 'keep_undated' },
    ]
    expect(normalizeTaskItems(items)).toEqual([
      { id: 't-1', kind: 'task', title: 'Tarefa', decision: 'keep_undated', scheduledDate: null },
    ])
  })

  it('normaliza itens de template preservando recurrenceGroup/recurrenceText/instancesInTargetCount', () => {
    const items: RitualTemplateItem[] = [templateItem({ recurrenceGroup: 'annual' })]
    expect(normalizeTemplateItems(items)).toEqual([
      {
        id: 'tpl-1',
        kind: 'template',
        title: 'Template',
        decision: null,
        recurrenceGroup: 'annual',
        recurrenceText: 'todo dia 1',
        instancesInTargetCount: 0,
      },
    ])
  })

  it('recurrence_text é só exibido — nenhuma função aqui faz parsing dele', () => {
    // Nenhum assert de comportamento: a garantia é a ausência de qualquer regex/
    // parsing na função — provada por leitura do próprio arquivo. Este teste
    // documenta a invariante e prova que o campo sobrevive intacto na saída.
    const items: RitualTemplateItem[] = [templateItem({ recurrenceText: 'toda 2ª e 4ª às 9h' })]
    expect(normalizeTemplateItems(items)[0].recurrenceText).toBe('toda 2ª e 4ª às 9h')
  })
})

describe('normalizeAlreadyPlacedBuckets — os 2 buckets FORA do progresso (achado da 14.4/14.5)', () => {
  const RECURRING_SOURCE: MonthlyRecurringSource = {
    sourceId: 'recurring',
    blocking: false,
    countsTowardProgress: true,
    eligibleCount: 2,
    pendingDecisionCount: 2,
    reviewed: false,
    items: [
      templateItem({ id: 'tpl-monthly-1', recurrenceGroup: 'monthly' }),
      templateItem({ id: 'tpl-annual-1', recurrenceGroup: 'annual' }),
    ],
    alreadyPlaced: {
      countsTowardProgress: false,
      items: [templateItem({ id: 'tpl-monthly-2', recurrenceGroup: 'monthly' })],
    },
    alreadyPlacedInYear: {
      countsTowardProgress: false,
      items: [templateItem({ id: 'tpl-annual-2', recurrenceGroup: 'annual' })],
    },
  }

  it('alreadyPlaced (mensal já alocado no mês) e alreadyPlacedInYear (anual já alocado no ano) são DISTINTOS', () => {
    const buckets = normalizeAlreadyPlacedBuckets(RECURRING_SOURCE)
    expect(buckets.alreadyPlaced).toHaveLength(1)
    expect(buckets.alreadyPlaced[0].id).toBe('tpl-monthly-2')
    expect(buckets.alreadyPlacedInYear).toHaveLength(1)
    expect(buckets.alreadyPlacedInYear[0].id).toBe('tpl-annual-2')
  })

  it('undefined devolve os dois buckets vazios', () => {
    expect(normalizeAlreadyPlacedBuckets(undefined)).toEqual({
      alreadyPlaced: [],
      alreadyPlacedInYear: [],
    })
  })

  it('normalizeSource("recurring", ...) devolve os 4 buckets observáveis, não 3: os 2 grupos dentro de items (monthly/annual, distinguíveis só por recurrenceGroup) SOMADOS aos 2 buckets fora do progresso', () => {
    const inProgress = normalizeSource('recurring', RECURRING_SOURCE)
    const outsideProgress = normalizeAlreadyPlacedBuckets(RECURRING_SOURCE)
    expect(inProgress.filter((i) => i.recurrenceGroup === 'monthly')).toHaveLength(1)
    expect(inProgress.filter((i) => i.recurrenceGroup === 'annual')).toHaveLength(1)
    // Ordem fixa do servidor preservada: monthly pendente PRIMEIRO, annual depois.
    expect(inProgress.map((i) => i.recurrenceGroup)).toEqual(['monthly', 'annual'])
    expect(outsideProgress.alreadyPlaced).toHaveLength(1)
    expect(outsideProgress.alreadyPlacedInYear).toHaveLength(1)
  })
})

describe('normalizeSource — despacho por sourceId', () => {
  it('future-log e previous-monthly usam items de Task', () => {
    const data = {
      sourceId: 'future-log',
      blocking: false,
      countsTowardProgress: true,
      eligibleCount: 1,
      pendingDecisionCount: 1,
      reviewed: false,
      items: [{ task: task({ id: 't-x' }), decision: null }],
    }
    expect(normalizeSource('future-log', data)).toEqual([
      { id: 't-x', kind: 'task', title: 'Tarefa', decision: null, scheduledDate: undefined },
    ])
  })

  it('devolve [] quando os dados ainda não chegaram (query em andamento)', () => {
    expect(normalizeSource('recurring', undefined)).toEqual([])
    expect(normalizeSource('future-log', undefined)).toEqual([])
    expect(normalizeSource('previous-monthly', undefined)).toEqual([])
  })
})

describe('itemsForView — Pendentes de decisão × Tudo (mesmo padrão da 14.5)', () => {
  const items: NormalizedRitualItem[] = [
    { id: 'a', kind: 'task', title: 'A', decision: null },
    { id: 'b', kind: 'task', title: 'B', decision: 'keep_undated' },
  ]

  it('Pendentes de decisão mostra só decision === null', () => {
    expect(itemsForView(items, 'pending', [])).toEqual([items[0]])
  })

  it('Tudo mostra o durável (decision !== null) UNIDO ao efêmero desta visita', () => {
    const mutatedThisVisit: NormalizedRitualItem[] = [
      { id: 'c', kind: 'task', title: 'C (migrada nesta visita)', decision: 'migrated' },
    ]
    expect(itemsForView(items, 'all', mutatedThisVisit)).toEqual([items[1], mutatedThisVisit[0]])
  })
})

describe('sameDayOfMonthClamped — clamp do dia de origem no mês-alvo (AC5/AD-08)', () => {
  it('preserva o mesmo número de dia quando ele existe no mês-alvo', () => {
    expect(sameDayOfMonthClamped('2026-07-15', '2026-08-01')).toBe('2026-08-15')
  })

  it('faz clamp para o último dia real quando o mês-alvo é mais curto (ex. 31 → fevereiro)', () => {
    expect(sameDayOfMonthClamped('2026-01-31', '2026-02-01')).toBe('2026-02-28')
  })

  it('respeita o bissexto ao fazer clamp', () => {
    expect(sameDayOfMonthClamped('2028-01-31', '2028-02-01')).toBe('2028-02-29')
  })

  it('sem data de origem (null), cai no dia 1 do mês-alvo', () => {
    expect(sameDayOfMonthClamped(null, '2026-08-01')).toBe('2026-08-01')
  })
})
