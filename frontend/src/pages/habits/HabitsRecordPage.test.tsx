import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import { createBujoTheme } from '../../theme'
import { mediaQueries } from '../../shared/design/tokens'
import { HabitsRecordPage } from './HabitsRecordPage'
import type {
  Habit,
  HabitDay,
  HabitDayEntry,
  HabitGroup,
  HabitHistoryRange,
} from '../../features/habits'
import { isoLocalToday, addDays } from '../../features/habits/components/record/habitsSurface'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPatch = client.patch as ReturnType<typeof vi.fn>
const mockPut = client.put as ReturnType<typeof vi.fn>

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TODAY = isoLocalToday()

function entry(overrides: Partial<HabitDayEntry> = {}): HabitDayEntry {
  return {
    id: 'e1',
    habitId: 'h1',
    name: 'Alongamento',
    // A API AINDA devolve `emoticon`; a superfície nova nunca o renderiza.
    emoticon: '🧘',
    type: 'boolean',
    group: 'g1',
    unit: '',
    value: null,
    weightAtTime: '1.00',
    metaAtTime: null,
    bonusAtTime: null,
    dayType: 'weekday',
    multiplierAtTime: '1.00',
    ...overrides,
  }
}

const NUMERIC_ENTRY = entry({
  id: 'e2',
  habitId: 'h2',
  name: 'Corrida',
  type: 'numeric',
  unit: 'km',
  value: '2.1',
  weightAtTime: '3.00',
  metaAtTime: '8',
  bonusAtTime: '0',
})

function habitDay(overrides: Partial<HabitDay> = {}): HabitDay {
  return {
    date: TODAY,
    totalCompletion: 64,
    dayType: 'weekday',
    groups: [{ id: 'g1', name: 'Corpo', completion: 75 }],
    entries: [entry(), NUMERIC_ENTRY],
    ...overrides,
  }
}

const GROUPS: HabitGroup[] = [{ id: 'g1', name: 'Corpo', displayOrder: 0 }]

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Alongamento',
    emoticon: '🧘',
    group: 'g1',
    type: 'boolean',
    unit: '',
    weight: '1.00',
    active: true,
    meta: null,
    bonus: null,
    effectiveFrom: TODAY,
    ...overrides,
  }
}

function history(overrides: Partial<HabitHistoryRange> = {}): HabitHistoryRange {
  return {
    start: addDays(TODAY, -29),
    end: TODAY,
    habits: [
      { id: 'h1', name: 'Alongamento', emoticon: '🧘', type: 'boolean', unit: '', group: 'g1' },
    ],
    days: [
      {
        date: addDays(TODAY, -1),
        dayType: 'weekday',
        totalCompletion: 50,
        groups: [{ id: 'g1', name: 'Corpo', completion: 50 }],
        entries: [entry({ id: 'he1', value: '1' })],
      },
      {
        date: TODAY,
        dayType: 'weekday',
        totalCompletion: null,
        groups: [],
        entries: [],
      },
    ],
    ...overrides,
  }
}

// ─── Harness ─────────────────────────────────────────────────────────────────

interface RouteData {
  day?: HabitDay
  habits?: Habit[]
  groups?: HabitGroup[]
  historyRange?: HabitHistoryRange
  multipliers?: { weekend: string; holiday: string }
  failing?: string[]
}

