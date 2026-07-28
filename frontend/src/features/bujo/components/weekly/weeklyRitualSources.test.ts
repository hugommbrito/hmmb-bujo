import { describe, expect, it } from 'vitest'

import {
  itemsForView,
  normalizePendingDailyGroups,
  normalizeSource,
  normalizeTaskItems,
  normalizeTemplateItems,
  WEEKLY_RITUAL_SOURCE_ACTIONS,
  WEEKLY_RITUAL_SOURCE_ORDER,
  type NormalizedRitualItem,
} from './weeklyRitualSources'
import type { PendingDailiesSource, RitualTaskItem, RitualTemplateItem, Task } from '../../types'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    title: 'Tarefa',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    migrationTarget: null,
    ...overrides,
  }
}

describe('WEEKLY_RITUAL_SOURCE_ORDER — ordem fixa das 5 fontes (AC5)', () => {
  it('a ordem é EXATAMENTE a do spine', () => {
    expect(WEEKLY_RITUAL_SOURCE_ORDER).toEqual([
      'monthly-in-week',
      'monthly-expanded',
      'recurring',
      'previous-weekly',
      'pending-dailies',
    ])
  })
})

describe('WEEKLY_RITUAL_SOURCE_ACTIONS — guardrail de decisão-snapshot (AC5)', () => {
  it('"Manter" (keep) SÓ existe em monthly-in-week', () => {
    for (const sourceId of WEEKLY_RITUAL_SOURCE_ORDER) {
      const hasKeep = WEEKLY_RITUAL_SOURCE_ACTIONS[sourceId].includes('keep')
      expect(hasKeep).toBe(sourceId === 'monthly-in-week')
    }
  })

  it('"Não alocar nesta semana" (skip_week) SÓ existe em recurring', () => {
    for (const sourceId of WEEKLY_RITUAL_SOURCE_ORDER) {
      const hasSkip = WEEKLY_RITUAL_SOURCE_ACTIONS[sourceId].includes('skip_week')
      expect(hasSkip).toBe(sourceId === 'recurring')
    }
  })

  it('previous-weekly e pending-dailies NÃO oferecem keep nem skip_week — só mutação', () => {
    for (const sourceId of ['previous-weekly', 'pending-dailies'] as const) {
      expect(WEEKLY_RITUAL_SOURCE_ACTIONS[sourceId]).not.toContain('keep')
      expect(WEEKLY_RITUAL_SOURCE_ACTIONS[sourceId]).not.toContain('skip_week')
      expect(WEEKLY_RITUAL_SOURCE_ACTIONS[sourceId]).toEqual(
        expect.arrayContaining(['migrate_named_day', 'choose_destination', 'complete', 'cancel']),
      )
    }
  })

  it('Migrar para <dia> e Escolher destino… aparecem SEMPRE juntos', () => {
    for (const sourceId of WEEKLY_RITUAL_SOURCE_ORDER) {
      if (sourceId === 'recurring') continue
      const actions = WEEKLY_RITUAL_SOURCE_ACTIONS[sourceId]
      expect(actions.includes('migrate_named_day')).toBe(actions.includes('choose_destination'))
    }
  })
})

describe('normalizeTaskItems / normalizeTemplateItems / normalizePendingDailyGroups', () => {
  it('normaliza itens de Task preservando decision e scheduledDate', () => {
    const items: RitualTaskItem[] = [{ task: task({ id: 't-1', scheduledDate: '2026-07-20' }), decision: 'keep' }]
    expect(normalizeTaskItems(items)).toEqual([
      { id: 't-1', kind: 'task', title: 'Tarefa', decision: 'keep', scheduledDate: '2026-07-20' },
    ])
  })

  it('normaliza itens de template preservando instancesInTargetCount', () => {
    const items: RitualTemplateItem[] = [
      {
        template: {
          id: 'tpl-1',
          title: 'Regar plantas',
          recurrenceGroup: 'weekly',
          recurrenceText: 'toda segunda',
        },
        decision: null,
        instancesInTargetCount: 2,
      },
    ]
    expect(normalizeTemplateItems(items)).toEqual([
      { id: 'tpl-1', kind: 'template', title: 'Regar plantas', decision: null, instancesInTargetCount: 2 },
    ])
  })

  it('normaliza groups (pending-dailies) achatando para itens com groupLabel', () => {
    const groups: PendingDailiesSource['groups'] = [
      { date: '2026-07-10', items: [{ task: task({ id: 't-a' }), decision: null }] },
      { date: '2026-07-11', items: [{ task: task({ id: 't-b' }), decision: null }] },
    ]
    const normalized = normalizePendingDailyGroups(groups)
    expect(normalized).toHaveLength(2)
    expect(normalized[0]).toMatchObject({ id: 't-a', groupLabel: '2026-07-10' })
    expect(normalized[1]).toMatchObject({ id: 't-b', groupLabel: '2026-07-11' })
  })

  it('normalizeSource despacha por sourceId (recurring usa items, pending-dailies usa groups)', () => {
    const recurringData = {
      sourceId: 'recurring',
      blocking: false,
      countsTowardProgress: true,
      eligibleCount: 1,
      pendingDecisionCount: 1,
      reviewed: false,
      items: [
        {
          template: {
            id: 'tpl-1',
            title: 'X',
            recurrenceGroup: 'weekly' as const,
            recurrenceText: 'toda terça',
          },
          decision: null,
          instancesInTargetCount: 0,
        },
      ],
      alreadyPlaced: { countsTowardProgress: false, items: [] },
    }
    expect(normalizeSource('recurring', recurringData)).toHaveLength(1)
    expect(normalizeSource('recurring', undefined)).toEqual([])
  })
})

describe('itemsForView — Pendentes de decisão × Tudo', () => {
  const items: NormalizedRitualItem[] = [
    { id: 'a', kind: 'task', title: 'A', decision: null },
    { id: 'b', kind: 'task', title: 'B', decision: 'keep' },
  ]

  it('Pendentes de decisão mostra só decision === null', () => {
    expect(itemsForView(items, 'pending', [])).toEqual([items[0]])
  })

  it('Tudo mostra o durável (decision !== null) UNIDO ao efêmero desta visita', () => {
    const mutatedThisVisit: NormalizedRitualItem[] = [
      { id: 'c', kind: 'task', title: 'C (migrada nesta visita)', decision: 'migrated' },
    ]
    const result = itemsForView(items, 'all', mutatedThisVisit)
    expect(result).toEqual([items[1], mutatedThisVisit[0]])
  })

  it('caso irmão: Tudo sem nenhuma mutação nesta visita mostra só o durável', () => {
    expect(itemsForView(items, 'all', [])).toEqual([items[1]])
  })
})
