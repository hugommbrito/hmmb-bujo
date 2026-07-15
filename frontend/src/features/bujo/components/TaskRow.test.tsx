import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { TaskRow } from './TaskRow'
import type { Task } from '../types'

const mockMigrateMutate = vi.fn()

// TaskRow renderiza o TaskDestinationDialog real (não mockado) desde a
// 11.6 — jest-axe/lógica só valem contra o componente de verdade (lição
// recorrente 3.3-11.5). Só os hooks de API do diálogo são mockados aqui.
vi.mock('../api', () => ({
  useMigrateTaskMutation: () => ({ mutate: mockMigrateMutate, isError: false }),
  useTaskDensityQuery: () => ({ data: [] }),
}))

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Finalizar relatório Q2',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

function renderTaskRow(task: Task, onTransition = vi.fn(), onOpenDetail = vi.fn()) {
  render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <TaskRow task={task} onTransition={onTransition} onOpenDetail={onOpenDetail} />
    </ThemeProvider>,
  )
  return { onTransition, onOpenDetail }
}

describe('TaskRow (AC2)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('exibe o título da tarefa', () => {
    renderTaskRow(baseTask({ title: 'Consulado PT' }))
    expect(screen.getByText('Consulado PT')).toBeInTheDocument()
  })

  it('borda esquerda usa a cor da categoria', () => {
    renderTaskRow(baseTask({ category: 'teal' }))
    expect(screen.getByTestId('task-row')).toHaveStyle({ borderLeftColor: '#2BADA0' })
  })

  it('borda esquerda cai para divider quando category é null', () => {
    renderTaskRow(baseTask({ category: null }))
    expect(screen.getByTestId('task-row')).toHaveStyle({ borderLeftColor: '#DDD8CF' })
  })

  it('touch target mínimo de 44px no mobile', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    renderTaskRow(baseTask())

    expect(screen.getByTestId('task-row')).toHaveStyle({ minHeight: '44px' })
  })

  it('clicar no ícone pending chama onTransition com "started"', () => {
    const { onTransition } = renderTaskRow(baseTask({ status: 'pending' }))

    fireEvent.click(screen.getByRole('button', { name: 'Pendente' }))

    expect(onTransition).toHaveBeenCalledWith('task-1', 'started')
  })

  it('clicar no ícone started chama onTransition com "completed"', () => {
    const { onTransition } = renderTaskRow(baseTask({ status: 'started' }))

    fireEvent.click(screen.getByRole('button', { name: 'Em andamento' }))

    expect(onTransition).toHaveBeenCalledWith('task-1', 'completed')
  })

  it('clicar no ícone completed chama onTransition com "pending" (fecha o ciclo)', () => {
    const { onTransition } = renderTaskRow(baseTask({ status: 'completed' }))

    fireEvent.click(screen.getByRole('button', { name: 'Concluída' }))

    expect(onTransition).toHaveBeenCalledWith('task-1', 'pending')
  })

  it('ícone de migrated não é clicável', () => {
    const { onTransition } = renderTaskRow(baseTask({ status: 'migrated' }))

    const button = screen.getByRole('button', { name: 'Migrada' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onTransition).not.toHaveBeenCalled()
  })

  it('ícone de postponed não é clicável', () => {
    renderTaskRow(baseTask({ status: 'postponed' }))
    expect(screen.getByRole('button', { name: 'Adiada' })).toBeDisabled()
  })

  it('ícone de cancelled não é clicável e título fica tachado', () => {
    renderTaskRow(baseTask({ status: 'cancelled', title: 'Tarefa cancelada' }))

    expect(screen.getByRole('button', { name: 'Cancelada' })).toBeDisabled()
    expect(screen.getByText('Tarefa cancelada')).toHaveStyle({ textDecoration: 'line-through' })
  })

  it('chip Eisenhower omitido quando eisenhower é null', () => {
    renderTaskRow(baseTask({ eisenhower: null }))
    expect(screen.queryByText('U+I')).not.toBeInTheDocument()
  })

  it('chip Eisenhower omitido quando eisenhower é "none"', () => {
    renderTaskRow(baseTask({ eisenhower: 'none' }))
    expect(screen.queryByText('—')).not.toBeInTheDocument()
    expect(screen.queryByText('U+I')).not.toBeInTheDocument()
  })

  it('chip Eisenhower "U+I" exibido quando eisenhower é "ui"', () => {
    renderTaskRow(baseTask({ eisenhower: 'ui' }))
    expect(screen.getByText('U+I')).toBeInTheDocument()
  })

  it('chip de status "Iniciada" exibido para started', () => {
    renderTaskRow(baseTask({ status: 'started' }))
    expect(screen.getByText('Iniciada')).toBeInTheDocument()
  })

  it('chip de status "Feita" exibido para completed', () => {
    renderTaskRow(baseTask({ status: 'completed' }))
    expect(screen.getByText('Feita')).toBeInTheDocument()
  })

  it('nenhum chip de status para pending', () => {
    renderTaskRow(baseTask({ status: 'pending' }))
    expect(screen.queryByText('Iniciada')).not.toBeInTheDocument()
    expect(screen.queryByText('Feita')).not.toBeInTheDocument()
  })

  it('linhagem de migração exibida quando migrationCount > 0 (Story 4.6 AC#2)', () => {
    renderTaskRow(baseTask({ status: 'migrated', migrationCount: 2 }))
    expect(screen.getByText('↻ 2×')).toBeInTheDocument()
    expect(screen.getByLabelText('Migrada 2 vezes')).toBeInTheDocument()
  })

  it('linhagem singular usa "vez" para migrationCount === 1', () => {
    renderTaskRow(baseTask({ status: 'postponed', migrationCount: 1 }))
    expect(screen.getByLabelText('Migrada 1 vez')).toBeInTheDocument()
  })

  it('nenhum chip de linhagem quando migrationCount é 0 ou ausente', () => {
    renderTaskRow(baseTask({ status: 'pending', migrationCount: 0 }))
    expect(screen.queryByText(/↻/)).not.toBeInTheDocument()
  })

  it('anuncia o novo estado após o clique (aria-live)', () => {
    renderTaskRow(baseTask({ status: 'pending' }))

    fireEvent.click(screen.getByRole('button', { name: 'Pendente' }))

    expect(screen.getByRole('status')).toHaveTextContent('Tarefa marcada como Em andamento')
  })

  it('clique no título chama onOpenDetail com o id da tarefa (AC2)', () => {
    const { onOpenDetail } = renderTaskRow(baseTask({ id: 'task-42' }))

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Finalizar relatório Q2' }))

    expect(onOpenDetail).toHaveBeenCalledWith('task-42')
  })

  it('subtarefas em task.subtasks renderizam como linhas aninhadas com indentação (AC3)', () => {
    renderTaskRow(
      baseTask({
        subtasks: [
          { id: 'sub-1', title: 'Subtarefa 1', status: 'pending', subtasks: [] },
          { id: 'sub-2', title: 'Subtarefa 2', status: 'completed', subtasks: [] },
        ],
      }),
    )

    expect(screen.getByText('Subtarefa 1')).toBeInTheDocument()
    expect(screen.getByText('Subtarefa 2')).toBeInTheDocument()
    expect(screen.getAllByTestId('task-row')).toHaveLength(3)
  })

  it('ciclar o status de uma subtarefa não afeta o pai (AC3, sem cascata)', () => {
    const { onTransition } = renderTaskRow(
      baseTask({
        id: 'parent-1',
        subtasks: [{ id: 'sub-1', title: 'Subtarefa 1', status: 'pending', subtasks: [] }],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Subtarefa 1' }))
    // A busca acima só confirma que a subtarefa é independente na árvore; o
    // clique de transição usa o mesmo ícone de status do pai e da subtarefa —
    // aqui garantimos que cada um dispara `onTransition` com o seu próprio id.
    const statusButtons = screen.getAllByRole('button', { name: 'Pendente' })
    fireEvent.click(statusButtons[1])

    expect(onTransition).toHaveBeenCalledWith('sub-1', 'started')
    expect(onTransition).not.toHaveBeenCalledWith('parent-1', expect.anything())
  })
})

describe('TaskRow — somente-leitura (Story 4.1, Weekly/Monthly)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('renderiza só com a prop task, sem quebrar e sem chamar handlers', () => {
    render(
      <ThemeProvider theme={createBujoTheme('light')}>
        <TaskRow task={baseTask({ title: 'Tarefa da semana' })} />
      </ThemeProvider>,
    )

    expect(screen.getByText('Tarefa da semana')).toBeInTheDocument()
  })

  it('ícone de status fica desabilitado quando onTransition não é passado', () => {
    render(
      <ThemeProvider theme={createBujoTheme('light')}>
        <TaskRow task={baseTask({ status: 'pending' })} />
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: 'Pendente' })).toBeDisabled()
  })

  it('título não é um botão clicável quando onOpenDetail não é passado', () => {
    render(
      <ThemeProvider theme={createBujoTheme('light')}>
        <TaskRow task={baseTask({ title: 'Sem detalhe' })} />
      </ThemeProvider>,
    )

    expect(screen.queryByRole('button', { name: /Ver detalhes de/ })).not.toBeInTheDocument()
    expect(screen.getByText('Sem detalhe')).toBeInTheDocument()
  })

  it('linha não é arrastável quando onReorder não é passado', () => {
    render(
      <ThemeProvider theme={createBujoTheme('light')}>
        <TaskRow task={baseTask()} />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('task-row')).toHaveAttribute('draggable', 'false')
  })
})

