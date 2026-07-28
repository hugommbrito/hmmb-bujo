import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockMigrateMutate = vi.fn()
let unifiedQueueResult: { isPending: boolean; isError: boolean; data?: unknown; refetch: () => void }

vi.mock('../features/bujo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/bujo')>()
  return {
    ...actual,
    useUnifiedMigrationQueueQuery: () => unifiedQueueResult,
    useMigrateTaskMutation: () => ({ mutate: mockMigrateMutate }),
    useTodayLogQuery: () => ({ isPending: false, data: { id: 'log-1', logDate: '2026-07-21', tasks: [] } }),
    useWeeklyLogQuery: () => ({ isPending: false, data: { weekStart: '2026-07-20' } }),
    useMonthlyLogQuery: () => ({ isPending: false, data: { monthFirst: '2026-07-01' } }),
  }
})

import { MigrationRitualPage } from './MigrationRitualPage'

const TASK = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  title: 'Enviar documentos ao contador',
  status: 'pending',
  eisenhower: null,
  category: null,
  subtasks: [],
  ...overrides,
})

function queueWith(sections: { sourceId: string; periodStart: string; items: ReturnType<typeof TASK>[] }[]) {
  return {
    totalCount: sections.reduce((sum, s) => sum + s.items.length, 0),
    sections: ['month', 'week', 'day'].map((sourceId) => {
      const match = sections.find((s) => s.sourceId === sourceId)
      return {
        sourceId,
        count: match?.items.length ?? 0,
        groups: match ? [{ periodStart: match.periodStart, items: match.items }] : [],
      }
    }),
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/migration']}>
      <Routes>
        <Route path="/migration" element={<MigrationRitualPage />} />
        <Route path="/today" element={<div>Hoje</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MigrationRitualPage (Story 14.9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    unifiedQueueResult = { isPending: false, isError: false, data: undefined, refetch: vi.fn() }
  })

  afterEach(() => {
    // O teste "offline" espiona `navigator.onLine` — restaurar aqui, e não só
    // no fim daquele teste, evita vazar o stub para os demais se a asserção
    // falhar antes da linha de restauração.
    vi.restoreAllMocks()
  })

  it('loading: mostra o esqueleto', () => {
    unifiedQueueResult = { isPending: true, isError: false, refetch: vi.fn() }
    renderPage()
    expect(screen.getByRole('main', { name: 'Migração' })).toBeInTheDocument()
  })

  it('read-error: mostra motivo + retry', () => {
    const refetch = vi.fn()
    unifiedQueueResult = { isPending: false, isError: true, refetch }
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a migração.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('vazio: sem tally nesta sessão mostra "Nada para migrar"', () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([]),
      refetch: vi.fn(),
    }
    renderPage()
    expect(screen.getByText('Nada para migrar.')).toBeInTheDocument()
  })

  it('mostra rail de fontes, lista de decisão e rail de contexto — nunca Dialog', () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    renderPage()

    expect(screen.getByRole('navigation', { name: 'Fontes da migração' })).toBeInTheDocument()
    expect(screen.getByText('Enviar documentos ao contador')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Contexto da migração' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Migrar para hoje" chama a mutação com destination "today"', () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 't1', destination: 'today' },
      expect.anything(),
    )
  })

  it('"Cancelar" chama a mutação com destination "cancel"', () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 't1', destination: 'cancel' },
      expect.anything(),
    )
  })

  it('"Escolher destino…" abre o seletor compartilhado com as 3 abas', () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    expect(screen.getByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Esta semana',
      'Dia no mês',
      'Outro mês',
    ])
  })

  it('confirmar destino "Esta semana" chama a mutação com destination "week"', () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = screen.getByRole('dialog', { name: 'Escolher destino' })
    fireEvent.click(screen.getByRole('radio', { name: /Quarta/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Migrar para/ }))

    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 't1', destination: 'week', scheduledDate: '2026-07-22' },
      expect.anything(),
    )
  })

  it('"Pausar" navega para /today sem perder decisões', () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(screen.getByText('Hoje')).toBeInTheDocument()
  })

  it('erro de escrita: motivo inline + retry no item, sem perder a decisão', () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    mockMigrateMutate.mockImplementation((_vars, { onError }) => onError())
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar a decisão.')
    expect(screen.getByText('Enviar documentos ao contador')).toBeInTheDocument()
  })

  it('offline: banner de motivo aparece e ações ficam guardadas', () => {
    const onLineSpy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    renderPage()

    expect(screen.getByText(/Sem conexão\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    expect(mockMigrateMutate).not.toHaveBeenCalled()
    onLineSpy.mockRestore()
  })

  it('última decisão zera a fila e mostra o resumo factual antes de voltar ao Hoje', async () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    mockMigrateMutate.mockImplementation((_vars, { onSuccess }) => {
      unifiedQueueResult = { isPending: false, isError: false, data: queueWith([]), refetch: vi.fn() }
      onSuccess()
    })
    const { rerender } = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    rerender(
      <MemoryRouter initialEntries={['/migration']}>
        <Routes>
          <Route path="/migration" element={<MigrationRitualPage />} />
          <Route path="/today" element={<div>Hoje</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Migração concluída')).toBeInTheDocument()
    expect(screen.getByText('1 tarefa decidida. Nada ficou sem lugar.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao Hoje' }))
    await waitFor(() => expect(screen.getByText('Hoje')).toBeInTheDocument())
  })

  it('jest-axe: sem violações com o resumo aberto (lição das 14.6/14.7: nunca medir estrutura ARIA fechada)', async () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    mockMigrateMutate.mockImplementation((_vars, { onSuccess }) => {
      unifiedQueueResult = { isPending: false, isError: false, data: queueWith([]), refetch: vi.fn() }
      onSuccess()
    })
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    await screen.findByText('Migração concluída')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('jest-axe: sem violações com a lista e o seletor de destino abertos', async () => {
    unifiedQueueResult = {
      isPending: false,
      isError: false,
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
      refetch: vi.fn(),
    }
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
