import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { MedicationDaySurface } from './MedicationDaySurface'
import { MedicationBlock } from './MedicationBlock'
import { deriveBlockStatus } from '../dayModel'
import type { MedicationDay, MedicationDayBlock, MedicationDayEntry } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPatch = client.patch as ReturnType<typeof vi.fn>

function entry(overrides: Partial<MedicationDayEntry> = {}): MedicationDayEntry {
  return {
    id: 'e1',
    medicationId: 'm1',
    medicationTitle: 'Losartana',
    substanceName: 'Losartana K',
    doseAtTime: [{ label: '', amount: 50, unit: 'mg' }],
    confirmedAt: null,
    source: 'scheduled',
    timeBlockId: 'b1',
    ...overrides,
  }
}

function dayWith(overrides: Partial<MedicationDay> = {}): MedicationDay {
  return {
    date: '2026-03-01',
    blocks: [
      {
        timeBlockId: 'b1',
        timeBlockName: 'Manhã',
        status: 'pending',
        entries: [entry({ id: 'e1' }), entry({ id: 'e2', medicationTitle: 'AAS' })],
      },
    ],
    adHoc: [],
    ...overrides,
  }
}

// Roteia o GET por URL: a superfície tem 2 queries (dia + catálogo de medicamentos).
function setBackend({
  day = dayWith(),
  catalog = [] as unknown[],
  dayError = false,
} = {}) {
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/medications/days/')) {
      return dayError ? Promise.reject(new Error('boom')) : Promise.resolve({ data: day })
    }
    if (url.startsWith('/api/medications/')) return Promise.resolve({ data: catalog })
    return Promise.resolve({ data: [] })
  })
}

function renderSurface() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // Envolve num landmark <main> (como MedicationsPage faz) para o axe validar a
  // superfície no contexto real (regra "region": todo conteúdo dentro de landmark).
  return render(
    <QueryClientProvider client={qc}>
      <main aria-label="Medicamentos">
        <MedicationDaySurface />
      </main>
    </QueryClientProvider>,
  )
}

describe('deriveBlockStatus (unidade pura, AC6)', () => {
  it('pending quando nenhuma linha confirmada', () => {
    expect(deriveBlockStatus([entry({ confirmedAt: null })])).toBe('pending')
  })
  it('partial quando ≥1 e <todas confirmadas', () => {
    expect(
      deriveBlockStatus([entry({ id: 'a', confirmedAt: '2026-03-01T10:00:00Z' }), entry({ id: 'b', confirmedAt: null })]),
    ).toBe('partial')
  })
  it('confirmed quando todas confirmadas', () => {
    expect(
      deriveBlockStatus([entry({ id: 'a', confirmedAt: '2026-03-01T10:00:00Z' })]),
    ).toBe('confirmed')
  })
  it('pending para bloco vazio', () => {
    expect(deriveBlockStatus([])).toBe('pending')
  })
})