function mockApi(data: RouteData = {}) {
  mockGet.mockImplementation((url: string) => {
    if (data.failing?.some((fragment) => url.includes(fragment))) {
      return Promise.reject(new Error(`boom ${url}`))
    }
    if (url === '/api/habits/days/') return Promise.resolve({ data: data.day ?? habitDay() })
    if (url.startsWith('/api/habits/history/')) {
      return Promise.resolve({ data: data.historyRange ?? history() })
    }
    if (url.includes('/series/')) {
      return Promise.resolve({
        data: {
          habit: { id: 'h1', name: 'Alongamento', type: 'boolean', unit: '', group: 'g1' },
          points: [],
          events: [],
          dayTypes: [],
        },
      })
    }
    if (url.includes('/multipliers/')) {
      return Promise.resolve({ data: data.multipliers ?? { weekend: '1.00', holiday: '1.00' } })
    }
    if (url.startsWith('/api/habits/')) return Promise.resolve({ data: data.habits ?? [habit()] })
    if (url === '/api/habit-groups/') return Promise.resolve({ data: data.groups ?? GROUPS })
    return Promise.reject(new Error(`unhandled GET ${url}`))
  })
  mockPost.mockResolvedValue({ data: {} })
  mockPatch.mockResolvedValue({ data: {} })
  mockPut.mockResolvedValue({ data: {} })
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

/** `vi.resetAllMocks()` apaga o `matchMedia` global de `test-setup.ts`. */
function mockWideFaixa() {
  const wideQueries: string[] = [mediaQueries.tabletUp, mediaQueries.wideUp]
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: wideQueries.includes(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function mockCompactFaixa() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === mediaQueries.compact,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function renderPage(initialEntry = '/habits') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <HabitsRecordPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

function baseSetup() {
  vi.resetAllMocks()
  mockWideFaixa()
  setOnline(true)
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1 — um <main>, tablist de três abas, aba ativa reflete `?tab=`
// ─────────────────────────────────────────────────────────────────────────────

describe('AC1 — composição, landmark e abas', () => {
  beforeEach(baseSetup)

  it('renderiza exatamente um <main aria-label="Hábitos">', async () => {
    mockApi()
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('main', { name: 'Hábitos' })).toBeInTheDocument(),
    )
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('a tablist tem exatamente três abas, na ordem Hoje · Histórico · Configuração', async () => {
    mockApi()
    renderPage()
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Hoje', 'Histórico', 'Configuração'])
  })

  it('no compact a terceira aba abrevia para "Config."', async () => {
    mockApi()
    mockCompactFaixa()
    renderPage()
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Hoje', 'Histórico', 'Config.'])
  })

  it('a aba ativa reflete `?tab=` (deep link)', async () => {
    mockApi()
    renderPage('/habits?tab=configuracao')
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Configuração' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'false')
  })

  it('`?tab=` desconhecido cai na aba Hoje, sem tela morta', async () => {
    mockApi()
    renderPage('/habits?tab=inexistente')
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true'),
    )
  })

  it('só a aba SELECIONADA tem `aria-controls` (o painel inativo não existe no DOM)', async () => {
    mockApi()
    renderPage()
    await screen.findAllByRole('tab')
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute(
      'aria-controls',
      'habits-tabpanel-hoje',
    )
    expect(screen.getByRole('tab', { name: 'Histórico' })).not.toHaveAttribute('aria-controls')
  })

  it('clicar numa aba troca o painel e o estado da querystring', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'Configuração' }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Configuração' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'habits-tabpanel-configuracao')
  })

  it('setas e Home/End percorrem as abas (roving tabIndex)', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    const hoje = await screen.findByRole('tab', { name: 'Hoje' })
    hoje.focus()
    await user.keyboard('{ArrowRight}')
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Histórico' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    await user.keyboard('{End}')
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Configuração' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    await user.keyboard('{Home}')
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true'),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Aba Hoje — registro
// ─────────────────────────────────────────────────────────────────────────────

describe('Aba Hoje — cabeçalho do dia e completude do servidor', () => {
  beforeEach(baseSetup)

  it('mostra a porcentagem do servidor com a barra SEMPRE redundante ao número', async () => {
    mockApi()
    renderPage()
    expect(await screen.findByTestId('habits-day-percent')).toHaveTextContent('64%')
    expect(
      screen.getByRole('img', { name: 'Completude do dia: 64 por cento' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('habit-group-percent')).toHaveTextContent('75%')
    expect(
      screen.getByRole('img', { name: 'Completude do grupo Corpo: 75 por cento' }),
    ).toBeInTheDocument()
  })

  it('nomeia o denominador: soma dos pesos efetivos e registros preenchidos', async () => {
    mockApi()
    renderPage()
    // Alongamento 1×1 + Corrida 3×1 = 4,0 · 1 de 2 preenchidos.
    expect(
      await screen.findByText(/Soma dos pesos efetivos do dia: 4,0 · 1 de 2 registros preenchidos/),
    ).toBeInTheDocument()
  })

  it('mostra data por extenso, chip de tipo de dia e a navegação de data', async () => {
    mockApi()
    renderPage()
    expect(await screen.findByTestId('habits-day-type-chip')).toHaveTextContent('Dia útil')
    expect(screen.getByRole('button', { name: '‹ Anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Próximo ›' })).toBeInTheDocument()
  })

  it('vazio: "Nenhum hábito ativo hoje."', async () => {
    mockApi({ day: habitDay({ entries: [], groups: [], totalCompletion: 0 }) })
    renderPage()
    expect(await screen.findByText('Nenhum hábito ativo hoje.')).toBeInTheDocument()
  })

  it('loading: skeleton com a geometria final e SEM porcentagem provisória', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))
    renderPage()
    const skeleton = screen.getByTestId('habits-today-skeleton')
    expect(skeleton).toHaveAttribute('aria-busy', 'true')
    expect(skeleton.textContent).not.toMatch(/%/)
    expect(screen.queryByTestId('habits-day-percent')).not.toBeInTheDocument()
  })

  it('erro de leitura: alerta + retry que chama refetch', async () => {
    const user = userEvent.setup()
    mockApi({ failing: ['/api/habits/days/'] })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar. Tente novamente.',
    )
    const before = mockGet.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(before))
  })
})

describe('Aba Hoje — linhas (I/O Matrix)', () => {
  beforeEach(baseSetup)

  it('nenhum emoji é renderizado e a coluna do glifo existe VAZIA', async () => {
    mockApi()
    renderPage()
    await screen.findByTestId('habits-day-percent')
    expect(screen.getByRole('main').textContent).not.toContain('🧘')
    const columns = screen.getAllByTestId('habit-glyph-column')
    expect(columns).toHaveLength(2)
    for (const column of columns) expect(column).toBeEmptyDOMElement()
  })

  it('a linha mostra o estado textual e os fatores congelados', async () => {
    mockApi()
    renderPage()
    expect(await screen.findByText('Não feito')).toBeInTheDocument()
    expect(screen.getByText('2,1 / 8 km (26%)')).toBeInTheDocument()
    expect(screen.getAllByTestId('habit-row-factors').map((n) => n.textContent)).toEqual([
      'Peso 1',
      'Peso 3',
    ])
  })

  it('booleano marcado: PATCH {value:"1"} e a porcentagem NÃO muda antes do refetch', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    await user.click(await screen.findByRole('checkbox', { name: 'Alongamento' }))
    expect(mockPatch).toHaveBeenCalledWith('/api/habits/days/e1/', { value: '1' })
    // Otimismo restrito ao valor da linha.
    expect(screen.getByTestId('habits-day-percent')).toHaveTextContent('64%')
    expect(screen.getByTestId('habit-group-percent')).toHaveTextContent('75%')
  })

  it('booleano desmarcado grava NULO e o estado textual vira "Não feito"', async () => {
    const user = userEvent.setup()
    mockApi({ day: habitDay({ entries: [entry({ value: '1' })] }) })
    renderPage()
    expect(await screen.findByText('Feito')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Alongamento' }))
    expect(mockPatch).toHaveBeenCalledWith('/api/habits/days/e1/', { value: null })
  })

  it('numérico: o parser aceita vírgula e grava no formato da API', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    const field = await screen.findByRole('textbox', { name: 'Valor de Corrida' })
    await user.clear(field)
    await user.type(field, '4,5')
    await user.tab()
    expect(mockPatch).toHaveBeenCalledWith('/api/habits/days/e2/', { value: '4.5' })
  })

  it('numérico: ponto também é aceito', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    const field = await screen.findByRole('textbox', { name: 'Valor de Corrida' })
    await user.clear(field)
    await user.type(field, '4.5')
    await user.tab()
    expect(mockPatch).toHaveBeenCalledWith('/api/habits/days/e2/', { value: '4.5' })
  })

  it('numérico INALTERADO no blur: NENHUMA requisição', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    const field = await screen.findByRole('textbox', { name: 'Valor de Corrida' })
    await user.click(field)
    await user.tab()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('numérico vazio grava NULO', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    const field = await screen.findByRole('textbox', { name: 'Valor de Corrida' })
    await user.clear(field)
    await user.tab()
    expect(mockPatch).toHaveBeenCalledWith('/api/habits/days/e2/', { value: null })
  })

  it('Enter também faz commit', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    const field = await screen.findByRole('textbox', { name: 'Valor de Corrida' })
    await user.clear(field)
    await user.type(field, '6{Enter}')
    expect(mockPatch).toHaveBeenCalledWith('/api/habits/days/e2/', { value: '6' })
  })

  it('meta atingida: "Meta atingida · …" e o checkbox indicador marca sozinho, disabled', async () => {
    mockApi({ day: habitDay({ entries: [{ ...NUMERIC_ENTRY, value: '8.4' }] }) })
    renderPage()
    expect(await screen.findByText('Meta atingida · 8,4 / 8 km')).toBeInTheDocument()
    const indicator = screen.getByRole('checkbox', { name: 'Corrida: indicador de meta' })
    expect(indicator).toBeChecked()
    expect(indicator).toBeDisabled()
  })

  it('erro de escrita: rollback, alerta inline, valor DIGITADO preservado e retry', async () => {
    const user = userEvent.setup()
    mockApi()
    mockPatch.mockRejectedValue(new Error('nope'))
    renderPage()
    const field = await screen.findByRole('textbox', { name: 'Valor de Corrida' })
    await user.clear(field)
    await user.type(field, '7,5')
    await user.tab()

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível salvar. Tente novamente.'),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toHaveAttribute(
      'role',
      'alert',
    )
    // Valor digitado preservado + campo marcado como inválido.
    expect(field).toHaveValue('7,5')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    // A porcentagem volta ao último valor confirmado pelo servidor.
    expect(screen.getByTestId('habits-day-percent')).toHaveTextContent('64%')

    const calls = mockPatch.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(mockPatch.mock.calls.length).toBe(calls + 1)
    expect(mockPatch).toHaveBeenLastCalledWith('/api/habits/days/e2/', { value: '7.5' })
  })
})

