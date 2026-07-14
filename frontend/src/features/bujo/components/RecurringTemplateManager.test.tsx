import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { RecurringTemplateManager } from './RecurringTemplateManager'
import type { RecurringTaskTemplate } from '../types'

const mockCreateMutate = vi.fn()
const mockUpdateMutate = vi.fn()

vi.mock('../api', () => ({
  useRecurringTemplatesQuery: vi.fn(),
  useCreateRecurringTemplateMutation: vi.fn(() => ({ mutate: mockCreateMutate })),
  useUpdateRecurringTemplateMutation: vi.fn(() => ({ mutate: mockUpdateMutate })),
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

const INACTIVE_TEMPLATE: RecurringTaskTemplate = {
  id: 'tpl-2',
  title: 'Template inativo',
  description: null,
  eisenhower: null,
  recurrenceGroup: 'monthly',
  recurrenceText: 'todo dia 1',
  active: false,
}

function renderManager() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <RecurringTemplateManager />
    </ThemeProvider>,
  )
}

describe('RecurringTemplateManager (AC1, AC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza título + recurrence_group + indicador ativo/inativo para cada template', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({
      isPending: false,
      data: [WEEKLY_TEMPLATE, INACTIVE_TEMPLATE],
    })

    renderManager()

    expect(screen.getByText('Revisão semanal')).toBeInTheDocument()
    expect(screen.getByText(/Semanal — toda sexta/)).toBeInTheDocument()
    expect(screen.getByText('Template inativo')).toBeInTheDocument()
    expect(screen.getByText(/Mensal — todo dia 1 \(inativo\)/)).toBeInTheDocument()
  })

  it('lista vazia mostra mensagem de nenhum template cadastrado', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [] })

    renderManager()

    expect(screen.getByText('Nenhum template cadastrado.')).toBeInTheDocument()
  })

  it('criar template via form chama a mutation com os campos certos', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [] })

    renderManager()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Revisão mensal' } })
    fireEvent.change(screen.getByLabelText('Recorrência (texto livre)'), {
      target: { value: 'todo dia 1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith({
      title: 'Revisão mensal',
      description: null,
      eisenhower: null,
      recurrenceGroup: 'weekly',
      recurrenceText: 'todo dia 1',
      active: true,
    })
  })

  it('editar altera o template via update mutation', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderManager()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const [rowTitleInput] = screen.getAllByLabelText('Título')
    fireEvent.change(rowTitleInput, { target: { value: 'Novo título' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      templateId: 'tpl-1',
      title: 'Novo título',
      recurrenceText: 'toda sexta',
    })
  })

  it('toggle active chama PATCH com o campo invertido', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderManager()

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }))

    expect(mockUpdateMutate).toHaveBeenCalledWith({ templateId: 'tpl-1', active: false })
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({
      isPending: false,
      data: [WEEKLY_TEMPLATE, INACTIVE_TEMPLATE],
    })

    const { container } = renderManager()

    expect(await axe(container)).toHaveNoViolations()
  })
})
