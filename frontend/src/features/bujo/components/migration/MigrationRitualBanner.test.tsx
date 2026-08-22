import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../api/client', () => ({
  default: { get: vi.fn() },
}))

import client from '../../../../api/client'
import { MIGRATION_SESSION_TOTAL_KEY } from './migrationRitualSources'
import { MigrationRitualBanner } from './MigrationRitualBanner'

const mockGet = client.get as ReturnType<typeof vi.fn>

const EMPTY_QUEUE = {
  totalCount: 0,
  sections: [
    { sourceId: 'month', count: 0, groups: [] },
    { sourceId: 'week', count: 0, groups: [] },
    { sourceId: 'day', count: 0, groups: [] },
  ],
}

function queueWith(counts: { month: number; week: number; day: number }) {
  return {
    totalCount: counts.month + counts.week + counts.day,
    sections: [
      { sourceId: 'month', count: counts.month, groups: [] },
      { sourceId: 'week', count: counts.week, groups: [] },
      { sourceId: 'day', count: counts.day, groups: [] },
    ],
  }
}

function renderBanner() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MigrationRitualBanner />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MigrationRitualBanner (Story 14.9)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('vazio = sem DOM quando a fila unificada não tem pendências', async () => {
    mockGet.mockResolvedValue({ data: EMPTY_QUEUE })
    const { container } = renderBanner()

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra a contagem total e o detalhamento por fonte (variante não-pausada)', async () => {
    mockGet.mockResolvedValue({ data: queueWith({ month: 3, week: 2, day: 3 }) })
    renderBanner()

    // O texto é composto por spans aninhados (`<b>N tarefas</b> precisam…`,
    // molde do mockup) — o aria-label da região carrega a sentença completa,
    // mais robusto do que casar texto fragmentado entre nós do DOM.
    const region = await screen.findByRole('region')
    expect(region).toHaveAttribute(
      'aria-label',
      '8 tarefas precisam de decisão · 3 de meses · 2 de semanas · 3 de dias',
    )
    expect(screen.getByRole('link', { name: /Migrar/ })).toHaveAttribute('href', '/migration')
  })

  it('variante PAUSADA aparece quando há M salvo em sessionStorage, com N ao vivo e M salvo', async () => {
    sessionStorage.setItem(MIGRATION_SESSION_TOTAL_KEY, '8')
    mockGet.mockResolvedValue({ data: queueWith({ month: 1, week: 2, day: 2 }) })
    renderBanner()

    const region = await screen.findByRole('region')
    expect(region).toHaveAttribute('aria-label', 'Migração pausada · 5 de 8 restantes')
    expect(screen.getByRole('link', { name: 'Retomar migração' })).toHaveAttribute('href', '/migration')
  })

  it('sem M salvo, a variante é a simples mesmo com itens na fila', async () => {
    mockGet.mockResolvedValue({ data: queueWith({ month: 0, week: 0, day: 1 }) })
    renderBanner()

    const region = await screen.findByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/1 tarefa precisa de decisão/)
    expect(region.getAttribute('aria-label')).not.toMatch(/Migração pausada/)
  })

  it('jest-axe: sem violações', async () => {
    mockGet.mockResolvedValue({ data: queueWith({ month: 1, week: 0, day: 0 }) })
    const { container } = renderBanner()
    await screen.findByRole('link', { name: /Migrar/ })
    expect(await axe(container)).toHaveNoViolations()
  })
})
