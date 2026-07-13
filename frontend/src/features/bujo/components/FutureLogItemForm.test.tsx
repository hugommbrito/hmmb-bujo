import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { FutureLogItemForm } from './FutureLogItemForm'

function renderForm(onAdd = vi.fn()) {
  const utils = render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <FutureLogItemForm onAdd={onAdd} />
    </ThemeProvider>,
  )
  return { ...utils, onAdd }
}

describe('FutureLogItemForm (AC2)', () => {
  it('submeter só título + mês chama onAdd sem scheduledDate', () => {
    const { onAdd } = renderForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Trocar pneus' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-07' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(onAdd).toHaveBeenCalledWith({ monthFirst: '2026-07-01', title: 'Trocar pneus' })
  })

  it('submeter título + mês + dia chama onAdd com scheduledDate', () => {
    const { onAdd } = renderForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Pix VG' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-07' } })
    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(onAdd).toHaveBeenCalledWith({
      monthFirst: '2026-07-01',
      title: 'Pix VG',
      scheduledDate: '2026-07-14',
    })
  })

  it('não chama onAdd sem título', () => {
    const { onAdd } = renderForm()

    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-07' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(onAdd).not.toHaveBeenCalled()
  })

  it('não chama onAdd sem mês', () => {
    const { onAdd } = renderForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Sem mês' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(onAdd).not.toHaveBeenCalled()
  })

  it('limpa os campos após submeter com sucesso', () => {
    renderForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Trocar pneus' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-07' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(screen.getByLabelText('Título')).toHaveValue('')
  })

  it('sem violações de acessibilidade (jest-axe) contra o componente real', async () => {
    const { container } = renderForm()

    expect(await axe(container)).toHaveNoViolations()
  })
})
