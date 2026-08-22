import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../../api/client'
import { WeeklyContextRail, type WeeklyProgressSourceInput } from './WeeklyContextRail'
import type { WeeklyCycleReadiness } from '../../types'

const mockGet = client.get as ReturnType<typeof vi.fn>

const DENSITY = {
  days: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-07-${20 + i}`,
    total: i + 1,
    byStatus: { pending: i + 1, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 },
  })),
  undated: { total: 3, byStatus: { pending: 3, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 } },
  total: 31,
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function readiness(overrides: Partial<WeeklyCycleReadiness> = {}): WeeklyCycleReadiness {
  return {
    active: null,
    planning: { weekStart: '2026-07-20', status: 'planning', planningCompletedAt: null },
    start: {
      allowed: false,
      target: '2026-07-20',
      gates: { dateReached: true, planningCompleted: false, previousFinalized: true },
    },
    finalize: null,
    ...overrides,
  }
}

const FOUR_SOURCES: WeeklyProgressSourceInput[] = [
  { sourceId: 'monthly-in-week', eligibleNow: 2, pendingNow: 1 },
  { sourceId: 'recurring', eligibleNow: 3, pendingNow: 0 },
  { sourceId: 'previous-weekly', eligibleNow: 1, pendingNow: 1 },
  { sourceId: 'pending-dailies', eligibleNow: 0, pendingNow: 0 },
]

const noop = {
  onNavigateToSource: vi.fn(),
  onSelectDay: vi.fn(),
  onCompletePlanning: vi.fn(),
  onStart: vi.fn(),
  onFinalizePrevious: vi.fn(),
  onCancelPlanning: vi.fn(),
}

describe('WeeklyContextRail — densidade (AC6)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGet.mockResolvedValue({ data: DENSITY })
  })

  it('mostra 8 faixas (7 dias + Sem dia definido) com o total incluindo undated', async () => {
    render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
      { wrapper },
    )
    await waitFor(() => expect(screen.getByText('31 registros')).toBeInTheDocument())
    const densityGroup = screen.getByRole('group', { name: 'Densidade por dia' })
    // 7 dias + "Sem dia definido" = 8 faixas.
    expect(densityGroup.querySelectorAll('button')).toHaveLength(8)
    expect(screen.getByLabelText('Sem dia definido: 3 registros')).toBeInTheDocument()
  })

  it('selecionar um dia chama onSelectDay (escolhe destino, não abre inspeção)', async () => {
    const onSelectDay = vi.fn()
    render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
        onSelectDay={onSelectDay}
      />,
      { wrapper },
    )
    await waitFor(() => expect(screen.getByText('31 registros')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Sem dia definido: 3 registros'))
    expect(onSelectDay).toHaveBeenCalledWith(null)
  })
})

describe('WeeklyContextRail — progresso derivado (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGet.mockResolvedValue({ data: DENSITY })
  })

  it('Fontes revisadas tem denominador 4 (Monthly ampliado fica FORA)', () => {
    render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
      { wrapper },
    )
    const bar = screen.getByRole('progressbar', { name: 'Fontes revisadas' })
    expect(bar).toHaveAttribute('aria-valuemax', '4')
    // recurring e pending-dailies têm pendingNow=0 → 2 revisadas.
    expect(bar).toHaveAttribute('aria-valuenow', '2')
  })

  it('Itens decididos deriva do snapshot (elegível_snapshot − pendente_atual)', () => {
    render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
      { wrapper },
    )
    // snapshot inicial = eligibleNow de cada fonte: 2+3+1+0 = 6; pendentes: 1+0+1+0 = 2 → decididos = 4.
    const bar = screen.getByRole('progressbar', { name: 'Itens decididos' })
    expect(bar).toHaveAttribute('aria-valuemax', '6')
    expect(bar).toHaveAttribute('aria-valuenow', '4')
  })

  it('o snapshot NUNCA retrocede quando itens são decididos (só cresce com itens NOVOS)', () => {
    const { rerender } = render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
      { wrapper },
    )
    // Decide o pendente de monthly-in-week: eligibleNow cai para 1 (item saiu),
    // pendingNow cai para 0 — o snapshot (6) deve permanecer, não descer para 5.
    const afterDeciding: WeeklyProgressSourceInput[] = [
      { sourceId: 'monthly-in-week', eligibleNow: 1, pendingNow: 0 },
      { sourceId: 'recurring', eligibleNow: 3, pendingNow: 0 },
      { sourceId: 'previous-weekly', eligibleNow: 1, pendingNow: 1 },
      { sourceId: 'pending-dailies', eligibleNow: 0, pendingNow: 0 },
    ]
    rerender(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={afterDeciding}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
    )
    const bar = screen.getByRole('progressbar', { name: 'Itens decididos' })
    expect(bar).toHaveAttribute('aria-valuemax', '6') // snapshot preservado
    expect(bar).toHaveAttribute('aria-valuenow', '5') // 6 - (0+0+1+0) pendentes
  })

  it('caso irmão: um item NOVO estende o snapshot (não é ignorado)', () => {
    const { rerender } = render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
      { wrapper },
    )
    const withNewItem: WeeklyProgressSourceInput[] = [
      { sourceId: 'monthly-in-week', eligibleNow: 3, pendingNow: 2 }, // +1 item novo
      { sourceId: 'recurring', eligibleNow: 3, pendingNow: 0 },
      { sourceId: 'previous-weekly', eligibleNow: 1, pendingNow: 1 },
      { sourceId: 'pending-dailies', eligibleNow: 0, pendingNow: 0 },
    ]
    rerender(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={withNewItem}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
    )
    const bar = screen.getByRole('progressbar', { name: 'Itens decididos' })
    expect(bar).toHaveAttribute('aria-valuemax', '7') // snapshot ESTENDIDO (6 -> 7)
  })
})

describe('WeeklyContextRail — painel de verificação de Iniciar semana (AC3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGet.mockResolvedValue({ data: DENSITY })
  })

  it.each([
    [{ dateReached: true, planningCompleted: true, previousFinalized: true }, true],
    [{ dateReached: false, planningCompleted: true, previousFinalized: true }, false],
    [{ dateReached: true, planningCompleted: false, previousFinalized: true }, false],
    [{ dateReached: true, planningCompleted: true, previousFinalized: false }, false],
  ])('os 3 gates aparecem individualmente com ✓/✗ (%o)', (gates, allowed) => {
    render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness({ start: { allowed, target: '2026-07-20', gates } })}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
      { wrapper },
    )
    const panel = screen.getByRole('region', { name: 'Painel de verificação — Iniciar semana' })
    expect(panel).toHaveTextContent(gates.dateReached ? '✓' : '✗')
    expect(panel.textContent?.match(/✓|✗/g)).toHaveLength(3)
  })

  it('Iniciar semana fica desabilitado explicando o motivo (gate ✗ visível)', () => {
    render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
      { wrapper },
    )
    const button = screen.getByRole('button', { name: 'Iniciar semana' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Planejamento concluído')).toBeInTheDocument()
  })

  it('caso irmão: os 3 gates satisfeitos habilitam Iniciar semana', () => {
    render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness({
          start: {
            allowed: true,
            target: '2026-07-20',
            gates: { dateReached: true, planningCompleted: true, previousFinalized: true },
          },
        })}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
      { wrapper },
    )
    expect(screen.getByRole('button', { name: 'Iniciar semana' })).toHaveAttribute('aria-disabled', 'false')
  })
})

describe('WeeklyContextRail — Finalizar semana anterior e avisos (AC3/AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGet.mockResolvedValue({ data: DENSITY })
  })

  it('aviso bloqueante (Weekly anterior com pendências) some e vira "pronta para finalizar" ao zerar', () => {
    const { rerender } = render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={2}
        previousPeriodStart="2026-07-13"
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
      { wrapper },
    )
    expect(screen.getByRole('alert')).toHaveTextContent('2 pendência(s)')
    expect(screen.queryByText('Semana anterior pronta para finalizar.')).not.toBeInTheDocument()

    rerender(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness({ finalize: { allowed: true, target: '2026-07-13', gates: { noOpenTasks: true, nextPlanningExists: true } } })}
        progressSources={FOUR_SOURCES.map((s) => (s.sourceId === 'previous-weekly' ? { ...s, pendingNow: 0 } : s))}
        previousWeeklyPendingCount={0}
        previousPeriodStart="2026-07-13"
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
      />,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Semana anterior pronta para finalizar.')).toBeInTheDocument()
  })

  it('Finalizar semana anterior usa previousPeriodStart (não weekStart - 7)', () => {
    const onFinalizePrevious = vi.fn()
    render(
      <WeeklyContextRail
        weekStart="2026-07-27"
        readiness={readiness({ finalize: { allowed: true, target: '2026-06-15', gates: { noOpenTasks: true, nextPlanningExists: true } } })}
        progressSources={FOUR_SOURCES.map((s) => (s.sourceId === 'previous-weekly' ? { ...s, pendingNow: 0 } : s))}
        previousWeeklyPendingCount={0}
        previousPeriodStart="2026-06-15" // NÃO é weekStart - 7 (que seria 2026-07-20)
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
        onFinalizePrevious={onFinalizePrevious}
      />,
      { wrapper },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar semana anterior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onFinalizePrevious).toHaveBeenCalled()
  })

  it('clicar num aviso de fonte navega para ela (Pendentes)', () => {
    const onNavigateToSource = vi.fn()
    render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning={false}
        planningCompletedAt={null}
        {...noop}
        onNavigateToSource={onNavigateToSource}
      />,
      { wrapper },
    )
    fireEvent.click(screen.getByText(/Monthly na semana: 1 pendente/))
    expect(onNavigateToSource).toHaveBeenCalledWith('monthly-in-week')
  })
})

describe('WeeklyContextRail — jest-axe', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGet.mockResolvedValue({ data: DENSITY })
  })

  it('sem violações de acessibilidade', async () => {
    const { container } = render(
      <WeeklyContextRail
        weekStart="2026-07-20"
        readiness={readiness()}
        progressSources={FOUR_SOURCES}
        previousWeeklyPendingCount={1}
        previousPeriodStart={null}
        canCancelPlanning
        planningCompletedAt={null}
        {...noop}
      />,
      { wrapper },
    )
    await waitFor(() => expect(screen.getByText('31 registros')).toBeInTheDocument())
    expect(await axe(container)).toHaveNoViolations()
  })
})
