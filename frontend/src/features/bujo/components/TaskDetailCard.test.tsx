import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { ReactNode } from 'react'

vi.mock('../api', () => ({
  useUpdateTaskMutation: vi.fn(),
  useDeleteTaskMutation: vi.fn(),
  useTransitionTaskMutation: vi.fn(),
  useCreateSubtaskMutation: vi.fn(),
  invalidateRitualQueries: vi.fn(),
}))

import {
  useCreateSubtaskMutation,
  useDeleteTaskMutation,
  useTransitionTaskMutation,
  useUpdateTaskMutation,
} from '../api'
import { TaskDetailCard } from './TaskDetailCard'
import type { Task } from '../types'

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Tarefa original',
    description: null,
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mockMutations({
  updateImpl,
  deleteImpl,
  transitionImpl,
  createSubtaskImpl,
}: {
  updateImpl?: (vars: unknown, opts?: { onSuccess?: () => void; onError?: () => void }) => void
  deleteImpl?: (vars: unknown, opts?: { onSuccess?: () => void }) => void
  transitionImpl?: (vars: unknown, opts?: { onSuccess?: () => void }) => void
  createSubtaskImpl?: (vars: unknown) => void
} = {}) {
  const updateMutate = vi.fn(updateImpl ?? ((_vars, opts) => opts?.onSuccess?.()))
  const deleteMutate = vi.fn(deleteImpl ?? ((_vars, opts) => opts?.onSuccess?.()))
  const transitionMutate = vi.fn(transitionImpl ?? ((_vars, opts) => opts?.onSuccess?.()))
  const createSubtaskMutate = vi.fn(createSubtaskImpl ?? (() => {}))
  ;(useUpdateTaskMutation as unknown as Mock).mockReturnValue({ mutate: updateMutate, isPending: false })
  ;(useDeleteTaskMutation as unknown as Mock).mockReturnValue({ mutate: deleteMutate, isPending: false })
  ;(useTransitionTaskMutation as unknown as Mock).mockReturnValue({ mutate: transitionMutate, isPending: false })
  ;(useCreateSubtaskMutation as unknown as Mock).mockReturnValue({ mutate: createSubtaskMutate, isPending: false })
  return { updateMutate, deleteMutate, transitionMutate, createSubtaskMutate }
}

describe('TaskDetailCard — Categoria como radiogroup visual (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMutations()
  })

  it('renderiza radiogroup com 7 role=radio (Sem categoria + 6 swatches)', () => {
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByRole('radiogroup', { name: 'Categoria' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(7)
  })

  it('sem categoria fica marcado por padrão quando task.category é null', () => {
    render(<TaskDetailCard task={baseTask({ category: null })} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByRole('radio', { name: 'Sem categoria' })).toHaveAttribute('aria-checked', 'true')
  })

  it('clicar um swatch marca ele e desmarca "Sem categoria" (não-vacuidade)', () => {
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} />, { wrapper })
    fireEvent.click(screen.getByRole('radio', { name: 'Categoria Teal' }))
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Sem categoria' })).toHaveAttribute('aria-checked', 'false')
  })

  it('cada swatch tem nome acessível próprio', () => {
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} />, { wrapper })
    for (const label of ['Teal', 'Purple', 'Pink', 'Yellow', 'Green', 'Blue']) {
      expect(screen.getByRole('radio', { name: `Categoria ${label}` })).toBeInTheDocument()
    }
  })
})

describe('TaskDetailCard — Eisenhower como 2 checkboxes derivando o enum (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMutations()
  })

  it('nenhum checkbox marcado quando eisenhower é null', () => {
    render(<TaskDetailCard task={baseTask({ eisenhower: null })} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByRole('checkbox', { name: /urgente/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /importante/i })).not.toBeChecked()
  })

  it('eisenhower "ui" marca AMBOS os checkboxes', () => {
    render(<TaskDetailCard task={baseTask({ eisenhower: 'ui' })} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByRole('checkbox', { name: /urgente/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /importante/i })).toBeChecked()
  })

  it('marcar só Urgente deriva "u"; marcar Importante também deriva "ui"', () => {
    const { updateMutate } = mockMutations()
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} />, { wrapper })

    fireEvent.click(screen.getByRole('checkbox', { name: /urgente/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(updateMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ eisenhower: 'u' }),
      expect.anything(),
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /importante/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(updateMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ eisenhower: 'ui' }),
      expect.anything(),
    )
  })

  it('desmarcar Urgente a partir de "ui" deriva "i" (não zera os dois)', () => {
    const { updateMutate } = mockMutations()
    render(<TaskDetailCard task={baseTask({ eisenhower: 'ui' })} onClose={vi.fn()} />, { wrapper })

    fireEvent.click(screen.getByRole('checkbox', { name: /urgente/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(updateMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ eisenhower: 'i' }),
      expect.anything(),
    )
  })
})

