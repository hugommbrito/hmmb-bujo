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

function renderBadge(count: number) {
  mockGet.mockResolvedValueOnce({ data: { count } })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BrainDumpBadge>
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
})
