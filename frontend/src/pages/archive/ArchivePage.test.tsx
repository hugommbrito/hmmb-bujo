import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { axe } from 'jest-axe'
import { ArchivePage } from './ArchivePage'

vi.mock('../../features/bujo', () => ({
  useArchiveQuery: vi.fn(),
}))

import { useArchiveQuery } from '../../features/bujo'

const mockUseArchiveQuery = useArchiveQuery as ReturnType<typeof vi.fn>

function renderArchivePage() {
  return render(
    <MemoryRouter initialEntries={['/archive']}>
      <Routes>
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/archive/weekly/:weekStart" element={<div>Semana aberta</div>} />
        <Route path="/archive/monthly/:monthFirst" element={<div>Mês aberto</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const ENTRIES = [
  { type: 'weekly', weekStart: '2026-07-13', monthFirst: null },
  { type: 'monthly', weekStart: null, monthFirst: '2026-07-01' },
]

describe('ArchivePage (AC2)', () => {
  it('mostra skeleton enquanto carrega', () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: true, data: undefined })

    renderArchivePage()

    expect(screen.getByLabelText('Arquivo')).toBeInTheDocument()
  })

  it('estado vazio mostra "Nenhuma semana ou mês fechado ainda."', () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: [] })

    renderArchivePage()

    expect(screen.getByText('Nenhuma semana ou mês fechado ainda.')).toBeInTheDocument()
  })

  it('lista renderiza rótulo de semana e de mês formatados corretamente', () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })

    renderArchivePage()

    expect(screen.getByText('Semana de 2026-07-13')).toBeInTheDocument()
    expect(screen.getByText('Julho 2026')).toBeInTheDocument()
  })

  it('clicar num item navega para a rota certa', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })
    const user = userEvent.setup()

    renderArchivePage()

    await user.click(screen.getByRole('link', { name: /Semana de 2026-07-13/ }))

    expect(screen.getByText('Semana aberta')).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })

    const { container } = renderArchivePage()

    expect(await axe(container)).toHaveNoViolations()
  })
})
