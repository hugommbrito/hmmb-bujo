import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { DailyPage } from './DailyPage'

const mockMutate = vi.fn()
const mockCreateTaskMutate = vi.fn()

vi.mock('../../features/bujo', () => ({
  useTodayLogQuery: vi.fn(),
  useTransitionTaskMutation: vi.fn(() => ({ mutate: mockMutate })),
  useCreateTaskMutation: vi.fn(() => ({ mutate: mockCreateTaskMutate })),
}))

vi.mock('../../features/bujo/components/TaskDetailPanel', () => ({
  TaskDetailPanel: ({ task, onClose }: { task?: { id: string; title: string }; onClose: () => void }) =>
    task ? (
      <div data-testid="task-detail-panel">
        <span>{task.title}</span>
        <button onClick={onClose}>Fechar painel</button>
      </div>
    ) : null,
}))

import { useTodayLogQuery } from '../../features/bujo'

const mockUseTodayLogQuery = useTodayLogQuery as ReturnType<typeof vi.fn>

function renderDailyPage() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <DailyPage />
    </ThemeProvider>,
  )
}

const EMPTY_TEXT = 'Nenhuma tarefa para hoje. Adicione ou migre do dia anterior.'

describe('DailyPage (AC1, AC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra skeleton enquanto o log está carregando (isPending)', () => {
    mockUseTodayLogQuery.mockReturnValue({ isPending: true, data: undefined })

    renderDailyPage()

    expect(screen.getByLabelText('Hoje')).toBeInTheDocument()
    expect(screen.queryByText(EMPTY_TEXT)).not.toBeInTheDocument()
  })

  it('mostra o estado vazio quando não há tarefas', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: { id: 'log-1', logDate: '2026-06-15', tasks: [] },
    })

    renderDailyPage()

    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument()
  })

  it('AddTaskRow aparece no fim da lista mesmo com lista vazia', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: { id: 'log-1', logDate: '2026-06-15', tasks: [] },
    })

    renderDailyPage()

    expect(screen.getByRole('textbox', { name: 'Nova tarefa' })).toBeInTheDocument()
  })

  it('mostra a lista de Task Rows quando há tarefas', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: {
        id: 'log-1',
        logDate: '2026-06-15',
        tasks: [
          {
            id: 't1',
            title: 'Tarefa 1',
            status: 'pending',
            eisenhower: null,
            category: null,
            subtasks: [],
          },
          {
            id: 't2',
            title: 'Tarefa 2',
            status: 'started',
            eisenhower: 'u',
            category: 'teal',
            subtasks: [],
          },
        ],
      },
    })

    renderDailyPage()

    expect(screen.getByText('Tarefa 1')).toBeInTheDocument()
    expect(screen.getByText('Tarefa 2')).toBeInTheDocument()
    expect(screen.queryByText(EMPTY_TEXT)).not.toBeInTheDocument()
  })

  it('clicar no ícone de status de uma Task Row aciona a mutação de transição (AC2, integração)', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: {
        id: 'log-1',
        logDate: '2026-06-15',
        tasks: [
          {
            id: 't1',
            title: 'Tarefa 1',
            status: 'pending',
            eisenhower: null,
            category: null,
            subtasks: [],
          },
        ],
      },
    })

    renderDailyPage()

    fireEvent.click(screen.getByRole('button', { name: 'Pendente' }))

    expect(mockMutate).toHaveBeenCalledWith({ taskId: 't1', toStatus: 'started' })
  })

  it('abrir e fechar o painel de detalhe via clique no título', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: {
        id: 'log-1',
        logDate: '2026-06-15',
        tasks: [
          {
            id: 't1',
            title: 'Tarefa 1',
            status: 'pending',
            eisenhower: null,
            category: null,
            subtasks: [],
          },
        ],
      },
    })

    renderDailyPage()

    expect(screen.queryByTestId('task-detail-panel')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Tarefa 1' }))
    expect(screen.getByTestId('task-detail-panel')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    expect(screen.queryByTestId('task-detail-panel')).not.toBeInTheDocument()
  })

  it('atalho N foca o campo de nova tarefa e não vaza o caractere "n" para o campo', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: { id: 'log-1', logDate: '2026-06-15', tasks: [] },
    })

    renderDailyPage()

    const input = screen.getByRole('textbox', { name: 'Nova tarefa' }) as HTMLInputElement
    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    window.dispatchEvent(event)

    expect(document.activeElement).toBe(input)
    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(input).toHaveValue('')
  })

  it('Ctrl+N/Cmd+N não é sequestrado pelo atalho de nova tarefa', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: { id: 'log-1', logDate: '2026-06-15', tasks: [] },
    })

    renderDailyPage()

    const input = screen.getByRole('textbox', { name: 'Nova tarefa' }) as HTMLInputElement
    const event = new KeyboardEvent('keydown', {
      key: 'n',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    window.dispatchEvent(event)

    expect(document.activeElement).not.toBe(input)
    expect(preventDefaultSpy).not.toHaveBeenCalled()
  })

  it('atalho N não interfere quando o foco já está em um campo editável', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: { id: 'log-1', logDate: '2026-06-15', tasks: [] },
    })

    renderDailyPage()

    const input = screen.getByRole('textbox', { name: 'Nova tarefa' }) as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: 'algum texto' } })

    fireEvent.keyDown(input, { key: 'n' })

    expect(input).toHaveValue('algum texto')
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: {
        id: 'log-1',
        logDate: '2026-06-15',
        tasks: [
          {
            id: 't1',
            title: 'Tarefa 1',
            status: 'pending',
            eisenhower: null,
            category: null,
            subtasks: [],
          },
        ],
      },
    })

    const { container } = renderDailyPage()

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Tarefa 1' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})
