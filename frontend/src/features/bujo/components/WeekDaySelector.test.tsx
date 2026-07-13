import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { WeekDaySelector } from './WeekDaySelector'

const DAYS = [
  { date: '2026-07-13' },
  { date: '2026-07-14' },
  { date: '2026-07-15' },
  { date: '2026-07-16' },
  { date: '2026-07-17' },
  { date: '2026-07-18' },
  { date: '2026-07-19' },
]

function renderSelector(selectedIndex = 0, onSelect = vi.fn()) {
  const utils = render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <WeekDaySelector days={DAYS} selectedIndex={selectedIndex} onSelect={onSelect} />
    </ThemeProvider>,
  )
  return { ...utils, onSelect }
}

describe('WeekDaySelector (Story 4.1, AC3)', () => {
  it('renderiza os 7 dias da semana', () => {
    renderSelector()

    expect(screen.getAllByRole('tab')).toHaveLength(7)
  })

  it('clicar em um dia chama onSelect com o índice correto', () => {
    const { onSelect } = renderSelector()

    fireEvent.click(screen.getAllByRole('tab')[2])

    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('o dia selecionado tem aria-selected true e os demais false', () => {
    renderSelector(1)

    const tabs = screen.getAllByRole('tab')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('sem violações de acessibilidade (jest-axe) contra o componente real', async () => {
    const { container } = renderSelector()

    expect(await axe(container)).toHaveNoViolations()
  })
})
