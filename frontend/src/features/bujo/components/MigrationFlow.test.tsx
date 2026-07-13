import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { MigrationFlow } from './MigrationFlow'
import type { Task } from '../types'

const mockMutate = vi.fn()

vi.mock('../api', () => ({
  useMigrateTaskMutation: vi.fn(() => ({ mutate: mockMutate })),
}))

const QUEUE: Task[] = [
  { id: 't1', title: 'Primeira', status: 'pending', eisenhower: null, category: null, subtasks: [] },
  { id: 't2', title: 'Segunda', status: 'pending', eisenhower: null, category: null, subtasks: [] },
]

function renderFlow(
  queue: Task[] = QUEUE,
  onClose = vi.fn(),
  flowType?: 'daily' | 'weekly' | 'monthly',
) {
  const utils = render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <MigrationFlow queue={queue} open onClose={onClose} flowType={flowType} />
    </ThemeProvider>,
  )
  return { ...utils, onClose }
}

describe('MigrationFlow (AC2, AC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('avança pelos cartões na ordem da fila', () => {
    renderFlow()

    expect(screen.getByText('Primeira')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))

    expect(screen.getByText('Segunda')).toBeInTheDocument()
    expect(mockMutate).toHaveBeenCalledWith({ taskId: 't1', destination: 'today' })
  })

  it('Esc fecha sem decidir a tarefa atual', () => {
    const { onClose } = renderFlow()

    fireEvent.keyDown(screen.getByRole('button', { name: 'Migrar para hoje' }), {
      key: 'Escape',
    })

    expect(onClose).toHaveBeenCalled()
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('atalho "1" dá a mesma decisão que clicar em "Migrar para hoje"', () => {
    renderFlow()

    fireEvent.keyDown(window, { key: '1' })

    expect(mockMutate).toHaveBeenCalledWith({ taskId: 't1', destination: 'today' })
  })

  it('atalho "4" dá a mesma decisão que clicar em "Cancelar"', () => {
    renderFlow()

    fireEvent.keyDown(window, { key: '4' })

    expect(mockMutate).toHaveBeenCalledWith({ taskId: 't1', destination: 'cancel' })
  })

  it('atalho "2" abre o picker de mês (mesmo efeito de clicar em "Adiar no mês")', () => {
    renderFlow()

    fireEvent.keyDown(window, { key: '2' })

    expect(screen.getByLabelText('Data no mês corrente')).toBeInTheDocument()
  })

  it('fecha automaticamente após a última tarefa', () => {
    const { onClose } = renderFlow([QUEUE[1]])

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('não herda o "Dia" digitado no picker de futuro da tarefa anterior (troca de card remonta o MigrationCard)', () => {
    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: 'Adiar no Futuro' }))
    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '15' } })

    // Decide a tarefa atual por outro caminho (sem confirmar o picker de futuro) — avança para a próxima.
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    expect(screen.getByText('Segunda')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Adiar no Futuro' }))

    expect(screen.getByLabelText('Dia (opcional)')).toHaveValue(null)
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    const { container } = renderFlow()

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('MigrationFlow flowType="weekly" (Task 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('atalho "1" decide destination=week (mesmo efeito de "Migrar para esta semana")', () => {
    renderFlow(QUEUE, vi.fn(), 'weekly')

    fireEvent.keyDown(window, { key: '1' })

    expect(mockMutate).toHaveBeenCalledWith({ taskId: 't1', destination: 'week' })
  })

  it('clicar em "Migrar para esta semana" avança para o próximo card', () => {
    renderFlow(QUEUE, vi.fn(), 'weekly')

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para esta semana' }))

    expect(screen.getByText('Segunda')).toBeInTheDocument()
    expect(mockMutate).toHaveBeenCalledWith({ taskId: 't1', destination: 'week' })
  })
})

describe('MigrationFlow flowType="monthly" (Task 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('só 3 botões — sem atalho "hoje/semana"', () => {
    renderFlow(QUEUE, vi.fn(), 'monthly')

    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('atalho "1" abre o picker de mês (remapeado — não existe destino "hoje/semana")', () => {
    renderFlow(QUEUE, vi.fn(), 'monthly')

    fireEvent.keyDown(window, { key: '1' })

    expect(screen.getByLabelText('Data no mês corrente')).toBeInTheDocument()
  })

  it('atalho "2" abre o picker de futuro', () => {
    renderFlow(QUEUE, vi.fn(), 'monthly')

    fireEvent.keyDown(window, { key: '2' })

    expect(screen.getByLabelText('Mês')).toBeInTheDocument()
  })

  it('atalho "3" cancela (mesmo efeito de clicar em "Cancelar")', () => {
    renderFlow(QUEUE, vi.fn(), 'monthly')

    fireEvent.keyDown(window, { key: '3' })

    expect(mockMutate).toHaveBeenCalledWith({ taskId: 't1', destination: 'cancel' })
  })

  it('atalho "4" não faz nada (sem mapeamento em flowType monthly)', () => {
    renderFlow(QUEUE, vi.fn(), 'monthly')

    fireEvent.keyDown(window, { key: '4' })

    expect(mockMutate).not.toHaveBeenCalled()
  })
})
