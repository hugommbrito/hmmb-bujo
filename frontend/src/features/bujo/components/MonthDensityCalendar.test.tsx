import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { createBujoTheme } from '../../../theme'
import { MonthDensityCalendar } from './MonthDensityCalendar'

function renderCalendar(props: Partial<Parameters<typeof MonthDensityCalendar>[0]> = {}) {
  const defaults = {
    monthFirst: '2026-03-01',
    densityByDate: new Map<string, number>(),
  }
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <MonthDensityCalendar {...defaults} {...props} />
    </ThemeProvider>,
  )
}

describe('MonthDensityCalendar (AC2/AC3)', () => {
  it('renderiza o cabeçalho começando na segunda (AD-05)', () => {
    renderCalendar()

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])
  })

  it('renderiza todos os dias do mês (março tem 31)', () => {
    renderCalendar()

    // Cada dia tem um nome acessível único; o dia 31 existe, o 32 não.
    expect(screen.getByLabelText(/^31 de março,/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^32 de março,/)).not.toBeInTheDocument()
  })

  it('dia com densidade exibe a contagem e o aria-label a inclui', () => {
    renderCalendar({ densityByDate: new Map([['2026-03-14', 3]]) })

    const cell = screen.getByLabelText('14 de março, 3 tarefas')
    expect(within(cell).getByText('3')).toBeInTheDocument()
  })

  it('singular no aria-label quando a contagem é 1', () => {
    renderCalendar({ densityByDate: new Map([['2026-03-02', 1]]) })

    expect(screen.getByLabelText('2 de março, 1 tarefa')).toBeInTheDocument()
  })

  it('dia sem densidade é neutro (sem contador) e o aria-label diz "sem tarefas"', () => {
    renderCalendar({ densityByDate: new Map([['2026-03-14', 3]]) })

    const cell = screen.getByLabelText('10 de março, sem tarefas')
    // Só o número do dia, sem badge de contagem.
    expect(within(cell).getByText('10')).toBeInTheDocument()
    expect(within(cell).queryByText('0')).not.toBeInTheDocument()
  })

  it('âncora off-by-one: o dia 1 é rotulado como "1 de março" (parse local, sem shift de UTC)', () => {
    // Com new Date('2026-03-01') UTC, um fuso negativo cairia em 28 de fevereiro.
    renderCalendar({ monthFirst: '2026-03-01' })

    expect(screen.getByLabelText('1 de março, sem tarefas')).toBeInTheDocument()
    expect(screen.queryByLabelText(/de fevereiro/)).not.toBeInTheDocument()
  })

  it('informativo: sem onSelectDay não há botão nem handler de clique', () => {
    renderCalendar({ densityByDate: new Map([['2026-03-14', 3]]) })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('quando onSelectDay é passado (gancho da 11.6), os dias viram botões clicáveis', () => {
    const onSelectDay = vi.fn()
    renderCalendar({ onSelectDay })

    fireEvent.click(screen.getByRole('button', { name: '5 de março, sem tarefas' }))

    expect(onSelectDay).toHaveBeenCalledWith('2026-03-05')
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    const { container } = renderCalendar({ densityByDate: new Map([['2026-03-14', 3]]) })

    expect(await axe(container)).toHaveNoViolations()
  })
})