describe('MedicationBlock (via MedicationDaySurface)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('renderiza o cabeçalho do bloco com nome, estado e linhas nome+dose (AC5/AC6)', async () => {
    setBackend()
    renderSurface()

    expect(await screen.findByRole('heading', { name: 'Manhã', level: 3 })).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.getByText('Losartana · 50 mg')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Losartana/ })).not.toBeChecked()
    expect(await axe(document.body)).toHaveNoViolations()
  })

  it('checkbox individual chama PATCH e reflete otimista (AC4/AC5)', async () => {
    setBackend()
    // POST/PATCH nunca resolve → isola o otimismo da reconciliação (onSettled).
    mockPatch.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderSurface()

    const checkbox = await screen.findByRole('checkbox', { name: /Losartana/ })
    await user.click(checkbox)

    await waitFor(() => expect(checkbox).toBeChecked()) // update otimista
    expect(mockPatch).toHaveBeenCalledWith('/api/medications/days/e1/', { confirmed: true })
    // Cabeçalho reage otimista: 1 de 2 confirmadas → "Parcial".
    expect(screen.getByText('Parcial')).toBeInTheDocument()
  })

  it('"Confirmar todos" chama POST confirm-block e confirma o cabeçalho otimista (AC4/AC6)', async () => {
    setBackend()
    mockPost.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderSurface()

    const button = await screen.findByRole('button', { name: /Confirmar todos — Manhã/ })
    await user.click(button)

    expect(mockPost).toHaveBeenCalledWith('/api/medications/days/confirm-block/', {
      date: '2026-03-01',
      timeBlockId: 'b1',
      confirmed: true,
    })
    await waitFor(() => expect(screen.getByText('Confirmado')).toBeInTheDocument())
  })

  it('"Confirmar todos" fica desabilitado quando o bloco já está confirmado', async () => {
    setBackend({
      day: dayWith({
        blocks: [
          {
            timeBlockId: 'b1',
            timeBlockName: 'Manhã',
            status: 'confirmed',
            entries: [entry({ id: 'e1', confirmedAt: '2026-03-01T10:00:00Z' })],
          },
        ],
      }),
    })
    renderSurface()

    expect(await screen.findByText('Confirmado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar todos — Manhã/ })).toBeDisabled()
  })

  it('reverte o otimismo e mostra erro quando a escrita falha (rollback, AC5/AC8)', async () => {
    setBackend()
    mockPatch.mockRejectedValue(new Error('falhou'))
    const user = userEvent.setup()
    renderSurface()

    const checkbox = await screen.findByRole('checkbox', { name: /Losartana/ })
    await user.click(checkbox)

    // Rollback: o snapshot volta (checkbox desmarcado) e o erro é anunciado.
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(checkbox).not.toBeChecked()
  })
})

describe('MedicationDaySurface — estados e avulso (AC7/AC8)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('mostra o empty state quando não há medicamentos', async () => {
    setBackend({ day: dayWith({ blocks: [], adHoc: [] }), catalog: [] })
    renderSurface()

    expect(await screen.findByText('Nenhum medicamento para hoje.')).toBeInTheDocument()
  })

  it('erro de leitura mostra alerta e botão de retry', async () => {
    setBackend({ dayError: true })
    renderSurface()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os medicamentos.',
    )
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('lista os avulsos numa seção Avulso/PRN distinta dos blocos (AC7)', async () => {
    setBackend({
      day: dayWith({
        blocks: [],
        adHoc: [
          entry({
            id: 'ah1',
            medicationTitle: 'Dipirona',
            source: 'ad_hoc',
            timeBlockId: null,
            confirmedAt: '2026-03-01T14:00:00Z',
            doseAtTime: [{ label: '', amount: 1, unit: 'comp' }],
          }),
        ],
      }),
    })
    renderSurface()

    const prn = await screen.findByRole('heading', { name: 'Avulso / PRN', level: 3 })
    expect(prn).toBeInTheDocument()
    expect(screen.getByText('Dipirona · 1 comp')).toBeInTheDocument()
  })

  it('registra um avulso via formulário (POST ad-hoc) quando há catálogo (AC7)', async () => {
    setBackend({
      day: dayWith({ blocks: [], adHoc: [] }),
      catalog: [{ id: 'm1', title: 'Dipirona', active: true, substance: null, schedules: [] }],
    })
    mockPost.mockResolvedValue({ data: dayWith({ blocks: [], adHoc: [] }) })
    const user = userEvent.setup()
    renderSurface()

    // MUI Select (aria-label estável): abrir e escolher a opção.
    const select = await screen.findByRole('combobox', { name: 'Medicamento avulso' })
    await user.click(select)
    await user.click(await screen.findByRole('option', { name: 'Dipirona' }))

    // <input type="number"> em jsdom: userEvent.type funciona para dígitos simples;
    // usamos fireEvent.change como caminho robusto (guardrail jsdom das Dev Notes).
    fireEvent.change(screen.getByLabelText('Quantidade da dose avulsa'), {
      target: { value: '1' },
    })
    await user.type(screen.getByLabelText('Unidade da dose avulsa'), 'comp')
    await user.click(screen.getByRole('button', { name: 'Registrar avulso' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/medications/days/ad-hoc/', {
        date: '2026-03-01',
        medicationId: 'm1',
        dose: [{ label: '', amount: 1, unit: 'comp' }],
      }),
    )
  })
})

