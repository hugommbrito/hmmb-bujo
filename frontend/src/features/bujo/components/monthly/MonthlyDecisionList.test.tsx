import { render, screen, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MonthlyDecisionList } from './MonthlyDecisionList'
import type { NormalizedRitualItem } from './monthlyRitualSources'

const noop = {
  onRetry: vi.fn(),
  onAllocate: vi.fn(),
  onDeferToFutureLog: vi.fn(),
  onKeepUndated: vi.fn(),
  onComplete: vi.fn(),
  onCancel: vi.fn(),
  onMigrateNamedDay: vi.fn(),
  onChooseDestination: vi.fn(),
  onViewChange: vi.fn(),
}

describe('MonthlyDecisionList — recurring: agrupamento e ações (AC5)', () => {
  it('agrupa Mensais antes de Lembrete anual', () => {
    const items: NormalizedRitualItem[] = [
      { id: 'a', kind: 'template', title: 'Anual X', decision: null, recurrenceGroup: 'annual' },
      { id: 'm', kind: 'template', title: 'Mensal X', decision: null, recurrenceGroup: 'monthly' },
    ]
    render(
      <MonthlyDecisionList
        sourceId="recurring"
        targetMonthFirst="2026-08-01"
        items={items}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    const headings = screen.getAllByText(/Mensais|Lembrete anual/)
    expect(headings.map((h) => h.textContent)).toEqual(['Mensais', 'Lembrete anual'])
  })

  it('recurring só oferece Alocar/Adiar ao Future Log — nunca Concluir/Cancelar', () => {
    const items: NormalizedRitualItem[] = [
      { id: 'm', kind: 'template', title: 'Mensal X', decision: null, recurrenceGroup: 'monthly' },
    ]
    render(
      <MonthlyDecisionList
        sourceId="recurring"
        targetMonthFirst="2026-08-01"
        items={items}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Alocar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adiar ao Future Log' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
  })

  it('onAllocate dispara com o id do template', () => {
    const onAllocate = vi.fn()
    const items: NormalizedRitualItem[] = [
      { id: 'tpl-1', kind: 'template', title: 'Mensal X', decision: null, recurrenceGroup: 'monthly' },
    ]
    render(
      <MonthlyDecisionList
        sourceId="recurring"
        targetMonthFirst="2026-08-01"
        items={items}
        view="pending"
        loading={false}
        error={false}
        {...noop}
        onAllocate={onAllocate}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Alocar' }))
    expect(onAllocate).toHaveBeenCalledWith('tpl-1')
  })

  it('onDeferToFutureLog dispara com o id do template (única ação de adiamento em recurring)', () => {
    const onDeferToFutureLog = vi.fn()
    const items: NormalizedRitualItem[] = [
      { id: 'tpl-1', kind: 'template', title: 'Mensal X', decision: null, recurrenceGroup: 'monthly' },
    ]
    render(
      <MonthlyDecisionList
        sourceId="recurring"
        targetMonthFirst="2026-08-01"
        items={items}
        view="pending"
        loading={false}
        error={false}
        {...noop}
        onDeferToFutureLog={onDeferToFutureLog}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Adiar ao Future Log' }))
    expect(onDeferToFutureLog).toHaveBeenCalledWith('tpl-1')
  })

  it('grupo sem item presente não renderiza o próprio cabeçalho de seção (ex.: só Mensais, sem Lembrete anual)', () => {
    const items: NormalizedRitualItem[] = [
      { id: 'm', kind: 'template', title: 'Mensal X', decision: null, recurrenceGroup: 'monthly' },
    ]
    render(
      <MonthlyDecisionList
        sourceId="recurring"
        targetMonthFirst="2026-08-01"
        items={items}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.getByText('Mensais')).toBeInTheDocument()
    expect(screen.queryByText('Lembrete anual')).not.toBeInTheDocument()
  })

  it('já alocados (mensal e anual) aparecem em seções separadas, fora do progresso', () => {
    render(
      <MonthlyDecisionList
        sourceId="recurring"
        targetMonthFirst="2026-08-01"
        items={[]}
        alreadyPlacedItems={[{ id: 'p1', kind: 'template', title: 'Já no mês', decision: null }]}
        alreadyPlacedInYearItems={[{ id: 'p2', kind: 'template', title: 'Já no ano', decision: null }]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(within(screen.getByLabelText('Já alocados (fora do progresso)')).getByText('Já no mês')).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Já alocados no ano (fora do progresso)')).getByText('Já no ano'),
    ).toBeInTheDocument()
  })
})

describe('MonthlyDecisionList — future-log: 3 disposições, nunca Concluir/Cancelar (AC5)', () => {
  const items: NormalizedRitualItem[] = [
    { id: 't-1', kind: 'task', title: 'Tarefa do Future Log', decision: null, scheduledDate: '2026-07-15' },
  ]

  it('oferece escolher dia, manter sem dia e adiar — nunca concluir/cancelar', () => {
    render(
      <MonthlyDecisionList sourceId="future-log" targetMonthFirst="2026-08-01" items={items} view="pending" loading={false} error={false} {...noop} />,
    )
    expect(screen.getByRole('button', { name: 'Manter sem dia' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escolher destino…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adiar ao Future Log' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
  })

  it('migrate_named_day preserva o dia de origem (clamp) no rótulo do botão', () => {
    render(
      <MonthlyDecisionList sourceId="future-log" targetMonthFirst="2026-08-01" items={items} view="pending" loading={false} error={false} {...noop} />,
    )
    expect(screen.getByRole('button', { name: /Migrar para dia 15/ })).toBeInTheDocument()
  })

  it('onKeepUndated dispara com o id da tarefa', () => {
    const onKeepUndated = vi.fn()
    render(
      <MonthlyDecisionList
        sourceId="future-log"
        targetMonthFirst="2026-08-01"
        items={items}
        view="pending"
        loading={false}
        error={false}
        {...noop}
        onKeepUndated={onKeepUndated}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Manter sem dia' }))
    expect(onKeepUndated).toHaveBeenCalledWith('t-1')
  })
})

describe('MonthlyDecisionList — previous-monthly: fonte bloqueante (AC5)', () => {
  const items: NormalizedRitualItem[] = [
    { id: 't-2', kind: 'task', title: 'Tarefa pendente do mês anterior', decision: null, scheduledDate: '2026-07-20' },
  ]

  it('oferece concluir, cancelar, migrar e adiar — nunca Manter/Manter sem dia', () => {
    render(
      <MonthlyDecisionList sourceId="previous-monthly" targetMonthFirst="2026-08-01" items={items} view="pending" loading={false} error={false} {...noop} />,
    )
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escolher destino…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adiar ao Future Log' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Manter sem dia' })).not.toBeInTheDocument()
  })
})

describe('MonthlyDecisionList — offline e erro por item (AC5/AC7)', () => {
  it('offline: ações ficam aria-disabled e não disparam', () => {
    const onComplete = vi.fn()
    const items: NormalizedRitualItem[] = [{ id: 't-3', kind: 'task', title: 'X', decision: null }]
    render(
      <MonthlyDecisionList
        sourceId="previous-monthly"
        targetMonthFirst="2026-08-01"
        items={items}
        view="pending"
        loading={false}
        error={false}
        offline
        {...noop}
        onComplete={onComplete}
      />,
    )
    const button = screen.getByRole('button', { name: 'Concluir' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(button)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('erro por item mostra motivo + retry local sem remover o item da lista', () => {
    const onRetryItem = vi.fn()
    const items: NormalizedRitualItem[] = [{ id: 't-4', kind: 'task', title: 'Falhou', decision: null }]
    render(
      <MonthlyDecisionList
        sourceId="previous-monthly"
        targetMonthFirst="2026-08-01"
        items={items}
        view="pending"
        loading={false}
        error={false}
        itemErrors={{ 't-4': 'Não foi possível salvar a decisão. Tente novamente.' }}
        onRetryItem={onRetryItem}
        {...noop}
      />,
    )
    expect(screen.getByText('Falhou')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetryItem).toHaveBeenCalledWith('t-4')
  })

  it('erro de carregamento da fonte mostra retry global', () => {
    const onRetry = vi.fn()
    render(
      <MonthlyDecisionList sourceId="recurring" targetMonthFirst="2026-08-01" items={[]} view="pending" loading={false} error {...noop} onRetry={onRetry} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
