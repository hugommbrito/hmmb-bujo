import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

const MONTHLY_TEMPLATE: RecurringTaskTemplate = {
  id: 'tpl-3',
  title: 'Revisão mensal',
  description: null,
  eisenhower: null,
  recurrenceGroup: 'monthly',
  recurrenceText: 'todo dia 5',
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

const ANNUAL_TEMPLATE: RecurringTaskTemplate = {
  id: 'tpl-4',
  title: 'Revisão anual',
  description: null,
  eisenhower: null,
  recurrenceGroup: 'annual',
  recurrenceText: 'todo janeiro',
  active: true,
}

function renderManager() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <RecurringTemplateManager />
    </ThemeProvider>,
  )
}

describe('RecurringTemplateManager (AC1, AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza as abas por grupo com "Semanal" selecionada por padrão', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [] })

    renderManager()

    const weeklyTab = screen.getByRole('tab', { name: 'Semanal' })
    expect(weeklyTab).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mensal' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Anual' })).toBeInTheDocument()
    expect(weeklyTab).toHaveAttribute('aria-selected', 'true')
  })

  it('a aba default mostra só o grupo weekly; clicar em "Mensal" mostra só o monthly', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({
      isPending: false,
      data: [WEEKLY_TEMPLATE, MONTHLY_TEMPLATE],
    })

    renderManager()

    // Aba default (Semanal): só o weekly
    expect(screen.getByText('Revisão semanal')).toBeInTheDocument()
    expect(screen.queryByText('Revisão mensal')).not.toBeInTheDocument()

    // Trocar para a aba Mensal: só o monthly
    fireEvent.click(screen.getByRole('tab', { name: 'Mensal' }))
    expect(screen.getByText('Revisão mensal')).toBeInTheDocument()
    expect(screen.queryByText('Revisão semanal')).not.toBeInTheDocument()
  })

  it('mostra mensagem por-aba quando o grupo corrente está vazio', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderManager()

    // Aba Mensal não tem templates → mensagem por-aba
    fireEvent.click(screen.getByRole('tab', { name: 'Mensal' }))
    expect(screen.getByText('Nenhum template neste grupo.')).toBeInTheDocument()
  })

  it('filtro "mostrar inativos" esconde inativos por padrão e os revela ao ligar o Switch', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({
      isPending: false,
      data: [INACTIVE_TEMPLATE],
    })

    renderManager()

    fireEvent.click(screen.getByRole('tab', { name: 'Mensal' }))
    // Padrão: só ativos → o monthly inativo não aparece
    expect(screen.queryByText('Template inativo')).not.toBeInTheDocument()

    // Ligar "Mostrar inativos" → aparece com o sufixo "(inativo)"
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar inativos' }))
    expect(screen.getByText('Template inativo')).toBeInTheDocument()
    expect(screen.getByText(/Mensal — todo dia 1 \(inativo\)/)).toBeInTheDocument()
  })

  it('criar na aba default (Semanal) chama a mutation com recurrenceGroup weekly', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [] })

    renderManager()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nova tarefa' } })
    fireEvent.change(screen.getByLabelText('Recorrência (texto livre)'), {
      target: { value: 'toda sexta' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith({
      title: 'Nova tarefa',
      description: null,
      eisenhower: null,
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
      active: true,
    })
  })

  it('criar na aba Mensal chama a mutation com recurrenceGroup monthly', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [] })

    renderManager()

    fireEvent.click(screen.getByRole('tab', { name: 'Mensal' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nova mensal' } })
    fireEvent.change(screen.getByLabelText('Recorrência (texto livre)'), {
      target: { value: 'todo dia 1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith({
      title: 'Nova mensal',
      description: null,
      eisenhower: null,
      recurrenceGroup: 'monthly',
      recurrenceText: 'todo dia 1',
      active: true,
    })
  })

  it('a aba "Anual" mostra só o grupo annual', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({
      isPending: false,
      data: [WEEKLY_TEMPLATE, MONTHLY_TEMPLATE, ANNUAL_TEMPLATE],
    })

    renderManager()

    fireEvent.click(screen.getByRole('tab', { name: 'Anual' }))
    expect(screen.getByText('Revisão anual')).toBeInTheDocument()
    expect(screen.queryByText('Revisão semanal')).not.toBeInTheDocument()
    expect(screen.queryByText('Revisão mensal')).not.toBeInTheDocument()
  })

  it('criar na aba Anual chama a mutation com recurrenceGroup annual', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [] })

    renderManager()

    fireEvent.click(screen.getByRole('tab', { name: 'Anual' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nova anual' } })
    fireEvent.change(screen.getByLabelText('Recorrência (texto livre)'), {
      target: { value: 'todo janeiro' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith({
      title: 'Nova anual',
      description: null,
      eisenhower: null,
      recurrenceGroup: 'annual',
      recurrenceText: 'todo janeiro',
      active: true,
    })
  })

  it('criar com descrição e eisenhower repassa esses campos no payload', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [] })

    renderManager()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Com detalhes' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'contexto extra' } })
    // O Eisenhower é um MUI Select: abrir o combobox e escolher a opção.
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Eisenhower' }))
    fireEvent.click(screen.getByRole('option', { name: 'Urgente + Importante' }))
    fireEvent.change(screen.getByLabelText('Recorrência (texto livre)'), {
      target: { value: 'toda sexta' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))

    expect(mockCreateMutate).toHaveBeenCalledWith({
      title: 'Com detalhes',
      description: 'contexto extra',
      eisenhower: 'ui',
      recurrenceGroup: 'weekly',
      recurrenceText: 'toda sexta',
      active: true,
    })
  })

  it('não cria template quando título ou recorrência estão vazios', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [] })

    renderManager()

    // Submeter form vazio → guarda de validação impede a mutation
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
    expect(mockCreateMutate).not.toHaveBeenCalled()

    // Só título, sem recorrência → ainda barrado
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Só título' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
    expect(mockCreateMutate).not.toHaveBeenCalled()
  })

  it('limpa os campos do form após criar com sucesso', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [] })

    renderManager()

    const titleInput = screen.getByLabelText('Título') as HTMLInputElement
    const recurrenceInput = screen.getByLabelText(
      'Recorrência (texto livre)',
    ) as HTMLInputElement

    fireEvent.change(titleInput, { target: { value: 'Nova tarefa' } })
    fireEvent.change(recurrenceInput, { target: { value: 'toda sexta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))

    expect(mockCreateMutate).toHaveBeenCalledTimes(1)
    expect(titleInput.value).toBe('')
    expect(recurrenceInput.value).toBe('')
  })

  it('não renderiza a mensagem de vazio enquanto a query está pendente (isPending)', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: true, data: undefined })

    renderManager()

    expect(screen.queryByText('Nenhum template neste grupo.')).not.toBeInTheDocument()
  })

  it('editar altera o template via update mutation', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderManager()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    // "Título" aparece 2× (form de criação + linha em edição) — escopar por índice.
    const [rowTitleInput] = screen.getAllByLabelText('Título')
    fireEvent.change(rowTitleInput, { target: { value: 'Novo título' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      templateId: 'tpl-1',
      title: 'Novo título',
      recurrenceText: 'toda sexta',
    })
  })

  it('salvar edição com título vazio não dispara a update mutation', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderManager()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    // Esvaziar o título da linha em edição (1º "Título" no DOM) e salvar.
    const [rowTitleInput] = screen.getAllByLabelText('Título')
    fireEvent.change(rowTitleInput, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(mockUpdateMutate).not.toHaveBeenCalled()
  })

  it('toggle active chama PATCH com o campo invertido', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderManager()

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }))

    expect(mockUpdateMutate).toHaveBeenCalledWith({ templateId: 'tpl-1', active: false })
  })

  it('a linha do template exibe a descrição quando presente (Story 11.9, AC1)', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({
      isPending: false,
      data: [{ ...WEEKLY_TEMPLATE, description: 'Fechar pendências da semana' }],
    })

    renderManager()

    expect(screen.getByText('Fechar pendências da semana')).toBeInTheDocument()
  })

  it('template sem descrição não mostra linha ruidosa (Story 11.9, AC2)', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderManager()

    // WEEKLY_TEMPLATE.description é null → só título + subline de recorrência.
    expect(screen.getByText('Revisão semanal')).toBeInTheDocument()
    expect(screen.queryByText('Fechar pendências da semana')).not.toBeInTheDocument()
  })

  it('form de criação segue o grupo da aba: escopo por within evita labels duplicados', () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({ isPending: false, data: [WEEKLY_TEMPLATE] })

    renderManager()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const form = screen.getByRole('form', { name: 'Novo template recorrente' })
    expect(within(form).getByLabelText('Título')).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseRecurringTemplatesQuery.mockReturnValue({
      isPending: false,
      data: [WEEKLY_TEMPLATE, MONTHLY_TEMPLATE, INACTIVE_TEMPLATE],
    })

    const { container } = renderManager()

    expect(await axe(container)).toHaveNoViolations()
  })
})
