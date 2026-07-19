import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { createBujoTheme } from '../../../theme'
import { HabitTracker } from './HabitTracker'
import type { HabitDay, HabitDayEntry } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPatch = client.patch as ReturnType<typeof vi.fn>

const BOOLEAN_ENTRY: HabitDayEntry = {
  id: 'entry-ler',
  habitId: 'h-ler',
  name: 'Ler',
  emoticon: '📖',
  type: 'boolean',
  group: 'g-saude',
  unit: '',
  value: null,
  weightAtTime: '1.00',
  metaAtTime: null,
  bonusAtTime: null,
}

const NUMERIC_ENTRY: HabitDayEntry = {
  id: 'entry-passos',
  habitId: 'h-passos',
  name: 'Passos',
  emoticon: '🏃',
  type: 'numeric',
  group: 'g-saude',
  unit: 'passos',
  value: '2500',
  weightAtTime: '2.00',
  metaAtTime: '5000',
  bonusAtTime: '20',
}

function makeDay(entries: HabitDayEntry[], overrides: Partial<HabitDay> = {}): HabitDay {
  return {
    date: '2026-07-17',
    totalCompletion: 27,
    groups: [{ id: 'g-saude', name: 'Saúde', completion: 40 }],
    entries,
    ...overrides,
  }
}

function setDay(day: HabitDay) {
  mockGet.mockResolvedValue({ data: day })
}

function renderTracker() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <QueryClientProvider client={qc}>
        <HabitTracker />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('HabitTracker', () => {
  beforeEach(() => vi.resetAllMocks())

  it('mostra o percentual total no topo e o cabeçalho de grupo com %', async () => {
    setDay(makeDay([BOOLEAN_ENTRY]))
    renderTracker()

    expect(await screen.findByText('Completude do dia: 27%')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Saúde · 40%/ })).toBeInTheDocument()
  })

  it('marca um hábito booleano de forma otimista (PATCH value:1)', async () => {
    setDay(makeDay([BOOLEAN_ENTRY]))
    mockPatch.mockResolvedValueOnce({ data: { ...BOOLEAN_ENTRY, value: '1' } })
    const user = userEvent.setup()
    renderTracker()

    const checkbox = await screen.findByRole('checkbox', { name: /Ler/ })
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/habits/days/entry-ler/', { value: '1' }),
    )
  })

  it('exibe "X / meta unit (Y%)" para hábito numérico parcial', async () => {
    setDay(makeDay([NUMERIC_ENTRY]))
    renderTracker()

    expect(await screen.findByText('2.500 / 5.000 passos (50%)')).toBeInTheDocument()
  })

  it('exibe "Meta atingida" quando value >= meta', async () => {
    setDay(makeDay([{ ...NUMERIC_ENTRY, value: '5000' }]))
    renderTracker()

    expect(await screen.findByText('Meta atingida')).toBeInTheDocument()
  })

  it('empty state honesto quando não há hábitos ativos', async () => {
    setDay(makeDay([], { groups: [] }))
    renderTracker()

    expect(await screen.findByText('Nenhum hábito ativo hoje.')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (jest-axe)', async () => {
    setDay(makeDay([BOOLEAN_ENTRY, NUMERIC_ENTRY]))
    const { container } = renderTracker()
    await screen.findByText(/Passos/)

    expect(await axe(container)).toHaveNoViolations()
  })
})
