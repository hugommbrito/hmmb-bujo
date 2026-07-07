import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { AddTaskRow } from './AddTaskRow'

function renderAddTaskRow(onAdd = vi.fn()) {
  const ref = createRef<HTMLInputElement>()
  render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <AddTaskRow ref={ref} onAdd={onAdd} />
    </ThemeProvider>,
  )
  return { onAdd, ref }
}

describe('AddTaskRow (AC1)', () => {
  it('Enter com título preenchido chama onAdd e limpa o campo', () => {
    const { onAdd } = renderAddTaskRow()
    const input = screen.getByRole('textbox', { name: 'Nova tarefa' })

    fireEvent.change(input, { target: { value: 'Comprar leite' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onAdd).toHaveBeenCalledWith('Comprar leite')
    expect(input).toHaveValue('')
  })

  it('Enter com título vazio não chama onAdd (título obrigatório)', () => {
    const { onAdd } = renderAddTaskRow()
    const input = screen.getByRole('textbox', { name: 'Nova tarefa' })

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onAdd).not.toHaveBeenCalled()
  })

  it('Enter com título só espaços não chama onAdd', () => {
    const { onAdd } = renderAddTaskRow()
    const input = screen.getByRole('textbox', { name: 'Nova tarefa' })

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onAdd).not.toHaveBeenCalled()
  })

  it('botão "Nova tarefa" aciona a mesma ação do Enter', () => {
    const { onAdd } = renderAddTaskRow()
    const input = screen.getByRole('textbox', { name: 'Nova tarefa' })

    fireEvent.change(input, { target: { value: 'Via botão' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))

    expect(onAdd).toHaveBeenCalledWith('Via botão')
  })

  it('a ref encaminhada foca o campo de título (suporte ao atalho N)', () => {
    const { ref } = renderAddTaskRow()

    ref.current?.focus()

    expect(ref.current).toBe(document.activeElement)
  })
})
