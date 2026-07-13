import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { MigrationCard } from './MigrationCard'
import type { Task } from '../types'

const TASK: Task = {
  id: 't1',
  title: 'Revisar orçamento',
  description: 'Fechar a planilha do mês',
  status: 'pending',
  eisenhower: null,
  category: null,
  subtasks: [
    {
      id: 's1',
      title: 'Subtarefa 1',
      status: 'pending',
      eisenhower: null,
      category: null,
      subtasks: [],
    },
  ],
}

function renderCard(props: {
  index?: number
  total?: number
  activePicker?: 'none' | 'month' | 'future'
} = {}) {
  const onDecide = vi.fn()
  const onOpenPicker = vi.fn()
  const utils = render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <MigrationCard
        task={TASK}
        index={props.index ?? 0}
        total={props.total ?? 3}
        activePicker={props.activePicker ?? 'none'}
        onOpenPicker={onOpenPicker}
        onDecide={onDecide}
      />
    </ThemeProvider>,
  )
  return { ...utils, onDecide, onOpenPicker }
}

describe('MigrationCard (AC2)', () => {
  it('renderiza título, descrição e subtarefas', () => {
    renderCard()

    expect(screen.getByText('Revisar orçamento')).toBeInTheDocument()
    expect(screen.getByText('Fechar a planilha do mês')).toBeInTheDocument()
    expect(screen.getByText('Subtarefa 1')).toBeInTheDocument()
  })

  it('indicador "N de M revisadas" com o texto exato', () => {
    renderCard({ index: 1, total: 4 })

    expect(screen.getByText('2 de 4 revisadas')).toBeInTheDocument()
  })

  it('clicar em "Migrar para hoje" chama onDecide com destination=today', () => {
    const { onDecide } = renderCard()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))

    expect(onDecide).toHaveBeenCalledWith('today')
  })

  it('clicar em "Adiar no mês" chama onOpenPicker("month")', () => {
    const { onOpenPicker } = renderCard()

    fireEvent.click(screen.getByRole('button', { name: 'Adiar no mês' }))

    expect(onOpenPicker).toHaveBeenCalledWith('month')
  })

  it('clicar em "Adiar no Futuro" chama onOpenPicker("future")', () => {
    const { onOpenPicker } = renderCard()

    fireEvent.click(screen.getByRole('button', { name: 'Adiar no Futuro' }))

    expect(onOpenPicker).toHaveBeenCalledWith('future')
  })

  it('clicar em "Cancelar" chama onDecide com destination=cancel', () => {
    const { onDecide } = renderCard()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onDecide).toHaveBeenCalledWith('cancel')
  })

  it('picker de mês confirma automaticamente ao mudar a data', () => {
    const { onDecide } = renderCard({ activePicker: 'month' })

    fireEvent.change(screen.getByLabelText('Data no mês corrente'), {
      target: { value: '2026-07-20' },
    })

    expect(onDecide).toHaveBeenCalledWith('month', { scheduledDate: '2026-07-20' })
  })

  it('picker de futuro confirma ao escolher só o mês (sem dia)', () => {
    const { onDecide } = renderCard({ activePicker: 'future' })

    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-09' } })

    expect(onDecide).toHaveBeenCalledWith('future', {
      monthFirst: '2026-09-01',
      scheduledDate: undefined,
    })
  })

  it('picker de futuro confirma com o dia preenchido antes do mês', () => {
    const { onDecide } = renderCard({ activePicker: 'future' })

    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-09' } })

    expect(onDecide).toHaveBeenCalledWith('future', {
      monthFirst: '2026-09-01',
      scheduledDate: '2026-09-05',
    })
  })

  it('sem violações de acessibilidade (jest-axe) contra o componente real', async () => {
    const { container } = renderCard()

    expect(await axe(container)).toHaveNoViolations()
  })
})
