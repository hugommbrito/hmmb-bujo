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

function renderSection(
  recurrenceGroups: RecurringTaskTemplate['recurrenceGroup'][],
  onPlace = vi.fn(),
  placedTemplateIds?: Set<string>,
) {
  return {
    onPlace,
    ...render(
      <ThemeProvider theme={createBujoTheme('light')}>
        <RecurringPlacementSection
          recurrenceGroups={recurrenceGroups}
          onPlace={onPlace}
          placedTemplateIds={placedTemplateIds}
        />
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

  it('clicar "Definir placement" chama onPlace com o template certo', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    const { onPlace } = renderSection(['weekly'])

    fireEvent.click(screen.getByRole('button', { name: 'Definir placement' }))

    expect(onPlace).toHaveBeenCalledWith(WEEKLY_TEMPLATE)
  })

  it('dedup: template já colocado não aparece por padrão (AC1)', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderSection(['weekly'], vi.fn(), new Set(['tpl-1']))

    expect(screen.queryByText(/Revisão semanal/)).not.toBeInTheDocument()
  })

  it('ligar "Mostrar já colocados" revela o item com sufixo "(já colocado)" e permite recolocar', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    const { onPlace } = renderSection(['weekly'], vi.fn(), new Set(['tpl-1']))

    expect(screen.queryByText(/Revisão semanal/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar já colocados' }))

    expect(screen.getByText(/Revisão semanal — Semanal \(já colocado\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Definir placement' }))
    expect(onPlace).toHaveBeenCalledWith(WEEKLY_TEMPLATE)
  })

  it('sem placedTemplateIds, todos os templates aparecem (compat)', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderSection(['weekly'])

    expect(screen.getByText(/Revisão semanal/)).toBeInTheDocument()
  })

  it('exibe a descrição do template quando presente (Story 11.9, AC1)', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({
      isPending: false,
      data: [{ ...WEEKLY_TEMPLATE, description: 'Rodar a retrospectiva' }],
    })

    renderSection(['weekly'])

    expect(screen.getByText('Rodar a retrospectiva')).toBeInTheDocument()
  })

  it('não exibe linha de descrição quando o template não tem descrição (Story 11.9, AC2)', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderSection(['weekly'])

    // WEEKLY_TEMPLATE.description é null → só a linha "título — Grupo".
    expect(screen.getByText(/Revisão semanal/)).toBeInTheDocument()
    expect(screen.queryByText('Rodar a retrospectiva')).not.toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    const { container } = renderSection(['weekly'])

    expect(await axe(container)).toHaveNoViolations()
  })
})
