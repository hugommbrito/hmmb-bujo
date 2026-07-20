import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { MedicationsManager } from './MedicationsManager'
import type { Doctor, Medication, TimeBlock } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

const BLOCK: TimeBlock = { id: 'blk-1', name: 'Manhã', displayOrder: 0, active: true }
const DOCTOR: Doctor = { id: 'doc-1', name: 'Dra. Ana', specialty: 'Cardiologia' }

function medWith(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'med-1',
    title: 'Remédio de pressão',
    active: true,
    substance: {
      id: 'sub-1',
      medication: 'med-1',
      substanceName: 'Losartana',
      laboratory: 'EMS',
      prescribedBy: null,
      effectiveFrom: '2026-07-20',
    },
    schedules: [],
    ...overrides,
  }
}

// Roteia o GET mockado por URL (o manager tem 3 queries: medications/doctors/time-blocks).
function setBackend({
  meds = [] as Medication[],
  doctors = [] as Doctor[],
  blocks = [] as TimeBlock[],
  medsError = false,
} = {}) {
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/medications/')) {
      return medsError ? Promise.reject(new Error('boom')) : Promise.resolve({ data: meds })
    }
    if (url.startsWith('/api/doctors/')) return Promise.resolve({ data: doctors })
    if (url.startsWith('/api/time-blocks/')) return Promise.resolve({ data: blocks })
    return Promise.resolve({ data: [] })
  })
}

function renderManager() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MedicationsManager />
    </QueryClientProvider>,
  )
}

describe('MedicationsManager', () => {
  beforeEach(() => vi.resetAllMocks())

  it('mostra o empty state quando não há medicamentos', async () => {
    setBackend({ meds: [] })
    renderManager()
    expect(await screen.findByText('Nenhum medicamento ainda.')).toBeInTheDocument()
  })

  it('lista medicamentos com substância vigente', async () => {
    setBackend({ meds: [medWith()] })
    renderManager()
    expect(await screen.findByText('Remédio de pressão')).toBeInTheDocument()
    expect(screen.getByText(/Losartana · EMS/)).toBeInTheDocument()
  })

  it('cria um medicamento com o payload camelCase correto', async () => {
    setBackend({ meds: [] })
    mockPost.mockResolvedValueOnce({ data: medWith() })
    const user = userEvent.setup()
    renderManager()
    await screen.findByText('Nenhum medicamento ainda.')

    const form = screen.getByRole('form', { name: 'Novo medicamento' })
    await user.type(within(form).getByLabelText('Título'), 'Remédio de pressão')
    await user.type(within(form).getByLabelText('Substância'), 'Losartana')
    await user.click(within(form).getByRole('button', { name: 'Criar medicamento' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/medications/', {
        title: 'Remédio de pressão',
        substanceName: 'Losartana',
        laboratory: null,
        prescribedById: null,
      }),
    )
  })

  it('define a dose de um bloco via editor repetível (POST schedule-versions)', async () => {
    setBackend({ meds: [medWith()], blocks: [BLOCK] })
    mockPost.mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    renderManager()
    await screen.findByText('Remédio de pressão')

    await user.click(screen.getByRole('button', { name: 'Editar' }))

    // Selecionar o bloco (MUI Select por aria-label; opção num popover no nível da página).
    await user.click(
      screen.getByRole('combobox', { name: 'Bloco da dose de Remédio de pressão' }),
    )
    await user.click(await screen.findByRole('option', { name: 'Manhã' }))

    // jsdom caveat: <input type=number> não aceita userEvent.type/clear → fireEvent.change.
    fireEvent.change(
      screen.getByLabelText('Remédio de pressão — quantidade do componente 1'),
      { target: { value: '1' } },
    )
    fireEvent.change(
      screen.getByLabelText('Remédio de pressão — unidade do componente 1'),
      { target: { value: 'comp' } },
    )

    await user.click(screen.getByRole('button', { name: 'Salvar dose' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/medications/med-1/schedule-versions/', {
        timeBlockId: 'blk-1',
        dose: [{ label: '', amount: 1, unit: 'comp' }],
      }),
    )
  })

  it('desativa uma agenda de bloco (POST schedule-versions active:false)', async () => {
    const med = medWith({
      schedules: [
        {
          id: 'sched-1',
          medication: 'med-1',
          timeBlock: 'blk-1',
          timeBlockName: 'Manhã',
          dose: [{ label: '', amount: 1, unit: 'comp' }],
          active: true,
          effectiveFrom: '2026-07-20',
        },
      ],
    })
    setBackend({ meds: [med], blocks: [BLOCK] })
    mockPost.mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    renderManager()
    await screen.findByText(/Manhã: 1 comp/)

    await user.click(screen.getByRole('button', { name: 'Desativar agenda Manhã' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/medications/med-1/schedule-versions/', {
        timeBlockId: 'blk-1',
        active: false,
      }),
    )
  })

  it('marca medicamento inativo com rótulo textual "(inativo)"', async () => {
    const med = medWith({
      active: false,
      schedules: [
        {
          id: 'sched-1',
          medication: 'med-1',
          timeBlock: 'blk-1',
          timeBlockName: 'Manhã',
          dose: [{ label: '', amount: 1, unit: 'comp' }],
          active: false,
          effectiveFrom: '2026-07-20',
        },
      ],
    })
    setBackend({ meds: [med], blocks: [BLOCK] })
    renderManager()

    expect(await screen.findByText(/Remédio de pressão/)).toBeInTheDocument()
    expect(screen.getAllByText(/\(inativo\)/).length).toBeGreaterThan(0)
    // O toggle de nível-medicamento vira "Ativar".
    expect(
      screen.getByRole('button', { name: 'Ativar medicamento Remédio de pressão' }),
    ).toBeInTheDocument()
  })

  it('surfaça erro de escrita quando o toggle de nível-medicamento falha', async () => {
    const med = medWith({
      schedules: [
        {
          id: 'sched-1',
          medication: 'med-1',
          timeBlock: 'blk-1',
          timeBlockName: 'Manhã',
          dose: [{ label: '', amount: 1, unit: 'comp' }],
          active: true,
          effectiveFrom: '2026-07-20',
        },
      ],
    })
    setBackend({ meds: [med], blocks: [BLOCK] })
    mockPost.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderManager()
    await screen.findByText('Remédio de pressão')

    await user.click(
      screen.getByRole('button', { name: 'Desativar medicamento Remédio de pressão' }),
    )

    expect(
      await screen.findByText('Não foi possível salvar. Tente novamente.'),
    ).toBeInTheDocument()
  })

  it('mostra erro de leitura com retry quando a query falha', async () => {
    setBackend({ medsError: true })
    renderManager()
    expect(
      await screen.findByText('Não foi possível carregar os medicamentos.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (jest-axe)', async () => {
    setBackend({ meds: [medWith()], doctors: [DOCTOR], blocks: [BLOCK] })
    const { container } = renderManager()
    await screen.findByText('Remédio de pressão')
    expect(await axe(container)).toHaveNoViolations()
  })
})
