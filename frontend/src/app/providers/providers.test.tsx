import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Providers } from '.'
import { useColorMode } from './ColorModeContext'

function ColorModeDisplay() {
  const { mode, toggle } = useColorMode()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={toggle}>Toggle</button>
    </div>
  )
}

describe('Providers (AC2, AC3)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renderiza children corretamente', () => {
    render(<Providers><div data-testid="child">conteúdo</div></Providers>)
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('modo padrão é "light" quando localStorage está vazio', () => {
    render(<Providers><ColorModeDisplay /></Providers>)
    expect(screen.getByTestId('mode').textContent).toBe('light')
  })

  it('lê modo "dark" do localStorage na inicialização (AC3)', () => {
    localStorage.setItem('bujo-color-scheme', 'dark')
    render(<Providers><ColorModeDisplay /></Providers>)
    expect(screen.getByTestId('mode').textContent).toBe('dark')
  })

  it('lê modo "light" do localStorage na inicialização (AC3)', () => {
    localStorage.setItem('bujo-color-scheme', 'light')
    render(<Providers><ColorModeDisplay /></Providers>)
    expect(screen.getByTestId('mode').textContent).toBe('light')
  })

  it('toggle muda o modo de light para dark (AC3)', async () => {
    const user = userEvent.setup()
    render(<Providers><ColorModeDisplay /></Providers>)
    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.getByTestId('mode').textContent).toBe('dark')
  })

  it('toggle persiste o novo modo no localStorage (AC3)', async () => {
    const user = userEvent.setup()
    render(<Providers><ColorModeDisplay /></Providers>)
    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(localStorage.getItem('bujo-color-scheme')).toBe('dark')
  })

  it('toggle alterna de dark para light', async () => {
    localStorage.setItem('bujo-color-scheme', 'dark')
    const user = userEvent.setup()
    render(<Providers><ColorModeDisplay /></Providers>)
    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.getByTestId('mode').textContent).toBe('light')
    expect(localStorage.getItem('bujo-color-scheme')).toBe('light')
  })
})
