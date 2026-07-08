import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../theme'
import { DailyPage } from './DailyPage'

const mockMutate = vi.fn()
const mockCreateTaskMutate = vi.fn()
const mockReorderMutate = vi.fn()

vi.mock('../../features/bujo', () => ({
  useTodayLogQuery: vi.fn(),
  useTransitionTaskMutation: vi.fn(() => ({ mutate: mockMutate })),
  useCreateTaskMutation: vi.fn(() => ({ mutate: mockCreateTaskMutate })),
  useReorderTaskMutation: vi.fn(() => ({ mutate: mockReorderMutate })),
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

  it('handleReorder chama useReorderTaskMutation().mutate com os argumentos repassados pelo TaskRow (drag-and-drop)', () => {
    mockUseTodayLogQuery.mockReturnValue({
      isPending: false,
      data: {
        id: 'log-1',
        logDate: '2026-06-15',
        tasks: [
          { id: 't1', title: 'Tarefa 1', status: 'pending', eisenhower: null, category: null, subtasks: [] },
          { id: 't2', title: 'Tarefa 2', status: 'pending', eisenhower: null, category: null, subtasks: [] },
        ],
      },
    })

    renderDailyPage()

    const rows = screen.getAllByTestId('task-row')
    const secondRow = rows[1]
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      height: 40,
      bottom: 40,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect)

    const data: Record<string, string> = { 'text/plain': 't1' }
    const dataTransfer = { getData: (key: string) => data[key], setData: () => {}, effectAllowed: '' }
    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true })
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer, configurable: true })
    Object.defineProperty(dragOverEvent, 'clientY', { value: 35, configurable: true })
    act(() => {
      secondRow.dispatchEvent(dragOverEvent)
    })

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer, configurable: true })
    Object.defineProperty(dropEvent, 'clientY', { value: 35, configurable: true })
    act(() => {
      secondRow.dispatchEvent(dropEvent)
    })

    expect(mockReorderMutate).toHaveBeenCalledWith({ taskId: 't1', targetTaskId: 't2', position: 'after' })
  })

  it('siblings/onReorder chegam só nas linhas raiz (subtarefa não recebe drag handle)', () => {
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
            subtasks: [
              { id: 'sub-1', title: 'Subtarefa 1', status: 'pending', eisenhower: null, category: null, subtasks: [] },
            ],
          },
          { id: 't2', title: 'Tarefa 2', status: 'pending', eisenhower: null, category: null, subtasks: [] },
        ],
      },
    })

    renderDailyPage()

    expect(screen.getAllByRole('button', { name: 'Mover tarefa' })).toHaveLength(2)
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
