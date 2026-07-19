import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { HabitsManager } from './HabitsManager'
import type { Habit, HabitGroup } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPut = client.put as ReturnType<typeof vi.fn>

const GROUPS: HabitGroup[] = [
  { id: 'g-saude', name: 'Saúde', displayOrder: 0 },
  { id: 'g-trabalho', name: 'Trabalho', displayOrder: 1 },
]

const HABIT_LER: Habit = {
  id: 'h-ler',
  name: 'Ler',
  emoticon: '📖',
  group: 'g-saude',
  type: 'boolean',
  weight: '2.00',
  active: true,
  meta: null,
  bonus: null,
  effectiveFrom: '2026-07-17',
}

function setGet(
  groups: HabitGroup[],
  habits: Habit[],
  multipliers: { weekend: string; holiday: string } = { weekend: '1.00', holiday: '1.00' },
) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/multipliers/')) return Promise.resolve({ data: multipliers })
    if (url.startsWith('/api/habit-groups')) return Promise.resolve({ data: groups })
    if (url.startsWith('/api/habits')) return Promise.resolve({ data: habits })
    return Promise.resolve({ data: [] })
  })
}

function renderManager() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <HabitsManager />
    </QueryClientProvider>,
  )
}

describe('HabitsManager', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lista hábitos agrupados por grupo, com empty state por grupo vazio', async () => {
    setGet(GROUPS, [HABIT_LER])
    renderManager()

    expect(await screen.findByRole('heading', { name: 'Saúde' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trabalho' })).toBeInTheDocument()
    expect(screen.getByText(/Ler/)).toBeInTheDocument()
    // Grupo "Trabalho" está vazio → empty state
    expect(screen.getByText('Nenhum hábito neste grupo.')).toBeInTheDocument()
  })

  it('mostra campos Meta/Bonus só quando o tipo é Numérico', async () => {
    setGet(GROUPS, [])
    const user = userEvent.setup()
    renderManager()
    await screen.findByRole('heading', { name: 'Saúde' })

    // Booleano (default): sem Meta/Bonus
    expect(screen.queryByLabelText('Meta')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Numérico' }))

    expect(await screen.findByLabelText('Meta')).toBeInTheDocument()
    expect(screen.getByLabelText('Bonus')).toBeInTheDocument()
  })

  it('exibe o tooltip exato da AC2 ao editar o peso', async () => {
    setGet(GROUPS, [HABIT_LER])
    const user = userEvent.setup()
    renderManager()
    await screen.findByText(/Ler/)

    await user.click(screen.getByRole('button', { name: 'Editar peso' }))
    await user.hover(await screen.findByLabelText('Peso de Ler'))
    expect(
      await screen.findByText(
        'Alteração válida a partir de hoje. Registros anteriores preservados.',
      ),
    ).toBeInTheDocument()
  })

  it('cria hábito com o payload correto', async () => {
    setGet(GROUPS, [])
    mockPost.mockResolvedValueOnce({ data: HABIT_LER })
    const user = userEvent.setup()
    renderManager()
    await screen.findByRole('heading', { name: 'Saúde' })

    const form = screen.getByRole('form', { name: 'Novo hábito' })
    await user.type(within(form).getByLabelText('Nome'), 'Ler')
    await user.type(within(form).getByLabelText('Peso inicial'), '2')

    // Seleciona o grupo "Saúde"
    await user.click(within(form).getByRole('combobox', { name: 'Grupo' }))
    await user.click(await screen.findByRole('option', { name: 'Saúde' }))

    await user.click(within(form).getByRole('button', { name: /Criar hábito/ }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/habits/', {
        name: 'Ler',
        emoticon: '',
        group: 'g-saude',
        type: 'boolean',
        weight: '2',
      }),
    )
  })

  it('desativa um hábito via nova versão (active:false)', async () => {
    setGet(GROUPS, [HABIT_LER])
    mockPost.mockResolvedValueOnce({
      data: { ...HABIT_LER, active: false },
    })
    const user = userEvent.setup()
    renderManager()
    await screen.findByText(/Ler/)

    await user.click(screen.getByRole('button', { name: 'Desativar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/habits/h-ler/versions/', { active: false }),
    )
  })

  it('sem grupos, orienta a criar grupo e desabilita criação de hábito', async () => {
    setGet([], [])
    renderManager()

    expect(
      await screen.findByText('Crie um grupo para começar a adicionar hábitos.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Criar hábito/ })).toBeDisabled()
  })

  it('não tem violações de acessibilidade (jest-axe)', async () => {
    setGet(GROUPS, [HABIT_LER])
    const { container } = renderManager()
    await screen.findByText(/Ler/)

    expect(await axe(container)).toHaveNoViolations()
  })

  // --- Story 6.3 — config de multiplicador por grupo -------------------------

  it('renderiza os campos de multiplicador por grupo (fim de semana / feriado)', async () => {
    setGet(GROUPS, [HABIT_LER], { weekend: '0.20', holiday: '0.00' })
    renderManager()

    expect(
      await screen.findByLabelText('Multiplicador de fim de semana de g-saude'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Multiplicador de feriado de g-saude'),
    ).toBeInTheDocument()
  })

  it('salva o multiplicador do grupo com PUT no endpoint certo', async () => {
    setGet(GROUPS, [HABIT_LER], { weekend: '1.00', holiday: '1.00' })
    mockPut.mockResolvedValueOnce({ data: { weekend: '0.20', holiday: '1.00' } })
    const user = userEvent.setup()
    renderManager()

    const weekendField = await screen.findByLabelText(
      'Multiplicador de fim de semana de g-saude',
    )
    // fireEvent.change seta o valor direto (userEvent.clear/type não funciona em
    // input type=number no jsdom — sem suporte a seleção).
    fireEvent.change(weekendField, { target: { value: '0.2' } })

    // Saúde é o primeiro grupo → primeiro botão "Salvar multiplicadores".
    await user.click(screen.getAllByRole('button', { name: 'Salvar multiplicadores' })[0])

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith(
        '/api/habit-groups/g-saude/multipliers/',
        expect.objectContaining({ weekend: '0.2', holiday: '1.00' }),
      ),
    )
  })
})
