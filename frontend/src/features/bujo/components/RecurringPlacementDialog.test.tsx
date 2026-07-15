import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { RecurringPlacementDialog } from './RecurringPlacementDialog'
import type { RecurringTaskTemplate } from '../types'

vi.mock('../api', () => ({
  useTaskDensityQuery: vi.fn(),
}))

import { useTaskDensityQuery } from '../api'

const mockUseTaskDensityQuery = useTaskDensityQuery as ReturnType<typeof vi.fn>

const TEMPLATE: RecurringTaskTemplate = {
  id: 'tpl-1',
  title: 'Revisão mensal',
  description: 'Fechar as contas do mês',
  eisenhower: null,
  recurrenceGroup: 'monthly',
  recurrenceText: '3x por semana',
  active: true,
}

function renderDialog(props: Partial<Parameters<typeof RecurringPlacementDialog>[0]> = {}) {
  const defaults = {
    open: true,
    dateFieldType: 'date' as const,
    template: TEMPLATE,
    monthFirst: '2026-07-01',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  }
  const merged = { ...defaults, ...props }
  return {
    ...merged,
    ...render(
      <ThemeProvider theme={createBujoTheme('light')}>
        <RecurringPlacementDialog {...merged} />
      </ThemeProvider>,
    ),
  }
}

describe('RecurringPlacementDialog (AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTaskDensityQuery.mockReturnValue({
      data: [
        { date: '2026-07-10', count: 2 },
        { date: '2026-07-15', count: 1 },
      ],
    })
  })

  it('exibe título, descrição e recorrência do template', () => {
    renderDialog()

    expect(screen.getByText('Revisão mensal')).toBeInTheDocument()
    expect(screen.getByText('Fechar as contas do mês')).toBeInTheDocument()
    expect(screen.getByText('Recorrência: 3x por semana')).toBeInTheDocument()
  })

  it('monta o calendário de densidade com as contagens da query', () => {
    renderDialog()

    // Densidade determinística vinda do mock → dia 10 com 2 tarefas.
    expect(screen.getByLabelText('10 de julho, 2 tarefas')).toBeInTheDocument()
    expect(screen.getByLabelText('15 de julho, 1 tarefa')).toBeInTheDocument()
  })

  it('busca a densidade apenas quando aberto (enabled: open)', () => {
    renderDialog({ open: true })

    expect(mockUseTaskDensityQuery).toHaveBeenCalledWith('2026-07-01', { enabled: true })
  })

  it('coleta a data e chama onConfirm com o valor', () => {
    const { onConfirm } = renderDialog({ dateFieldType: 'date' })

    fireEvent.change(screen.getByLabelText('Data (opcional)'), { target: { value: '2026-07-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(onConfirm).toHaveBeenCalledWith('2026-07-20')
  })

  it('coleta o dia (dateFieldType="day") e chama onConfirm com o valor bruto', () => {
    const { onConfirm } = renderDialog({ dateFieldType: 'day' })

    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(onConfirm).toHaveBeenCalledWith('12')
  })

  it('sem template não renderiza o bloco de infos da recorrência', () => {
    renderDialog({ template: null })

    expect(screen.queryByText(/Recorrência:/)).not.toBeInTheDocument()
    // O calendário e a coleta de valor continuam presentes.
    expect(screen.getByLabelText('Data (opcional)')).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    renderDialog()
    // O conteúdo do MUI Dialog é portalado para fora do container do render —
    // axe(document.body) alcança o diálogo real (não um container vazio).
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
