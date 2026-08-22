import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../../api/client'
import { MonthlyContextRail } from './MonthlyContextRail'
import type { MonthlyCycleReadiness } from '../../types'

const mockGet = client.get as ReturnType<typeof vi.fn>

const READINESS: MonthlyCycleReadiness = {
  active: { monthFirst: '2026-07-01', status: 'active', planningCompletedAt: null },
  planning: { monthFirst: '2026-08-01', status: 'planning', planningCompletedAt: null },
  start: { allowed: false, target: '2026-08-01', gates: { dateReached: false, planningCompleted: false, previousFinalized: false } },
  finalize: { allowed: false, target: '2026-07-01', gates: { noOpenTasks: false, nextPlanningExists: true } },
}

const DENSITY = {
  days: [{ date: '2026-08-01', total: 2, byStatus: { pending: 1, started: 0, completed: 1, cancelled: 0, migrated: 0, postponed: 0 } }],
  undated: { total: 3, byStatus: { pending: 2, started: 0, completed: 0, cancelled: 0, migrated: 1, postponed: 0 } },
  total: 5,
}

function renderRail(overrides: Partial<Parameters<typeof MonthlyContextRail>[0]> = {}) {
  mockGet.mockResolvedValue({ data: DENSITY })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MonthlyContextRail
        targetMonthFirst="2026-08-01"
        readiness={READINESS}
        progressSources={[
          { sourceId: 'recurring', eligibleNow: 3, pendingNow: 1 },
          { sourceId: 'future-log', eligibleNow: 2, pendingNow: 0 },
          { sourceId: 'previous-monthly', eligibleNow: 2, pendingNow: 2 },
        ]}
        previousMonthlyPendingCount={2}
        previousPeriodStart="2026-07-01"
        onNavigateToSource={vi.fn()}
        onSelectDay={vi.fn()}
        onCompletePlanning={vi.fn()}
        onStart={vi.fn()}
        onFinalizePrevious={vi.fn()}
        planningCompletedAt={null}
        {...overrides}
      />
    </QueryClientProvider>,
  )
}

describe('MonthlyContextRail — progresso sobre 3 fontes (AC5)', () => {
  it('denominador de "Fontes revisadas" é 3, não 4', async () => {
    renderRail()
    const bar = await screen.findByRole('progressbar', { name: 'Fontes revisadas' })
    expect(bar).toHaveAttribute('aria-valuemax', '3')
    // Só future-log tem pendingNow === 0 nos fixtures (recurring:1, previous-monthly:2 pendentes).
    expect(bar).toHaveTextContent('Fontes revisadas: 1/3')
  })

  it('itens decididos soma as 3 fontes', async () => {
    renderRail()
    const bar = await screen.findByRole('progressbar', { name: 'Itens decididos' })
    // eligible total = 3+2+2=7, pending total = 1+0+2=3 → decided = 4
    expect(bar).toHaveTextContent('Itens decididos: 4/7')
  })
})

describe('MonthlyContextRail — avisos (AC5)', () => {
  it('Monthly anterior pendente aparece como role="alert" bloqueante', async () => {
    renderRail()
    await screen.findByRole('progressbar', { name: 'Fontes revisadas' })
    expect(screen.getByRole('alert')).toHaveTextContent('Monthly anterior: 2 pendência(s) — bloqueia iniciar mês')
  })

  it('sem pendências no Monthly anterior, mostra mensagem de pronto para finalizar', async () => {
    renderRail({ previousMonthlyPendingCount: 0 })
    await screen.findByRole('progressbar', { name: 'Fontes revisadas' })
    expect(screen.getByText('Mês anterior pronto para finalizar.')).toBeInTheDocument()
  })

  it('fonte não-bloqueante com pendência aparece como aviso clicável', async () => {
    const onNavigateToSource = vi.fn()
    renderRail({ onNavigateToSource })
    await screen.findByRole('progressbar', { name: 'Fontes revisadas' })
    fireEvent.click(screen.getByText(/Recorrentes: 1 pendente/))
    expect(onNavigateToSource).toHaveBeenCalledWith('recurring')
  })
})

describe('MonthlyContextRail — painel de verificação e ações do ciclo (AC3)', () => {
  it('mostra os 3 gates individuais de Iniciar mês', async () => {
    renderRail()
    await screen.findByRole('progressbar', { name: 'Fontes revisadas' })
    expect(screen.getByText(/Data alcançada/)).toBeInTheDocument()
    expect(screen.getByText('Planejamento concluído')).toBeInTheDocument()
    expect(screen.getByText('Monthly anterior finalizado')).toBeInTheDocument()
  })

  it('NÃO existe botão "Cancelar planejamento" em nenhuma tela do Monthly (AC3)', async () => {
    renderRail()
    await screen.findByRole('progressbar', { name: 'Fontes revisadas' })
    expect(screen.queryByRole('button', { name: 'Cancelar planejamento' })).not.toBeInTheDocument()
  })

  it('Finalizar mês anterior pede confirmação irreversível antes de disparar', async () => {
    const onFinalizePrevious = vi.fn()
    renderRail({
      previousMonthlyPendingCount: 0,
      onFinalizePrevious,
      readiness: { ...READINESS, finalize: { ...READINESS.finalize!, allowed: true } },
    })
    await screen.findByRole('progressbar', { name: 'Fontes revisadas' })
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar mês anterior' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onFinalizePrevious).toHaveBeenCalled()
  })

  it('"Concluir planejamento" vira "Revisar planejamento" quando já concluído', async () => {
    renderRail({ planningCompletedAt: '2026-07-18T12:00:00Z' })
    await screen.findByRole('progressbar', { name: 'Fontes revisadas' })
    expect(screen.getByRole('button', { name: 'Revisar planejamento' })).toBeInTheDocument()
  })
})

describe('MonthlyContextRail — minicalendário completo do mês (AC6)', () => {
  it('minicalendário expõe total + distribuição por status em nome acessível', async () => {
    renderRail()
    const cell = await screen.findByRole('gridcell', { name: /1 de agosto: 2 registros/ })
    expect(cell).toHaveAccessibleName(/1 pendente, 1 concluída/)
  })

  it('selecionar um dia chama onSelectDay com a data', async () => {
    const onSelectDay = vi.fn()
    renderRail({ onSelectDay })
    const cell = await screen.findByRole('gridcell', { name: /^1 de agosto:/ })
    fireEvent.click(cell)
    expect(onSelectDay).toHaveBeenCalledWith('2026-08-01')
  })

  it('"Sem dia definido" tem o mesmo tratamento (total + clique escolhe destino)', async () => {
    const onSelectDay = vi.fn()
    renderRail({ onSelectDay })
    const undated = await screen.findByRole('button', { name: /Sem dia definido: 3 registros/ })
    fireEvent.click(undated)
    expect(onSelectDay).toHaveBeenCalledWith(null)
  })
})