describe('TaskDetailCard — Categoria: navegação por seta (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMutations()
  })

  it('ArrowRight avança do item selecionado para o próximo e move o foco', () => {
    render(<TaskDetailCard task={baseTask({ category: null })} onClose={vi.fn()} />, { wrapper })
    const semCategoria = screen.getByRole('radio', { name: 'Sem categoria' })
    fireEvent.keyDown(semCategoria, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveFocus()
  })

  it('caso irmão: ArrowLeft recua', () => {
    render(<TaskDetailCard task={baseTask({ category: 'purple' })} onClose={vi.fn()} />, { wrapper })
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Purple' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute('aria-checked', 'true')
  })

  it('dá a volta (wrap): ArrowLeft em "Sem categoria" (primeira opção) vai para a última (Blue)', () => {
    render(<TaskDetailCard task={baseTask({ category: null })} onClose={vi.fn()} />, { wrapper })
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Sem categoria' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: 'Categoria Blue' })).toHaveAttribute('aria-checked', 'true')
  })

  it('dá a volta (wrap): ArrowRight na última opção (Blue) volta para "Sem categoria"', () => {
    render(<TaskDetailCard task={baseTask({ category: 'blue' })} onClose={vi.fn()} />, { wrapper })
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Blue' }), { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Sem categoria' })).toHaveAttribute('aria-checked', 'true')
  })

  it('em readonly, setas não movem a seleção', () => {
    render(<TaskDetailCard task={baseTask({ category: 'teal' })} onClose={vi.fn()} readonly />, { wrapper })
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Teal' }), { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('TaskDetailCard — Subtarefas: lista e criação por Enter (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMutations()
  })

  it('lista as subtarefas existentes da tarefa', () => {
    render(
      <TaskDetailCard
        task={baseTask({ subtasks: [baseTask({ id: 'sub-1', title: 'Subtarefa existente' })] })}
        onClose={vi.fn()}
      />,
      { wrapper },
    )
    expect(screen.getByText('Subtarefa existente')).toBeInTheDocument()
  })

  it('Enter em "Nova subtarefa" adiciona (cria via useCreateSubtaskMutation)', () => {
    const { createSubtaskMutate } = mockMutations()
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} />, { wrapper })

    const input = screen.getByLabelText('Nova subtarefa')
    fireEvent.change(input, { target: { value: 'Subtarefa nova' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(createSubtaskMutate).toHaveBeenCalledWith({ parentTaskId: 'task-1', title: 'Subtarefa nova' })
    expect(input).toHaveValue('')
  })

  it('Enter com campo vazio não chama a mutação', () => {
    const { createSubtaskMutate } = mockMutations()
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} />, { wrapper })
    fireEvent.keyDown(screen.getByLabelText('Nova subtarefa'), { key: 'Enter' })
    expect(createSubtaskMutate).not.toHaveBeenCalled()
  })

  it('caso irmão: subtarefa NÃO oferece "Nova subtarefa" (profundidade da árvore é 1 nível)', () => {
    render(<TaskDetailCard task={baseTask()} isSubtask onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByLabelText('Nova subtarefa')).not.toBeInTheDocument()
  })

  it('em readonly, o campo de nova subtarefa some (só leitura da lista existente)', () => {
    render(
      <TaskDetailCard
        task={baseTask({ subtasks: [baseTask({ id: 'sub-1', title: 'Subtarefa existente' })] })}
        onClose={vi.fn()}
        readonly
      />,
      { wrapper },
    )
    expect(screen.getByText('Subtarefa existente')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nova subtarefa')).not.toBeInTheDocument()
  })
})

