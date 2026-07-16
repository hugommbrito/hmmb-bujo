import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { ThemeProvider, Box } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { TaskDetailPanel } from './TaskDetailPanel'
import type { Task } from '../types'

const mockUpdateMutate = vi.fn()
const mockCreateSubtaskMutate = vi.fn()
const mockDeleteMutate = vi.fn()
const mockMigrateMutate = vi.fn()

// TaskDetailPanel renderiza o TaskDestinationDialog real (não mockado) desde
// a 11.6 — jest-axe/lógica só valem contra o componente de verdade (lição
// recorrente 3.3-11.5). Só os hooks de API do diálogo são mockados aqui.
vi.mock('../api', () => ({
  useUpdateTaskMutation: () => ({ mutate: mockUpdateMutate }),
  useCreateSubtaskMutation: () => ({ mutate: mockCreateSubtaskMutate }),
  useDeleteTaskMutation: () => ({ mutate: mockDeleteMutate }),
  useMigrateTaskMutation: () => ({ mutate: mockMigrateMutate, isError: false }),
  useTaskDensityQuery: () => ({ data: [] }),
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

describe('TaskDetailPanel (AC1, AC2, AC3)', () => {
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

  it('editar os 4 campos e clicar "Salvar" dispara um único PATCH combinado e, no sucesso, onClose (AC1)', () => {
    const { onClose } = renderPanel(baseTask())

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título editado' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Nova descrição' } })

    fireEvent.mouseDown(screen.getByLabelText('Categoria'))
    fireEvent.click(screen.getByRole('option', { name: 'Teal' }))

    fireEvent.mouseDown(screen.getByLabelText('Eisenhower'))
    // name como string em getByRole faz match exato do nome acessível — casa
    // só "Urgente", não "Urgente + Importante".
    fireEvent.click(screen.getByRole('option', { name: 'Urgente' }))

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1)
    expect(mockUpdateMutate).toHaveBeenCalledWith(
      {
        taskId: 'task-1',
        title: 'Título editado',
        description: 'Nova descrição',
        eisenhower: 'u',
        category: 'teal',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    mockUpdateMutate.mock.calls[0][1].onSuccess()
    expect(onClose).toHaveBeenCalled()
  })

  it('campos vazios são enviados como null no patch de "Salvar" (AC1)', () => {
    renderPanel(baseTask())

    // Limpa a descrição; categoria/eisenhower já começam vazios (null),
    // exercitando o mapeamento "vazio → null" (`description || null`, etc.).
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1)
    expect(mockUpdateMutate).toHaveBeenCalledWith(
      {
        taskId: 'task-1',
        title: 'Finalizar relatório Q2',
        description: null,
        eisenhower: null,
        category: null,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('abre com categoria/eisenhower já definidos e limpá-los para "Nenhum" envia null no "Salvar" (AC1)', () => {
    // Story 11.7 promoveu categoria/eisenhower a rascunho local: o painel deve
    // inicializar os Selects a partir da tarefa (não só título/descrição) e o
    // caminho reverso — limpar um valor já definido para "Nenhuma"/"Nenhum" —
    // tem de mapear para null no patch (`category || null`, `eisenhower || null`).
    renderPanel(baseTask({ category: 'teal', eisenhower: 'u' }))

    expect(screen.getByLabelText('Categoria')).toHaveTextContent('Teal')
    expect(screen.getByLabelText('Eisenhower')).toHaveTextContent('Urgente')

    fireEvent.mouseDown(screen.getByLabelText('Categoria'))
    fireEvent.click(screen.getByRole('option', { name: 'Nenhuma' }))

    fireEvent.mouseDown(screen.getByLabelText('Eisenhower'))
    fireEvent.click(screen.getByRole('option', { name: 'Nenhum' }))

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1)
    expect(mockUpdateMutate).toHaveBeenCalledWith(
      {
        taskId: 'task-1',
        title: 'Finalizar relatório Q2',
        description: 'Descrição inicial',
        eisenhower: null,
        category: null,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('fechar o painel (Fechar) sem salvar não persiste — rascunho descartado (AC2)', () => {
    const { onClose } = renderPanel(baseTask())

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Rascunho não salvo' } })
    fireEvent.click(screen.getByLabelText('Fechar'))

    expect(mockUpdateMutate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('fechar o painel (Esc) sem salvar não persiste (AC2)', () => {
    renderPanel(baseTask())

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Rascunho não salvo' } })
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    expect(mockUpdateMutate).not.toHaveBeenCalled()
  })

  it('fechar o painel (clique no backdrop) sem salvar não persiste (AC2)', () => {
    // AC2 enumera três caminhos de fechar — Fechar / Esc / backdrop. O Drawer
    // (MUI Modal) renderiza um backdrop clicável; clicar nele dispara onClose
    // sem tocar na mutação, igual aos outros dois caminhos (rascunho descartado).
    const { onClose } = renderPanel(baseTask())

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Rascunho não salvo' } })
    const backdrop = document.querySelector('.MuiBackdrop-root')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop as Element)

    expect(mockUpdateMutate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('botão "Salvar" desabilitado com título vazio/whitespace, habilitado com título válido (AC2)', () => {
    renderPanel(baseTask())

    const saveButton = screen.getByRole('button', { name: 'Salvar' })
    expect(saveButton).toBeEnabled()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '   ' } })
    expect(saveButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título válido' } })
    expect(saveButton).toBeEnabled()
  })

  it('botão "Salvar" presente também para subtarefa, ao contrário de "Mover"/"Excluir" (AC3)', () => {
    renderPanel(baseTask({ status: 'pending' }), true)

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mover tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir tarefa' })).not.toBeInTheDocument()
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

  it('botão "Mover tarefa" abre o TaskDestinationDialog', () => {
    renderPanel(baseTask({ status: 'pending' }))

    fireEvent.click(screen.getByRole('button', { name: 'Mover tarefa' }))

    expect(screen.getByRole('dialog', { name: 'Mover tarefa' })).toBeInTheDocument()
  })

  it('botão "Mover tarefa" desabilitado fora de pending/started', () => {
    renderPanel(baseTask({ status: 'completed' }))

    expect(screen.getByRole('button', { name: 'Mover tarefa' })).toBeDisabled()
  })

  it('botão "Mover tarefa" ausente quando isSubtask', () => {
    renderPanel(baseTask({ status: 'pending' }), true)

    expect(screen.queryByRole('button', { name: 'Mover tarefa' })).not.toBeInTheDocument()
  })

  it('sucesso da migração fecha o TaskDestinationDialog e o painel (onClose encadeado)', async () => {
    const { onClose } = renderPanel(baseTask({ status: 'pending' }))

    fireEvent.click(screen.getByRole('button', { name: 'Mover tarefa' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Este mês' }))
    fireEvent.change(screen.getByLabelText('Data no mês corrente'), {
      target: { value: '2026-07-20' },
    })

    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 'task-1', destination: 'month', scheduledDate: '2026-07-20' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    act(() => {
      mockMigrateMutate.mock.calls[0][1].onSuccess()
    })

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Mover tarefa' })).not.toBeInTheDocument(),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('cancelar o TaskDestinationDialog fecha só o diálogo, não o painel', async () => {
    const { onClose } = renderPanel(baseTask({ status: 'pending' }))

    fireEvent.click(screen.getByRole('button', { name: 'Mover tarefa' }))
    expect(screen.getByRole('dialog', { name: 'Mover tarefa' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Mover tarefa' })).not.toBeInTheDocument(),
    )
    expect(mockMigrateMutate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
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
