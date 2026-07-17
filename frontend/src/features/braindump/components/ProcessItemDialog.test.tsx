import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { ProcessItemDialog } from './ProcessItemDialog'
import type { BrainDumpItem } from '../types'

const mockProcessMutate = vi.fn()

vi.mock('../api', () => ({
  useProcessBrainDumpItemMutation: () => ({ mutate: mockProcessMutate, isError: false }),
}))

const ITEM: BrainDumpItem = {
  id: 'item-1',
  title: 'Ideia solta',
  description: null,
  targetLog: null,
  createdAt: '2026-07-16T10:00:00Z',
}

function renderDialog(onClose = vi.fn()) {
  render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <ProcessItemDialog item={ITEM} open onClose={onClose} />
    </ThemeProvider>,
  )
  return { onClose }
}

describe('ProcessItemDialog (AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('escolher "Futuro" exige mês preenchido antes de habilitar o botão de confirmar', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('tab', { name: 'Futuro' }))

    expect(screen.getByRole('button', { name: 'Mover' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-08' } })

    expect(screen.getByRole('button', { name: 'Mover' })).not.toBeDisabled()
  })

  it('escolher "Hoje" confirma direto com a mutation chamada com o destino certo', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Mover' }))

    expect(mockProcessMutate).toHaveBeenCalledWith(
      { itemId: 'item-1', destination: 'today', monthFirst: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('escolher "Esta Semana" confirma direto com o destino certo', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('tab', { name: 'Esta Semana' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }))

    expect(mockProcessMutate).toHaveBeenCalledWith(
      { itemId: 'item-1', destination: 'week', monthFirst: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('escolher "Este Mês" confirma direto sem enviar monthFirst', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('tab', { name: 'Este Mês' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }))

    expect(mockProcessMutate).toHaveBeenCalledWith(
      { itemId: 'item-1', destination: 'month', monthFirst: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('escolher "Futuro" com mês preenchido chama a mutation com monthFirst', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('tab', { name: 'Futuro' }))
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-08' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }))

    expect(mockProcessMutate).toHaveBeenCalledWith(
      { itemId: 'item-1', destination: 'future', monthFirst: '2026-08-01' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })
})
