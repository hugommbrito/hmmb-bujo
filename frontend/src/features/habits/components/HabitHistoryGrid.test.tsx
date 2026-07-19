import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'

import { createBujoTheme } from '../../../theme'
import { HabitHistoryGrid } from './HabitHistoryGrid'
import type { HabitDayEntry, HabitHistoryRange } from '../types'

const ENTRY_DONE: HabitDayEntry = {
  id: 'e1',
  habitId: 'h1',
  name: 'Ler',
  emoticon: '📖',
  type: 'boolean',
  group: 'g1',
  unit: '',
  value: '1.00',
  weightAtTime: '2.00',
  metaAtTime: null,
  bonusAtTime: null,
  dayType: 'weekday',
  multiplierAtTime: '1.00',
}

const DATA: HabitHistoryRange = {
  start: '2026-01-05',
  end: '2026-01-10',
  habits: [{ id: 'h1', name: 'Ler', emoticon: '📖', type: 'boolean', unit: '', group: 'g1' }],
  days: [
    {
      date: '2026-01-05',
      dayType: 'weekday',
      totalCompletion: 100,
      groups: [{ id: 'g1', name: 'Saúde', completion: 100 }],
      entries: [ENTRY_DONE],
    },
    { date: '2026-01-06', dayType: 'weekday', totalCompletion: null, groups: [], entries: [] },
    { date: '2026-01-10', dayType: 'weekend', totalCompletion: null, groups: [], entries: [] },
  ],
}

function renderGrid() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <HabitHistoryGrid data={DATA} />
    </ThemeProvider>,
  )
}

describe('HabitHistoryGrid', () => {
  it('renderiza uma <table> com headers programáticos', () => {
    renderGrid()
    expect(screen.getByRole('table')).toBeInTheDocument()
    // header de linha = hábito; header de coluna = data.
    expect(screen.getByRole('rowheader', { name: /Ler/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /05\/01\/2026/ })).toBeInTheDocument()
  })

  it('distingue fim de semana por TEXTO/aria (não só cor)', () => {
    renderGrid()
    // aria do header de coluna de sábado inclui "Fim de semana"
    expect(screen.getByRole('columnheader', { name: /Fim de semana/ })).toBeInTheDocument()
    // tag textual visível
    expect(screen.getByText('FDS')).toBeInTheDocument()
  })

  it('células anunciam data + estado; lacuna = "—" honesto', () => {
    renderGrid()
    // dia feito
    expect(screen.getByLabelText('Ler, 05/01/2026: feito')).toBeInTheDocument()
    // dia útil sem linha = lacuna honesta
    expect(screen.getByLabelText('Ler, 06/01/2026: sem registro')).toBeInTheDocument()
    // fim de semana sem linha = lacuna, com tipo de dia no rótulo
    expect(
      screen.getByLabelText('Ler, 10/01/2026 (Fim de semana): sem registro'),
    ).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderGrid()
    expect(await axe(container)).toHaveNoViolations()
  })
})