describe('TaskDetailCard — footer com a hierarquia de UX-DR26 (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMutations()
  })

  it('expõe os 4 nomes acessíveis que os E2E já usam', () => {
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} onMove={vi.fn()} />, { wrapper })
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mover tarefa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar tarefa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir tarefa' })).toBeInTheDocument()
  })

  it('subtarefa NÃO expõe Mover/Cancelar/Excluir — só Salvar', () => {
    render(<TaskDetailCard task={baseTask()} isSubtask onClose={vi.fn()} />, { wrapper })
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mover tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir tarefa' })).not.toBeInTheDocument()
  })

  it('Mover tarefa chama onMove', () => {
    const onMove = vi.fn()
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} onMove={onMove} />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Mover tarefa' }))
    expect(onMove).toHaveBeenCalled()
  })

  it('Cancelar tarefa chama a TRANSIÇÃO para cancelled (não o DELETE) e fecha no sucesso', () => {
    const { transitionMutate, deleteMutate } = mockMutations()
    const onClose = vi.fn()
    render(<TaskDetailCard task={baseTask()} onClose={onClose} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar tarefa' }))
    expect(transitionMutate).toHaveBeenCalledWith(
      { taskId: 'task-1', toStatus: 'cancelled' },
      expect.anything(),
    )
    expect(deleteMutate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('caso irmão: Excluir tarefa chama o DELETE (não a transição) e fecha no sucesso', () => {
    const { deleteMutate, transitionMutate } = mockMutations()
    const onClose = vi.fn()
    render(<TaskDetailCard task={baseTask()} onClose={onClose} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: 'Excluir tarefa' }))
    expect(deleteMutate).toHaveBeenCalledWith({ taskId: 'task-1' }, expect.anything())
    expect(transitionMutate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})

describe('TaskDetailCard — readonly em semana finalized (AC3, gap fechado na Task 12)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMutations()
  })

  it('esconde o rodapé inteiro (Salvar/Mover/Cancelar/Excluir), mas Fechar continua', () => {
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} onMove={vi.fn()} readonly />, { wrapper })
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mover tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir tarefa' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
  })

  it('desabilita Título, Descrição e Eisenhower; Categoria fica aria-disabled e não responde a clique', () => {
    render(
      <TaskDetailCard task={baseTask({ category: 'teal', eisenhower: 'u' })} onClose={vi.fn()} readonly />,
      { wrapper },
    )
    expect(screen.getByLabelText('Título')).toBeDisabled()
    expect(screen.getByLabelText('Descrição')).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Urgente/ })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Importante/ })).toBeDisabled()

    const pinkSwatch = screen.getByRole('radio', { name: 'Categoria Pink' })
    expect(pinkSwatch).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(pinkSwatch)
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute('aria-checked', 'true')
    expect(pinkSwatch).toHaveAttribute('aria-checked', 'false')
  })

  it('Ctrl+Enter em readonly NÃO dispara escrita (defesa em profundidade além da ausência do botão)', () => {
    const { updateMutate } = mockMutations()
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} readonly />, { wrapper })
    fireEvent.keyDown(screen.getByLabelText('Título'), { key: 'Enter', ctrlKey: true })
    expect(updateMutate).not.toHaveBeenCalled()
  })
})

