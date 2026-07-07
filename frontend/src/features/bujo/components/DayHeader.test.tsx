import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { DayHeader } from './DayHeader'

function renderDayHeader(props: Partial<React.ComponentProps<typeof DayHeader>> = {}) {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <DayHeader logDate="2026-06-15" pendingCount={3} {...props}>
        <div>lista de tarefas</div>
      </DayHeader>
    </ThemeProvider>,
  )
}

describe('DayHeader (AC1)', () => {
  it('formata a data como "SEG, 15 JUN"', () => {
    renderDayHeader()
    expect(screen.getByText('SEG, 15 JUN')).toBeInTheDocument()
  })

  it('exibe o contador de pendentes', () => {
    renderDayHeader({ pendingCount: 3 })
    expect(screen.getByText('3 pendentes')).toBeInTheDocument()
  })

  it('lista de tarefas é visível por padrão', () => {
    renderDayHeader()
    expect(screen.getByText('lista de tarefas')).toBeInTheDocument()
  })

  it('clicar no chevron colapsa a lista, mantendo o header visível', () => {
    renderDayHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Colapsar lista de tarefas' }))

    expect(screen.queryByText('lista de tarefas')).not.toBeInTheDocument()
    expect(screen.getByText('SEG, 15 JUN')).toBeInTheDocument()
  })

  it('clicar novamente no chevron expande a lista de volta', () => {
    renderDayHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Colapsar lista de tarefas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expandir lista de tarefas' }))

    expect(screen.getByText('lista de tarefas')).toBeInTheDocument()
  })
})