// --- Story 8.3 — MedicationBlock com isPast (histórico) ----------------------

function block(overrides: Partial<MedicationDayBlock> = {}): MedicationDayBlock {
  return {
    timeBlockId: 'b1',
    timeBlockName: 'Manhã',
    status: 'pending',
    entries: [entry({ id: 'e1' })],
    ...overrides,
  }
}

function renderBlock(b: MedicationDayBlock, { isPast = false } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <main aria-label="Medicamentos">
        <MedicationBlock block={b} date="2026-03-01" dayDate="2026-03-01" isPast={isPast} />
      </main>
    </QueryClientProvider>,
  )
}

describe('MedicationBlock — histórico (isPast, AC3)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('dia passado: cabeçalho de bloco pending vira "Doses perdidas"', () => {
    renderBlock(block({ entries: [entry({ id: 'e1', confirmedAt: null })] }), { isPast: true })
    expect(screen.getByText('Doses perdidas')).toBeInTheDocument()
    expect(screen.queryByText('Pendente')).not.toBeInTheDocument()
  })

  it('sem isPast: cabeçalho pending continua "Pendente" (aba "Hoje" intacta)', () => {
    renderBlock(block({ entries: [entry({ id: 'e1', confirmedAt: null })] }), { isPast: false })
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.queryByText('Doses perdidas')).not.toBeInTheDocument()
    // Sem afordance de correção fora do histórico.
    expect(screen.queryByRole('button', { name: 'Corrigir dose' })).not.toBeInTheDocument()
  })

  it('dia passado: linha sem confirmação mostra "Dose perdida"; confirmada mostra "Confirmado"', () => {
    renderBlock(
      block({
        entries: [
          entry({ id: 'e1', medicationTitle: 'Losartana', confirmedAt: null }),
          entry({ id: 'e2', medicationTitle: 'AAS', confirmedAt: '2026-03-01T10:00:00Z' }),
        ],
      }),
      { isPast: true },
    )
    expect(screen.getByText('Dose perdida')).toBeInTheDocument()
    expect(screen.getByText('Confirmado')).toBeInTheDocument()
  })
})