describe('TaskDetailCard — semântica de Enter (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('Enter no Título salva-e-fecha', () => {
    const { updateMutate } = mockMutations()
    const onClose = vi.fn()
    render(<TaskDetailCard task={baseTask()} onClose={onClose} />, { wrapper })

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Editado' } })
    fireEvent.keyDown(screen.getByLabelText('Título'), { key: 'Enter' })

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Editado' }),
      expect.anything(),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('Enter na Descrição NÃO salva (quebra linha nativamente)', () => {
    const { updateMutate } = mockMutations()
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} />, { wrapper })

    fireEvent.keyDown(screen.getByLabelText('Descrição'), { key: 'Enter' })

    expect(updateMutate).not.toHaveBeenCalled()
  })

  it('Ctrl+Enter de qualquer campo salva-e-fecha', () => {
    const { updateMutate } = mockMutations()
    const onClose = vi.fn()
    render(<TaskDetailCard task={baseTask()} onClose={onClose} />, { wrapper })

    fireEvent.keyDown(screen.getByLabelText('Descrição'), { key: 'Enter', ctrlKey: true })

    expect(updateMutate).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('Cmd+Enter (metaKey) também salva-e-fecha', () => {
    const { updateMutate } = mockMutations()
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} />, { wrapper })

    fireEvent.keyDown(screen.getByLabelText('Descrição'), { key: 'Enter', metaKey: true })

    expect(updateMutate).toHaveBeenCalled()
  })

  it('título vazio: Enter não fecha e o motivo fica visível/anunciado', () => {
    const { updateMutate } = mockMutations()
    const onClose = vi.fn()
    render(<TaskDetailCard task={baseTask()} onClose={onClose} />, { wrapper })

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '   ' } })
    fireEvent.keyDown(screen.getByLabelText('Título'), { key: 'Enter' })

    expect(updateMutate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('O título não pode ficar vazio.')
  })

  it('escrita em andamento: Enter não dispara um segundo salvamento', () => {
    ;(useUpdateTaskMutation as unknown as Mock).mockReturnValue({ mutate: vi.fn(), isPending: true })
    ;(useDeleteTaskMutation as unknown as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false })
    const onClose = vi.fn()
    render(<TaskDetailCard task={baseTask()} onClose={onClose} />, { wrapper })

    fireEvent.keyDown(screen.getByLabelText('Título'), { key: 'Enter' })

    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('TaskDetailCard — descarte × falha de escrita (AC2, ambiguidade #7)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('fechamento explícito (X) descarta o rascunho sem persistir', () => {
    const { updateMutate } = mockMutations()
    const onClose = vi.fn()
    render(<TaskDetailCard task={baseTask()} onClose={onClose} />, { wrapper })

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Rascunho não salvo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(updateMutate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('falha de escrita preserva o rascunho inteiro e mostra o motivo junto às ações', async () => {
    mockMutations({
      updateImpl: (_vars, opts) => opts?.onError?.(),
    })
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} />, { wrapper })

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Ainda não salvo' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Descrição no rascunho' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente novamente.'),
    )
    expect(screen.getByLabelText('Título')).toHaveValue('Ainda não salvo')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Descrição no rascunho')
  })
})

describe('TaskDetailCard — "Veio de" (linhagem, ambiguidade B6)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMutations()
  })

  it('mostra "Veio de <período>, <data>" quando o predecessor é fornecido', () => {
    render(
      <TaskDetailCard
        task={baseTask()}
        onClose={vi.fn()}
        predecessor={{ period: 'Segunda-feira', date: '20/07' }}
      />,
      { wrapper },
    )
    expect(screen.getByText('Veio de Segunda-feira, 20/07')).toBeInTheDocument()
  })

  it('caso irmão: sem predecessor, nada é exibido (nunca inventa link reverso)', () => {
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} predecessor={null} />, { wrapper })
    expect(screen.queryByText(/^Veio de/)).not.toBeInTheDocument()
  })
})

describe('TaskDetailCard — jest-axe', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMutations()
  })

  it('sem violações de acessibilidade', async () => {
    const { container } = render(
      <TaskDetailCard task={baseTask({ eisenhower: 'u', category: 'teal' })} onClose={vi.fn()} onMove={vi.fn()} />,
      { wrapper },
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('TaskDetailCard — allowCancel (Story 14.7, AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMutations()
  })

  it('allowCancel={false} omite SÓ "Cancelar tarefa" e preserva o resto do rodapé', () => {
    render(<TaskDetailCard task={baseTask()} allowCancel={false} onMove={vi.fn()} onClose={vi.fn()} />, {
      wrapper,
    })
    expect(screen.queryByRole('button', { name: 'Cancelar tarefa' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mover tarefa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir tarefa' })).toBeInTheDocument()
  })

  it('allowCancel={false} continua permitindo editar título (readonly NÃO serve aqui)', () => {
    render(<TaskDetailCard task={baseTask()} allowCancel={false} onClose={vi.fn()} />, { wrapper })
    const titulo = screen.getByLabelText('Título')
    fireEvent.change(titulo, { target: { value: 'Editado no Futuro' } })
    expect(titulo).toHaveValue('Editado no Futuro')
  })

  it('caso irmão: sem a prop (default) "Cancelar tarefa" continua no rodapé', () => {
    render(<TaskDetailCard task={baseTask()} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByRole('button', { name: 'Cancelar tarefa' })).toBeInTheDocument()
  })
})
