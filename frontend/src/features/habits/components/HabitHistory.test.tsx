import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { createBujoTheme } from '../../../theme'
import { HabitHistory } from './HabitHistory'
import type { HabitDayEntry, HabitHistoryRange } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>

// Datas ancoradas em "hoje" (local) para casar com o range default da UI
// (end = hoje; start = hoje − 29). Assim o detalhe por-data acha o dia selecionado.
function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const TODAY = isoToday()
const YESTERDAY = addDays(TODAY, -1)

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

const HISTORY: HabitHistoryRange = {
  start: addDays(TODAY, -29),
  end: TODAY,
  habits: [{ id: 'h1', name: 'Ler', emoticon: '📖', type: 'boolean', unit: '', group: 'g1' }],
  days: [
    { date: YESTERDAY, dayType: 'weekday', totalCompletion: null, groups: [], entries: [] },
    {
      date: TODAY,
      dayType: 'weekday',
      totalCompletion: 100,
      groups: [{ id: 'g1', name: 'Saúde', completion: 100 }],
      entries: [ENTRY_DONE],
    },
  ],
}

function renderHistory() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <HabitHistory />
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('HabitHistory', () => {
  beforeEach(() => {
    // clearAllMocks (não resetAllMocks): preserva a implementação do mock global
    // de window.matchMedia (test-setup) que useMediaQuery (na grade) precisa.
    vi.clearAllMocks()
    mockGet.mockResolvedValue({ data: HISTORY })
  })

  it('renderiza o detalhe read-only do dia selecionado (hoje)', async () => {
    renderHistory()
    // detalhe do dia = hoje (com registro) → mostra o hábito e o estado, read-only.
    expect(await screen.findByText(/Ler: feito/)).toBeInTheDocument()
    expect(screen.getByText(/Completude do dia: 100%/)).toBeInTheDocument()
    // read-only: nenhum controle de marcação (checkbox) na superfície de histórico.
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('navegar para o dia anterior (lacuna) mostra "Sem registro neste dia."', async () => {
    const user = userEvent.setup()
    renderHistory()
    await screen.findByText(/Ler: feito/)

    await user.click(screen.getByRole('button', { name: 'Dia anterior' }))

    expect(screen.getByText('Sem registro neste dia.')).toBeInTheDocument()
    // não fabrica 0%: o texto de completude some no dia-lacuna.
    expect(screen.queryByText(/Completude do dia/)).toBeNull()
  })

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderHistory()
    await screen.findByText(/Ler: feito/)
    expect(await axe(container)).toHaveNoViolations()
  })
})
