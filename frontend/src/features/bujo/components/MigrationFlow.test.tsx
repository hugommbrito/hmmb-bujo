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

function renderFlow(queue: Task[] = QUEUE, onClose = vi.fn()) {
  const utils = render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <MigrationFlow queue={queue} open onClose={onClose} />
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
