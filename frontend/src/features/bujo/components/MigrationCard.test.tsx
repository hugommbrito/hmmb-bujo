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
  flowType?: 'daily' | 'weekly' | 'monthly'
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
        flowType={props.flowType}
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

describe('MigrationCard flowType="weekly" (Task 6)', () => {
  it('botão 1 tem o rótulo "Migrar para esta semana" e chama onDecide com destination=week', () => {
    const { onDecide } = renderCard({ flowType: 'weekly' })

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para esta semana' }))

    expect(onDecide).toHaveBeenCalledWith('week')
  })

  it('mantém os 4 botões (mesma anatomia do diário)', () => {
    renderCard({ flowType: 'weekly' })

    expect(screen.getByRole('button', { name: 'Migrar para esta semana' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adiar no mês' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adiar no Futuro' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    const { container } = renderCard({ flowType: 'weekly' })

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('MigrationCard flowType="monthly" (Task 6)', () => {
  it('não renderiza um botão "hoje/semana" — só 3 botões', () => {
    renderCard({ flowType: 'monthly' })

    expect(
      screen.queryByRole('button', { name: 'Migrar para hoje' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Migrar para esta semana' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('rótulo do botão de mês é "Definir data em [Mês]" e atalhos são 1-3', () => {
    renderCard({ flowType: 'monthly' })

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveTextContent(/^Definir data em /)
    expect(buttons[0]).toHaveTextContent('1')
    expect(buttons[1]).toHaveTextContent('Adiar no Futuro')
    expect(buttons[1]).toHaveTextContent('2')
    expect(buttons[2]).toHaveTextContent('Cancelar')
    expect(buttons[2]).toHaveTextContent('3')
  })

  it('clicar em "Definir data em [Mês]" chama onOpenPicker("month")', () => {
    const { onOpenPicker } = renderCard({ flowType: 'monthly' })

    fireEvent.click(screen.getAllByRole('button')[0])

    expect(onOpenPicker).toHaveBeenCalledWith('month')
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    const { container } = renderCard({ flowType: 'monthly' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