describe('Aba Hoje — feriado, override e dias passados', () => {
  beforeEach(baseSetup)

  it('marcar feriado chama POST /api/habits/holidays/ (a UI refetcha, não recalcula)', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    await user.click(
      await screen.findByRole('checkbox', { name: 'Marcar este dia como feriado' }),
    )
    expect(mockPost).toHaveBeenCalledWith('/api/habits/holidays/', {
      date: TODAY,
      isHoliday: true,
    })
    expect(screen.getByText(/Precedência: feriado > fim de semana > dia útil/)).toBeInTheDocument()
  })

  it('override avulso só existe quando o dia NÃO é útil e toca só as linhas do dia', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    await screen.findByTestId('habits-day-percent')
    expect(
      screen.queryByRole('button', { name: 'Tratar este dia como dia útil (peso cheio)' }),
    ).not.toBeInTheDocument()

    mockApi({
      day: habitDay({
        dayType: 'holiday',
        entries: [
          entry({ dayType: 'holiday', multiplierAtTime: '0.50' }),
          { ...NUMERIC_ENTRY, dayType: 'holiday', multiplierAtTime: '0.50' },
        ],
      }),
    })
    renderPage()
    const override = await screen.findAllByRole('button', {
      name: 'Tratar este dia como dia útil (peso cheio)',
    })
    await user.click(override[override.length - 1])
    expect(mockPatch).toHaveBeenCalledWith('/api/habits/days/e1/', { multiplierAtTime: '1.00' })
    expect(mockPatch).toHaveBeenCalledWith('/api/habits/days/e2/', { multiplierAtTime: '1.00' })
  })

  it('legenda do grupo só aparece com dia≠útil E multiplicador≠1, com os fatores na linha', async () => {
    mockApi({
      day: habitDay({
        dayType: 'holiday',
        groups: [{ id: 'g1', name: 'Corpo', completion: 50 }],
        entries: [entry({ dayType: 'holiday', multiplierAtTime: '0.50', weightAtTime: '3.00' })],
      }),
    })
    renderPage()
    expect(await screen.findByText('Feriado · peso ×0,5 neste grupo')).toBeInTheDocument()
    expect(screen.getByTestId('habit-row-factors')).toHaveTextContent('Peso 3 × 0,5 = 1,5')
  })

  it('multiplicador 1 em dia não-útil NÃO mostra legenda', async () => {
    mockApi({
      day: habitDay({
        dayType: 'weekend',
        entries: [entry({ dayType: 'weekend', multiplierAtTime: '1.00' })],
      }),
    })
    renderPage()
    await screen.findByTestId('habits-day-percent')
    expect(screen.queryByText(/peso ×/)).not.toBeInTheDocument()
  })

  it('dia passado: a navegação de data busca aquele dia, com os pesos congelados DELE', async () => {
    const user = userEvent.setup()
    const yesterday = addDays(TODAY, -1)
    mockApi()
    renderPage()
    await screen.findByTestId('habits-day-percent')
    await user.click(screen.getByRole('button', { name: '‹ Anterior' }))
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/habits/days/', { params: { date: yesterday } }),
    )
  })
})

