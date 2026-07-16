import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { DayHeader } from './DayHeader'

function renderDayHeader(props: Partial<React.ComponentProps<typeof DayHeader>> = {}) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={createBujoTheme('light')}>
        <DayHeader logDate="2026-06-15" pendingCount={3} {...props}>
          <div>lista de tarefas</div>
        </DayHeader>
      </ThemeProvider>
    </MemoryRouter>,
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

describe('DayHeader — linkToDaily (Story 11.11, AC2)', () => {
  const FIXED_TODAY = new Date('2026-06-15T12:00:00')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sem linkToDaily, o cabeçalho não é um link (comportamento padrão inalterado)', () => {
    renderDayHeader({ logDate: '2026-06-10' })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('QUA, 10 JUN')).toBeInTheDocument()
  })

  it('linkToDaily + dia passado: vira link para /daily/<data>', () => {
    renderDayHeader({ logDate: '2026-06-10', linkToDaily: true })

    expect(screen.getByRole('link', { name: 'QUA, 10 JUN' })).toHaveAttribute(
      'href',
      '/daily/2026-06-10',
    )
  })

  it('linkToDaily + hoje: aponta para /today (rota canônica, não /daily/<hoje>)', () => {
    renderDayHeader({ logDate: '2026-06-15', linkToDaily: true })

    expect(screen.getByRole('link', { name: 'SEG, 15 JUN' })).toHaveAttribute('href', '/today')
  })

  it('linkToDaily + dia futuro: não vira link (nada a consultar com certeza)', () => {
    renderDayHeader({ logDate: '2026-06-20', linkToDaily: true })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('SÁB, 20 JUN')).toBeInTheDocument()
  })
})
