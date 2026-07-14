import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { RecurringPlacementSection } from './RecurringPlacementSection'
import type { RecurringTaskTemplate } from '../types'

vi.mock('../api', () => ({
  useRecurringTemplatesQuery: vi.fn(),
}))

import { useRecurringTemplatesQuery } from '../api'

const mockUseRecurringTemplatesQuery = useRecurringTemplatesQuery as ReturnType<typeof vi.fn>

const WEEKLY_TEMPLATE: RecurringTaskTemplate = {
  id: 'tpl-1',
  title: 'Revisão semanal',
  description: null,
  eisenhower: null,
  recurrenceGroup: 'weekly',
  recurrenceText: 'toda sexta',
  active: true,
}

const MONTHLY_TEMPLATE: RecurringTaskTemplate = {
  id: 'tpl-2',
  title: 'Revisão mensal',
  description: null,
  eisenhower: null,
  recurrenceGroup: 'monthly',
  recurrenceText: 'todo dia 1',
  active: true,
}

function renderSection(recurrenceGroups: RecurringTaskTemplate['recurrenceGroup'][], onPlace = vi.fn()) {
  return {
    onPlace,
    ...render(
      <ThemeProvider theme={createBujoTheme('light')}>
        <RecurringPlacementSection recurrenceGroups={recurrenceGroups} onPlace={onPlace} />
      </ThemeProvider>,
    ),
  }
}

describe('RecurringPlacementSection (AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('não renderiza sem templates ativos do(s) grupo(s) pedido(s)', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [] })

    const { container } = renderSection(['weekly'])

    expect(container).toBeEmptyDOMElement()
  })

  it('não renderiza enquanto isPending', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: true, data: undefined })

    const { container } = renderSection(['weekly'])

    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza só os templates do grupo certo quando a query retorna grupos mistos', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({
      isPending: false,
      data: [WEEKLY_TEMPLATE, MONTHLY_TEMPLATE],
    })

    renderSection(['weekly'])

    expect(screen.getByText(/Revisão semanal/)).toBeInTheDocument()
    expect(screen.queryByText(/Revisão mensal/)).not.toBeInTheDocument()
  })

  it('recurrenceGroups com múltiplos valores (monthly + annual) inclui ambos', () => {
    const annualTemplate = { ...MONTHLY_TEMPLATE, id: 'tpl-3', recurrenceGroup: 'annual' as const }
    mockUseRecurringTemplatesQuery.mockReturnValue({
      isPending: false,
      data: [WEEKLY_TEMPLATE, MONTHLY_TEMPLATE, annualTemplate],
    })

    renderSection(['monthly', 'annual'])

    expect(screen.queryByText(/Revisão semanal/)).not.toBeInTheDocument()
    expect(screen.getByText(/Revisão mensal — Mensal/)).toBeInTheDocument()
    expect(screen.getByText(/Revisão mensal — Anual/)).toBeInTheDocument()
  })

  it('clicar "Definir placement" chama onPlace com o templateId certo', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    const { onPlace } = renderSection(['weekly'])

    fireEvent.click(screen.getByRole('button', { name: 'Definir placement' }))

    expect(onPlace).toHaveBeenCalledWith('tpl-1')
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    const { container } = renderSection(['weekly'])

    expect(await axe(container)).toHaveNoViolations()
  })
})