describe('MedicationBlock — correção de dose (isPast, AC6)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('abre o editor, corrige a dose e chama PATCH /days/{id}/ com {dose}', async () => {
    mockPatch.mockResolvedValue({ data: dayWith() })
    const user = userEvent.setup()
    renderBlock(
      block({
        entries: [entry({ id: 'e1', doseAtTime: [{ label: '', amount: 50, unit: 'mg' }] })],
      }),
      { isPast: true },
    )

    await user.click(screen.getByRole('button', { name: 'Corrigir dose' }))
    // <input type="number">: fireEvent.change (guardrail jsdom).
    fireEvent.change(screen.getByLabelText('Quantidade do componente 1'), {
      target: { value: '25' },
    })
    await user.click(screen.getByRole('button', { name: 'Salvar dose' }))

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/medications/days/e1/', {
        dose: [{ label: '', amount: 25, unit: 'mg' }],
      }),
    )
  })

  it('erro de escrita no editor de dose mostra alerta (role="alert")', async () => {
    mockPatch.mockRejectedValue(new Error('falhou'))
    const user = userEvent.setup()
    renderBlock(
      block({
        entries: [entry({ id: 'e1', doseAtTime: [{ label: '', amount: 50, unit: 'mg' }] })],
      }),
      { isPast: true },
    )

    await user.click(screen.getByRole('button', { name: 'Corrigir dose' }))
    await user.click(screen.getByRole('button', { name: 'Salvar dose' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})

// --- Story 8.3 — editor de dose com componentes repetíveis (AC6) --------------
// AC6 pede um "editor de componentes de dose repetível [{label, amount, unit}]"
// (add/remove de linhas, idioma EnumOptionsEditor da 8.1). Os testes acima só editam
// a quantidade do único componente pré-preenchido; estes cobrem o add/remove de linhas,
// o save de dose multi-componente e a guarda de cliente (canSave).
describe('MedicationBlock — editor de dose repetível (isPast, AC6)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('adiciona um 2º componente e salva a dose multi-componente via PATCH', async () => {
    mockPatch.mockResolvedValue({ data: dayWith() })
    const user = userEvent.setup()
    renderBlock(
      block({
        entries: [entry({ id: 'e1', doseAtTime: [{ label: '', amount: 50, unit: 'mg' }] })],
      }),
      { isPast: true },
    )

    await user.click(screen.getByRole('button', { name: 'Corrigir dose' }))
    // Só há 1 componente pré-preenchido → nenhum botão de remover ainda.
    expect(screen.queryByRole('button', { name: /Remover componente/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Adicionar componente' }))
    // <input type="number"> (Quantidade): fireEvent.change (guardrail jsdom).
    fireEvent.change(screen.getByLabelText('Rótulo do componente 2'), {
      target: { value: 'Xarope' },
    })
    fireEvent.change(screen.getByLabelText('Quantidade do componente 2'), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByLabelText('Unidade do componente 2'), {
      target: { value: 'ml' },
    })
    await user.click(screen.getByRole('button', { name: 'Salvar dose' }))

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/medications/days/e1/', {
        dose: [
          { label: '', amount: 50, unit: 'mg' },
          { label: 'Xarope', amount: 5, unit: 'ml' },
        ],
      }),
    )
  })

  it('remove um componente adicionado (botão de remover só aparece com >1 componente)', async () => {
    mockPatch.mockResolvedValue({ data: dayWith() })
    const user = userEvent.setup()
    renderBlock(
      block({
        entries: [entry({ id: 'e1', doseAtTime: [{ label: '', amount: 50, unit: 'mg' }] })],
      }),
      { isPast: true },
    )

    await user.click(screen.getByRole('button', { name: 'Corrigir dose' }))
    await user.click(screen.getByRole('button', { name: 'Adicionar componente' }))
    // Com 2 componentes, ambos ganham botão de remover.
    expect(screen.getByRole('button', { name: 'Remover componente 2' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remover componente 2' }))
    // Volta a 1 componente → botões de remover somem, e o save envia só o original.
    expect(screen.queryByLabelText('Quantidade do componente 2')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remover componente/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salvar dose' }))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/medications/days/e1/', {
        dose: [{ label: '', amount: 50, unit: 'mg' }],
      }),
    )
  })

  it('"Salvar dose" fica desabilitado enquanto um componente tem quantidade/unidade vazia', async () => {
    const user = userEvent.setup()
    // Sem dose registrada → editor semeia um componente vazio → save desabilitado.
    renderBlock(
      block({ entries: [entry({ id: 'e1', doseAtTime: [] })] }),
      { isPast: true },
    )

    await user.click(screen.getByRole('button', { name: 'Corrigir dose' }))
    const save = screen.getByRole('button', { name: 'Salvar dose' })
    expect(save).toBeDisabled()

    // Só quantidade não basta; falta a unidade → segue desabilitado.
    fireEvent.change(screen.getByLabelText('Quantidade do componente 1'), {
      target: { value: '2' },
    })
    expect(save).toBeDisabled()

    // Preenchidos quantidade + unidade → habilita.
    fireEvent.change(screen.getByLabelText('Unidade do componente 1'), {
      target: { value: 'comp' },
    })
    expect(save).toBeEnabled()
  })
})
