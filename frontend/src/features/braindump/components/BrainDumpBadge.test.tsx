import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('../../auth', () => ({
  useAuth: () => ({
    userId: 'user-1',
    isAuthenticated: true,
    sessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

import client from '../../../api/client'
import { BrainDumpBadge } from './BrainDumpBadge'

const mockGet = client.get as ReturnType<typeof vi.fn>

function renderBadge(count: number, props: { max?: number } = {}) {
  mockGet.mockResolvedValueOnce({ data: { count } })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BrainDumpBadge max={props.max}>
        <span>icone</span>
      </BrainDumpBadge>
    </QueryClientProvider>,
  )
}

describe('BrainDumpBadge', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('fica invisível quando count é 0', async () => {
    const { container } = renderBadge(0)

    await waitFor(() =>
      expect(container.querySelector('.MuiBadge-invisible')).toBeInTheDocument(),
    )
  })

  it('mostra a contagem quando count > 0', async () => {
    renderBadge(3)

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
    expect(screen.getByText('3')).not.toHaveClass('MuiBadge-invisible')
  })

  it('aria-label contém a contagem atual', async () => {
    renderBadge(3)

    await waitFor(() =>
      expect(screen.getByLabelText('Brain Dump: 3 itens pendentes')).toBeInTheDocument(),
    )
  })

  it('sem violações de acessibilidade', async () => {
    const { container } = renderBadge(3)

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
    expect(await axe(container)).toHaveNoViolations()
  })

  // ── Cap `9+` do App Shell (BD-04 / DIV-6) — Story 13.2 ──────────────────────
  it('com max=9 mostra "9+" acima de 9 mas o aria-label mantém a contagem exata', async () => {
    renderBadge(17, { max: 9 })

    await waitFor(() => expect(screen.getByText('9+')).toBeInTheDocument())
    // Nome acessível preserva a contagem EXATA (derivado de count, não do texto).
    expect(screen.getByLabelText('Brain Dump: 17 itens pendentes')).toBeInTheDocument()
  })

  it('com max=9 mostra 9 literal quando count === 9 (sem cap)', async () => {
    renderBadge(9, { max: 9 })

    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument())
  })

  it('caminho legado (sem max) mostra a contagem cheia acima de 9', async () => {
    // Sem `max`, o Badge do MUI usa o default (99) — o uso legado
    // (Sidebar/BottomNav) não recebe o cap `9+` e não regride.
    renderBadge(17)

    await waitFor(() => expect(screen.getByText('17')).toBeInTheDocument())
  })
})
