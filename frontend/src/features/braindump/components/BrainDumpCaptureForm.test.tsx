import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { BrainDumpCaptureForm } from './BrainDumpCaptureForm'

function renderForm(onCapture = vi.fn()) {
  const ref = createRef<HTMLInputElement>()
  render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <BrainDumpCaptureForm ref={ref} onCapture={onCapture} />
    </ThemeProvider>,
  )
  return { onCapture, ref }
}

describe('BrainDumpCaptureForm (AC3)', () => {
  it('submeter só com título chama onCapture com targetLog: undefined', () => {
    const { onCapture } = renderForm()
    const title = screen.getByRole('textbox', { name: 'Título' })

    fireEvent.change(title, { target: { value: 'Ideia solta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Capturar' }))

    expect(onCapture).toHaveBeenCalledWith({
      title: 'Ideia solta',
      description: undefined,
      targetLog: undefined,
    })
  })

  it('escolher "Hoje" no select chama onCapture com targetLog: "today"', () => {
    const { onCapture } = renderForm()
    const title = screen.getByRole('textbox', { name: 'Título' })
    fireEvent.change(title, { target: { value: 'Ideia solta' } })

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Destino' }))
    fireEvent.click(screen.getByRole('option', { name: 'Hoje' }))
    fireEvent.click(screen.getByRole('button', { name: 'Capturar' }))

    expect(onCapture).toHaveBeenCalledWith({
      title: 'Ideia solta',
      description: undefined,
      targetLog: 'today',
    })
  })

  it('título vazio não submete', () => {
    const { onCapture } = renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Capturar' }))

    expect(onCapture).not.toHaveBeenCalled()
  })

  it('limpa os campos após submissão', () => {
    renderForm()
    const title = screen.getByRole('textbox', { name: 'Título' })
    const description = screen.getByRole('textbox', { name: 'Descrição' })

    fireEvent.change(title, { target: { value: 'Ideia solta' } })
    fireEvent.change(description, { target: { value: 'Detalhes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Capturar' }))

    expect(title).toHaveValue('')
    expect(description).toHaveValue('')
  })

  it('a ref encaminhada foca o campo de título', () => {
    const { ref } = renderForm()

    ref.current?.focus()

    expect(ref.current).toBe(document.activeElement)
  })
})
