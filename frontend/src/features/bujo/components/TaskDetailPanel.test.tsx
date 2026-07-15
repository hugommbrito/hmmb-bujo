import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, Box } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { TaskDetailPanel } from './TaskDetailPanel'
import type { Task } from '../types'

const mockUpdateMutate = vi.fn()
const mockCreateSubtaskMutate = vi.fn()
const mockDeleteMutate = vi.fn()

vi.mock('../api', () => ({
  useUpdateTaskMutation: () => ({ mutate: mockUpdateMutate }),
  useCreateSubtaskMutation: () => ({ mutate: mockCreateSubtaskMutate }),
  useDeleteTaskMutation: () => ({ mutate: mockDeleteMutate }),
}))

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Finalizar relatório Q2',
    description: 'Descrição inicial',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

function renderPanel(task: Task | undefined, isSubtask = false, onClose = vi.fn()) {
  render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <TaskDetailPanel task={task} isSubtask={isSubtask} onClose={onClose} />
    </ThemeProvider>,
  )
  return { onClose }
}

describe('TaskDetailPanel (AC2, AC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('não renderiza nada quando não há tarefa selecionada', () => {
    renderPanel(undefined)
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
  })

  it('abre com os valores atuais da tarefa', () => {
    renderPanel(baseTask())

    expect(screen.getByLabelText('Título')).toHaveValue('Finalizar relatório Q2')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Descrição inicial')
  })

  it('editar o título e sair do campo (blur) chama useUpdateTaskMutation com o patch correto', () => {
    renderPanel(baseTask())

    const titleInput = screen.getByLabelText('Título')
    fireEvent.change(titleInput, { target: { value: 'Título editado' } })
    fireEvent.blur(titleInput)

    expect(mockUpdateMutate).toHaveBeenCalledWith({ taskId: 'task-1', title: 'Título editado' })
  })

  it('editar a descrição e sair do campo (blur) chama useUpdateTaskMutation', () => {
    renderPanel(baseTask())

    const descriptionInput = screen.getByLabelText('Descrição')
    fireEvent.change(descriptionInput, { target: { value: 'Nova descrição' } })
    fireEvent.blur(descriptionInput)

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      taskId: 'task-1',
      description: 'Nova descrição',
    })
  })

  it('blur sem alterar o valor não chama a mutação', () => {
    renderPanel(baseTask())

    fireEvent.blur(screen.getByLabelText('Título'))

    expect(mockUpdateMutate).not.toHaveBeenCalled()
  })

  it('esvaziar o título e sair do campo reverte para o título original, sem chamar a mutação', () => {
    renderPanel(baseTask())

    const titleInput = screen.getByLabelText('Título')
    fireEvent.change(titleInput, { target: { value: '   ' } })
    fireEvent.blur(titleInput)

    expect(mockUpdateMutate).not.toHaveBeenCalled()
    expect(titleInput).toHaveValue('Finalizar relatório Q2')
  })

  it('dropdown de Eisenhower não duplica a opção "Nenhum"', () => {
    renderPanel(baseTask())

    fireEvent.mouseDown(screen.getByLabelText('Eisenhower'))

    expect(screen.getAllByRole('option', { name: 'Nenhum' })).toHaveLength(1)
  })

  it('adicionar subtarefa chama useCreateSubtaskMutation', () => {
    renderPanel(baseTask())

    const subtaskInput = screen.getByRole('textbox', { name: 'Nova subtarefa' })
    fireEvent.change(subtaskInput, { target: { value: 'Revisar dados' } })
    fireEvent.keyDown(subtaskInput, { key: 'Enter' })

    expect(mockCreateSubtaskMutate).toHaveBeenCalledWith({
      parentTaskId: 'task-1',
      title: 'Revisar dados',
    })
  })

  it('não exibe o input de adicionar subtarefa quando a tarefa aberta já é uma subtarefa', () => {
    renderPanel(baseTask(), true)

    expect(screen.queryByRole('textbox', { name: 'Nova subtarefa' })).not.toBeInTheDocument()
  })

  it('lista as subtarefas existentes', () => {
    renderPanel(
      baseTask({
        subtasks: [
          { id: 'sub-1', title: 'Subtarefa 1', status: 'pending', subtasks: [] },
        ],
      }),
    )

    expect(screen.getByText('Subtarefa 1')).toBeInTheDocument()
  })

  it('botão mostra "Excluir tarefa" pra task pending sem linhagem', () => {
    renderPanel(baseTask({ status: 'pending' }))

    expect(screen.getByRole('button', { name: 'Excluir tarefa' })).toBeInTheDocument()
  })

  it('botão mostra "Cancelar tarefa" pra task pending com migrationCount > 0', () => {
    renderPanel(baseTask({ status: 'pending', migrationCount: 1 }))

    expect(screen.getByRole('button', { name: 'Cancelar tarefa' })).toBeInTheDocument()
  })

  it('botão mostra "Cancelar tarefa" pra task pending com migratedToTask preenchido', () => {
    renderPanel(baseTask({ status: 'pending', migratedToTask: 'task-2' }))

    expect(screen.getByRole('button', { name: 'Cancelar tarefa' })).toBeInTheDocument()
  })

  it('botão mostra "Cancelar tarefa" pra task não-pending sem linhagem', () => {
    renderPanel(baseTask({ status: 'completed' }))

    expect(screen.getByRole('button', { name: 'Cancelar tarefa' })).toBeInTheDocument()
  })

  it('clicar no botão chama useDeleteTaskMutation().mutate e, no sucesso, onClose', () => {
    const { onClose } = renderPanel(baseTask({ status: 'pending' }))

    fireEvent.click(screen.getByRole('button', { name: 'Excluir tarefa' }))

    expect(mockDeleteMutate).toHaveBeenCalledWith(
      { taskId: 'task-1' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    mockDeleteMutate.mock.calls[0][1].onSuccess()
    expect(onClose).toHaveBeenCalled()
  })

  it('botão de excluir/cancelar ausente quando isSubtask', () => {
    renderPanel(baseTask({ status: 'pending' }), true)

    expect(screen.queryByRole('button', { name: 'Excluir tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar tarefa' })).not.toBeInTheDocument()
  })

  it('Esc fecha o painel', () => {
    const { onClose } = renderPanel(baseTask())

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('sem violações de acessibilidade (jest-axe) com o painel aberto', async () => {
    // A suíte de DailyPage.test.tsx mocka TaskDetailPanel para isolar
    // DailyPage — o que significa que o próprio componente real nunca foi
    // varrido pelo jest-axe (gap deixado pela Task 7.4). Este teste cobre o
    // componente real diretamente. Regra "region" desabilitada: o `Drawer`
    // (MUI Modal) é portalado para fora de `<main>` por design — isso não é
    // uma falha de acessibilidade do painel em si, só um artefato de testar
    // o componente fora da árvore completa da página.
    render(
      <ThemeProvider theme={createBujoTheme('light')}>
        <Box component="main" aria-label="Hoje">
          <TaskDetailPanel task={baseTask()} isSubtask={false} onClose={vi.fn()} />
        </Box>
      </ThemeProvider>,
    )

    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations()
  })
})