describe('Aba Hoje — offline', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
    setOnline(false)
  })

  it('faixa persistente `role="status"` + controles desabilitados com motivo acessível', async () => {
    mockApi()
    renderPage()
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('Sem conexão. Registrar e configurar hábitos exige rede.')

    const checkbox = await screen.findByRole('checkbox', { name: 'Alongamento' })
    expect(checkbox).toBeDisabled()
    expect(checkbox.getAttribute('aria-describedby')).toContain(banner.id)

    const field = screen.getByRole('textbox', { name: 'Valor de Corrida' })
    expect(field).toBeDisabled()
    expect(field.getAttribute('aria-describedby')).toContain(banner.id)

    // Rótulos seguem legíveis: disabled esconde a ação, nunca a informação.
    expect(screen.getByText('Não feito')).toBeInTheDocument()
    expect(screen.getByText('2,1 / 8 km (26%)')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Aba Configuração
// ─────────────────────────────────────────────────────────────────────────────

describe('Aba Configuração', () => {
  beforeEach(baseSetup)

  it('sem grupo cadastrado: campos e botão indisponíveis com o motivo em `role="note"`', async () => {
    mockApi({ groups: [], habits: [] })
    renderPage('/habits?tab=configuracao')
    const note = await screen.findByRole('note')
    expect(note).toHaveTextContent('Crie um grupo para começar a adicionar hábitos.')
    const addHabit = screen.getByRole('button', { name: 'Adicionar hábito' })
    expect(addHabit).toBeDisabled()
    expect(addHabit.getAttribute('aria-describedby')).toBe(note.id)
    expect(screen.getByLabelText(/^Nome \(obrigatório\)$/)).toBeDisabled()
  })

  it('grupo sem hábitos diz "Nenhum hábito neste grupo." sem sugerir ação', async () => {
    mockApi({ habits: [] })
    renderPage('/habits?tab=configuracao')
    expect(await screen.findByText('Nenhum hábito neste grupo.')).toBeInTheDocument()
  })

  it('o aviso de vigência é TEXTO persistente, nunca tooltip', async () => {
    mockApi()
    renderPage('/habits?tab=configuracao')
    const notices = await screen.findAllByTestId('prospective-notice')
    expect(notices.length).toBeGreaterThan(0)
    expect(notices[0]).toHaveTextContent(
      'Alteração válida a partir de hoje. Registros anteriores preservados.',
    )
  })

  it('a precedência é declarada no próprio bloco de multiplicadores', async () => {
    mockApi()
    renderPage('/habits?tab=configuracao')
    expect(
      await screen.findByText(/Precedência: feriado > fim de semana > dia útil\./),
    ).toBeInTheDocument()
  })

  it('multiplicador vazio remove a configuração (envia null) e o placeholder é 1,00', async () => {
    const user = userEvent.setup()
    mockApi({ multipliers: { weekend: '0.50', holiday: '0.50' } })
    renderPage('/habits?tab=configuracao')
    const weekend = await screen.findByRole('textbox', {
      name: 'Multiplicador de fim de semana de Corpo',
    })
    expect(weekend).toHaveValue('0,5')
    expect(weekend).toHaveAttribute('placeholder', '1,00')
    await user.clear(weekend)
    await user.click(screen.getByRole('button', { name: 'Salvar multiplicadores' }))
    expect(mockPut).toHaveBeenCalledWith('/api/habit-groups/g1/multipliers/', {
      weekend: null,
      holiday: '0.5',
    })
  })

  it('falha do bloco de multiplicador NÃO derruba a lista de hábitos', async () => {
    mockApi({ failing: ['/multipliers/'] })
    renderPage('/habits?tab=configuracao')
    await waitFor(() =>
      expect(screen.getByText('Não foi possível carregar. Tente novamente.')).toBeInTheDocument(),
    )
    // A lista continua íntegra.
    expect(screen.getByTestId('habit-config-row')).toHaveTextContent('Alongamento')
  })

  it('editar abre UM bloco por vez, separando Identidade de Versionado', async () => {
    const user = userEvent.setup()
    mockApi({ habits: [habit(), habit({ id: 'h2', name: 'Corrida' })] })
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Editar Alongamento' }))
    expect(screen.getByTestId('habit-edit-block')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Identidade' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Versionado' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar Corrida' }))
    // Continua havendo exatamente UM bloco aberto.
    expect(screen.getAllByTestId('habit-edit-block')).toHaveLength(1)
    expect(screen.getByText('Editando: Corrida')).toBeInTheDocument()
  })

  it('salvar dispara DUAS mutações distintas: versão (peso) e identidade (nome)', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Editar Alongamento' }))

    const weight = screen.getByRole('textbox', { name: 'Peso de Alongamento' })
    await user.clear(weight)
    await user.type(weight, '2')
    const name = within(screen.getByTestId('habit-edit-block')).getByLabelText('Nome')
    await user.clear(name)
    await user.type(name, 'Alongar')

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(mockPost).toHaveBeenCalledWith('/api/habits/h1/versions/', { weight: '2' })
    expect(mockPatch).toHaveBeenCalledWith('/api/habits/h1/', { name: 'Alongar' })
  })

  it('só o lado que mudou é enviado (nome intocado ⇒ nenhum PATCH de identidade)', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Editar Alongamento' }))
    const weight = screen.getByRole('textbox', { name: 'Peso de Alongamento' })
    await user.clear(weight)
    await user.type(weight, '4')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(mockPost).toHaveBeenCalledWith('/api/habits/h1/versions/', { weight: '4' })
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('"Cancelar edição" fecha sem tocar o servidor', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Editar Alongamento' }))
    const weight = screen.getByRole('textbox', { name: 'Peso de Alongamento' })
    await user.clear(weight)
    await user.type(weight, '9')
    await user.click(screen.getByRole('button', { name: 'Cancelar edição' }))
    expect(screen.queryByTestId('habit-edit-block')).not.toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('excluir NÃO existe; desativar/reativar nomeiam a consequência e abrem versão', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Desativar hábito Alongamento' }))
    expect(mockPost).toHaveBeenCalledWith('/api/habits/h1/versions/', { active: false })
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument()
  })

  it('hábito inativo combina chip textual "Inativo" com a data de inativação', async () => {
    mockApi({ habits: [habit({ active: false, effectiveFrom: '2026-08-03' })] })
    renderPage('/habits?tab=configuracao')
    expect(await screen.findByTestId('habit-inactive-chip')).toHaveTextContent('Inativo')
    expect(screen.getByText(/inativo desde 03\/08\/2026/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reativar hábito Alongamento' })).toBeInTheDocument()
  })

  it('"Mostrar inativos" refaz a consulta com includeInactive', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('checkbox', { name: 'Mostrar inativos' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/habits/?includeInactive=true'))
  })

  it('criação: tipo em radiogroup imutável e campos numéricos condicionais', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    const radiogroup = await screen.findByRole('radiogroup', { name: 'Tipo do hábito' })
    expect(within(radiogroup).getAllByRole('radio')).toHaveLength(2)
    expect(screen.queryByLabelText('Meta')).not.toBeInTheDocument()

    await user.click(within(radiogroup).getByRole('radio', { name: 'Numérico' }))
    expect(screen.getByLabelText('Meta')).toBeInTheDocument()
    expect(screen.getByLabelText('Bônus (%)')).toBeInTheDocument()
    expect(screen.getByLabelText('Unidade')).toBeInTheDocument()
  })

  it('criar hábito NÃO envia emoticon (o emoji saiu da interface)', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.type(await screen.findByLabelText(/^Nome \(obrigatório\)$/), 'Caminhada')
    await user.selectOptions(screen.getByLabelText(/^Grupo \(obrigatório\)$/), 'g1')
    await user.click(screen.getByRole('button', { name: 'Adicionar hábito' }))
    expect(mockPost).toHaveBeenCalledWith('/api/habits/', {
      name: 'Caminhada',
      group: 'g1',
      type: 'boolean',
      weight: '1',
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Aba Histórico
// ─────────────────────────────────────────────────────────────────────────────

describe('Aba Histórico', () => {
  beforeEach(baseSetup)

  it('é somente leitura: nenhum controle de escrita de registro na superfície', async () => {
    mockApi()
    renderPage('/habits?tab=historico')
    await screen.findByRole('heading', { name: 'Evolução por hábito' })
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByRole('textbox', { name: /^Valor de/ })).not.toBeInTheDocument()
  })

  it('dia-lacuna: "Sem registro neste dia." + a nota, e NENHUMA porcentagem', async () => {
    mockApi()
    renderPage('/habits?tab=historico')
    expect(await screen.findByText('Sem registro neste dia.')).toBeInTheDocument()
    expect(
      screen.getByText('Nenhuma linha foi materializada para este dia — o dia nunca foi aberto.'),
    ).toBeInTheDocument()
    const gap = screen.getByText('Sem registro neste dia.').closest('section')
    expect(gap?.textContent).not.toMatch(/completude \d+%/)
  })

  it('"Abrir este dia para edição" ativa a aba Hoje com a data selecionada', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=historico')
    await user.click(await screen.findByRole('button', { name: 'Abrir este dia para edição' }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true'),
    )
  })

  it('sem hábito selecionado, NADA é buscado para a série', async () => {
    mockApi()
    renderPage('/habits?tab=historico')
    expect(
      await screen.findByText('Selecione um hábito para ver o gráfico de evolução.'),
    ).toBeInTheDocument()
    expect(mockGet.mock.calls.some(([url]: [string]) => url.includes('/series/'))).toBe(false)
  })

  it('o select de Visão oferece as três visões sobre o payload existente', async () => {
    mockApi()
    renderPage('/habits?tab=historico')
    const view = await screen.findByLabelText('Visão')
    expect(within(view).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Valor diário',
      '% da meta',
      'Contribuição na completude',
    ])
  })

  it('falha parcial: a série falha e a GRADE carrega íntegra', async () => {
    const user = userEvent.setup()
    mockApi({ failing: ['/series/'] })
    renderPage('/habits?tab=historico')
    await user.selectOptions(await screen.findByLabelText('Hábito'), 'h1')
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível carregar. Tente novamente.',
      ),
    )
    expect(screen.getByRole('table', { name: /Completude por hábito e semana/ })).toBeInTheDocument()
  })

  it('a grade traz caption, th scope, tags de tipo de dia e a tabela equivalente', async () => {
    mockApi()
    renderPage('/habits?tab=historico')
    const grid = await screen.findByRole('table', { name: /Completude por hábito e semana/ })
    expect(within(grid).getByRole('rowheader', { name: /Alongamento/ })).toBeInTheDocument()
    expect(within(grid).getAllByRole('columnheader').length).toBeGreaterThan(1)
    // Tabela equivalente PERMANENTE, na mesma superfície.
    expect(
      screen.getByRole('table', { name: /Mesma leitura em formato linear/ }),
    ).toBeInTheDocument()
  })

  it('período sem nenhum hábito: "Nenhum registro no período."', async () => {
    mockApi({ historyRange: history({ habits: [], days: [] }) })
    renderPage('/habits?tab=historico')
    expect(await screen.findByText('Nenhum registro no período.')).toBeInTheDocument()
  })

  it('no compact a grade vira lista por dia (sem scroll horizontal)', async () => {
    mockCompactFaixa()
    mockApi()
    renderPage('/habits?tab=historico')
    expect(await screen.findByText('Completude por dia')).toBeInTheDocument()
    expect(
      screen.queryByRole('table', { name: /Completude por hábito e semana/ }),
    ).not.toBeInTheDocument()
  })
})