describe('TaskRow — reorder (AC1, AC2)', () => {
  const target = baseTask({ id: 'task-2', title: 'Outra tarefa' })

  function renderReorderableTaskRow(overrides: Partial<Task> = {}) {
    const onReorder = vi.fn()
    const onTransition = vi.fn()
    const onOpenDetail = vi.fn()
    render(
      <ThemeProvider theme={createBujoTheme('light')}>
        <TaskRow
          task={baseTask(overrides)}
          onTransition={onTransition}
          onOpenDetail={onOpenDetail}
          siblings={[baseTask(overrides), target]}
          onReorder={onReorder}
        />
      </ThemeProvider>,
    )
    return { onReorder, onTransition, onOpenDetail }
  }

  function makeDataTransfer(initialDraggedId?: string) {
    const data: Record<string, string> = initialDraggedId ? { 'text/plain': initialDraggedId } : {}
    return {
      setData: (key: string, value: string) => {
        data[key] = value
      },
      getData: (key: string) => data[key],
      effectAllowed: '',
    }
  }

  // jsdom's native DragEvent construction silently drops `clientY` when a
  // custom (non-native) `dataTransfer` object is present in the init — build
  // the event manually and force the properties via `defineProperty` instead
  // of relying on fireEvent's init merging.
  function makeDragEvent(
    type: string,
    { dataTransfer = makeDataTransfer(), clientY = 0 }: { dataTransfer?: unknown; clientY?: number } = {},
  ) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer, configurable: true })
    Object.defineProperty(event, 'clientY', { value: clientY, configurable: true })
    return event as unknown as Event & { dataTransfer: ReturnType<typeof makeDataTransfer>; clientY: number }
  }

  function mockRowRect(rect: { top: number; height: number }) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      ...rect,
      bottom: rect.top + rect.height,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: rect.top,
      toJSON: () => {},
    } as DOMRect)
  }

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('dragover/drop de outra linha (task-2) na metade superior chama onReorder com position "before"', () => {
    const { onReorder } = renderReorderableTaskRow({ id: 'task-1' })
    const row = screen.getByTestId('task-row')
    mockRowRect({ top: 0, height: 40 })

    const event = makeDragEvent('dragover', { dataTransfer: makeDataTransfer('task-2'), clientY: 5 })
    act(() => {
      row.dispatchEvent(event)
    })
    act(() => {
      row.dispatchEvent(makeDragEvent('drop', { dataTransfer: event.dataTransfer, clientY: 5 }))
    })

    expect(onReorder).toHaveBeenCalledWith('task-2', 'task-1', 'before')
  })

  it('dragover na metade inferior da linha resulta em position "after"', () => {
    const { onReorder } = renderReorderableTaskRow({ id: 'task-1' })
    const row = screen.getByTestId('task-row')
    mockRowRect({ top: 0, height: 40 })

    const event = makeDragEvent('dragover', { dataTransfer: makeDataTransfer('task-2'), clientY: 35 })
    act(() => {
      row.dispatchEvent(event)
    })
    act(() => {
      row.dispatchEvent(makeDragEvent('drop', { dataTransfer: event.dataTransfer, clientY: 35 }))
    })

    expect(onReorder).toHaveBeenCalledWith('task-2', 'task-1', 'after')
  })

  it('soltar sobre si mesma não chama onReorder', () => {
    const { onReorder } = renderReorderableTaskRow({ id: 'task-1' })
    const row = screen.getByTestId('task-row')

    act(() => {
      row.dispatchEvent(makeDragEvent('drop', { dataTransfer: makeDataTransfer('task-1') }))
    })

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('indicador de linha aparece durante dragover e some após dragLeave/dragEnd', () => {
    renderReorderableTaskRow()
    const row = screen.getByTestId('task-row')
    mockRowRect({ top: 0, height: 40 })

    expect(screen.queryByTestId('drag-over-indicator')).not.toBeInTheDocument()

    act(() => {
      row.dispatchEvent(makeDragEvent('dragover'))
    })
    expect(screen.getByTestId('drag-over-indicator')).toBeInTheDocument()

    fireEvent.dragLeave(row)
    expect(screen.queryByTestId('drag-over-indicator')).not.toBeInTheDocument()

    act(() => {
      row.dispatchEvent(makeDragEvent('dragover'))
    })
    fireEvent.dragEnd(row)
    expect(screen.queryByTestId('drag-over-indicator')).not.toBeInTheDocument()
  })

  it('long-press (fake timers, ≥500ms) no mobile abre o MoveTaskDialog', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    vi.useFakeTimers()

    renderReorderableTaskRow()
    const row = screen.getByTestId('task-row')

    fireEvent.touchStart(row)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByText(/Mover ".*" para\.\.\./)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('onTouchMove antes dos 500ms cancela o long-press', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    vi.useFakeTimers()

    renderReorderableTaskRow()
    const row = screen.getByTestId('task-row')

    fireEvent.touchStart(row)
    fireEvent.touchMove(row)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.queryByText(/Mover ".*" para\.\.\./)).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('clique no botão "Reordenar tarefa" (desktop) abre o MoveTaskDialog', () => {
    renderReorderableTaskRow()

    fireEvent.click(screen.getByRole('button', { name: 'Reordenar tarefa' }))

    expect(screen.getByText(/Mover ".*" para\.\.\./)).toBeInTheDocument()
  })

  it('nenhum comportamento de reorder aparece quando onReorder/siblings não são passados', () => {
    renderTaskRow(baseTask())

    expect(screen.queryByRole('button', { name: 'Reordenar tarefa' })).not.toBeInTheDocument()
    expect(screen.getByTestId('task-row')).toHaveAttribute('draggable', 'false')
  })
})

describe('TaskRow — Mover (Story 11.6, AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('botão "Mover tarefa" aparece em toda TaskRow raiz, mesmo sem onReorder/onOpenDetail', () => {
    renderTaskRow(baseTask())

    expect(screen.getByRole('button', { name: 'Mover tarefa' })).toBeInTheDocument()
  })

  it('clique no botão "Mover tarefa" abre o TaskDestinationDialog', () => {
    renderTaskRow(baseTask({ title: 'Consulado PT' }))

    fireEvent.click(screen.getByRole('button', { name: 'Mover tarefa' }))

    expect(screen.getByRole('dialog', { name: 'Mover tarefa' })).toBeInTheDocument()
    expect(screen.getAllByText('Consulado PT').length).toBeGreaterThan(0)
  })

  it.each(['completed', 'cancelled', 'migrated', 'postponed'] as const)(
    'botão "Mover tarefa" desabilitado para status %s',
    (status) => {
      renderTaskRow(baseTask({ status }))

      expect(screen.getByRole('button', { name: 'Mover tarefa' })).toBeDisabled()
    },
  )

  it.each(['pending', 'started'] as const)(
    'botão "Mover tarefa" habilitado para status %s',
    (status) => {
      renderTaskRow(baseTask({ status }))

      expect(screen.getByRole('button', { name: 'Mover tarefa' })).toBeEnabled()
    },
  )

  it('botão "Mover tarefa" ausente para subtarefas', () => {
    renderTaskRow(
      baseTask({
        subtasks: [{ id: 'sub-1', title: 'Subtarefa 1', status: 'pending', subtasks: [] }],
      }),
    )

    expect(screen.getAllByRole('button', { name: 'Mover tarefa' })).toHaveLength(1)
  })
})
