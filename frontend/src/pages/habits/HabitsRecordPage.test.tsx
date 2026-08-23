import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { MemoryRouter, useLocation } from 'react-router-dom'
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
    // Story 16.2 trouxe `iconKey` ao contrato; a RENDERIZAÇÃO é DW-60. Nulo
    // aqui é o estado real desta fase: a coluna do glifo segue vazia.
    iconKey: null,
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

/**
 * Duas semanas ISO FECHADAS (03–09/08/2026 e 10–16/08/2026, segunda→domingo),
 * com datas literais: o bucket semanal não pode depender do dia em que a suíte
 * roda. Três hábitos, um por caso de célula:
 *   h1 booleano  → 5 feitos em 7 dias com registro  ⇒ "5/7"
 *   h2 numérico com meta 8 → 100% e 50%             ⇒ "75%"
 *   h3 numérico SEM meta   → valores 2 e 3          ⇒ "2,5" (sem tom)
 * A segunda semana não tem NENHUMA linha ⇒ "—" nas três.
 */
const WEEK_1 = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09']
const WEEK_2 = ['2026-08-10', '2026-08-11']

function twoWeekHistory(): HabitHistoryRange {
  return {
    start: WEEK_1[0],
    end: WEEK_2[WEEK_2.length - 1],
    habits: [
      { id: 'h1', name: 'Alongamento', emoticon: null, type: 'boolean', unit: '', group: 'g1' },
      { id: 'h2', name: 'Corrida', emoticon: null, type: 'numeric', unit: 'km', group: 'g1' },
      { id: 'h3', name: 'Água', emoticon: null, type: 'numeric', unit: 'L', group: 'g1' },
    ],
    days: [
      ...WEEK_1.map((date, index) => ({
        date,
        dayType: 'weekday' as const,
        totalCompletion: 50,
        groups: [{ id: 'g1', name: 'Corpo', completion: 50 }],
        entries: [
          // 5 feitos, 2 abertos e não feitos ⇒ 5/7 (a razão REAL).
          entry({ id: `b-${date}`, habitId: 'h1', value: index < 5 ? '1' : null }),
          // Só dois dias medidos: 8/8 = 100% e 4/8 = 50% ⇒ média 75%.
          ...(index < 2
            ? [
                entry({
                  id: `n-${date}`,
                  habitId: 'h2',
                  name: 'Corrida',
                  type: 'numeric',
                  unit: 'km',
                  value: index === 0 ? '8' : '4',
                  metaAtTime: '8',
                  bonusAtTime: '20',
                  weightAtTime: '3.00',
                }),
                // SEM meta congelada: tem registro, logo tem número.
                entry({
                  id: `nm-${date}`,
                  habitId: 'h3',
                  name: 'Água',
                  type: 'numeric',
                  unit: 'L',
                  value: index === 0 ? '2' : '3',
                  metaAtTime: null,
                }),
              ]
            : []),
        ],
      })),
      ...WEEK_2.map((date) => ({
        date,
        dayType: 'weekday' as const,
        totalCompletion: null,
        groups: [],
        entries: [],
      })),
    ],
  }
}

/** Série de DUAS medições do hábito numérico h2, coerente com `twoWeekHistory`. */
const NUMERIC_SERIES = {
  habit: { id: 'h2', name: 'Corrida', type: 'numeric', unit: 'km', group: 'g1' },
  points: [
    { date: WEEK_1[0], value: '8' },
    { date: WEEK_1[1], value: '4' },
  ],
  events: [],
  dayTypes: [
    { date: WEEK_1[0], dayType: 'weekday' },
    { date: WEEK_1[1], dayType: 'weekday' },
  ],
}

// Série BOOLEANA. `WEEK_1[1]` tem PONTO com `value: null` = linha materializada
// e não feita — não é lacuna. É o dia que fazia gráfico e tabela discordarem.
const BOOLEAN_SERIES = {
  habit: { id: 'h1', name: 'Alongamento', type: 'boolean', unit: null, group: 'g1' },
  points: [
    { date: WEEK_1[0], value: '1' },
    { date: WEEK_1[1], value: null },
  ],
  events: [],
  dayTypes: [
    { date: WEEK_1[0], dayType: 'weekday' },
    { date: WEEK_1[1], dayType: 'weekday' },
  ],
}

// ─── Harness ─────────────────────────────────────────────────────────────────

interface RouteData {
  day?: HabitDay
  habits?: Habit[]
  groups?: HabitGroup[]
  historyRange?: HabitHistoryRange
  multipliers?: { weekend: string; holiday: string }
  /** Série do gráfico. Sem isto o payload é vazio e nenhuma visão calcula nada. */
  series?: unknown
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
        data:
          data.series ?? {
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

  // P6: reselecionar a aba ATUAL empurrava uma entrada idêntica no histórico —
  // o primeiro `back` não mudava de aba, contrariando a AC. O `MemoryRouter`
  // tem pilha PRÓPRIA, então a prova é o tamanho dela: 3 cliques na mesma aba
  // acrescentam UMA entrada, não três.
  it('reselecionar a aba atual NÃO empilha entrada no histórico', async () => {
    const user = userEvent.setup()
    mockApi()
    // A prova é o TAMANHO da pilha do router, que só o `useNavigationType` +
    // `key` de cada location revela: entradas empilhadas têm `key` distinta
    // mesmo com a MESMA URL, então contamos keys, não URLs.
    const keys: string[] = []
    function Probe() {
      const location = useLocation()
      if (keys[keys.length - 1] !== location.key) keys.push(location.key)
      return null
    }
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={qc}>
        <ThemeProvider theme={createBujoTheme('light')}>
          <MemoryRouter initialEntries={['/habits']}>
            <Probe />
            <HabitsRecordPage />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    )

    const historico = await screen.findByRole('tab', { name: 'Histórico' })
    await user.click(historico)
    await waitFor(() => expect(historico).toHaveAttribute('aria-selected', 'true'))
    // Cliques REPETIDOS na aba já selecionada não produzem navegação nova.
    await user.click(screen.getByRole('tab', { name: 'Histórico' }))
    await user.click(screen.getByRole('tab', { name: 'Histórico' }))

    // Uma entrada inicial + UMA navegação real = 2 keys. Sem o guard, os dois
    // cliques extras empilhariam entradas novas (4 keys).
    expect(keys).toHaveLength(2)
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

  // I/O Matrix — "Σ pesos efetivos = 0": nenhum hábito era EXIGÍVEL no dia
  // (multiplicador congelado 0 em todas as linhas). A completude é 0% **por
  // definição do domínio** e vem do SERVIDOR; a interface só nomeia o
  // denominador para que o 0% não seja lido como "falhou tudo".
  it('Σ pesos efetivos = 0: 0% vem do servidor e o denominador diz que nada era exigível', async () => {
    mockApi({
      day: habitDay({
        totalCompletion: 0,
        dayType: 'holiday',
        groups: [{ id: 'g1', name: 'Corpo', completion: 0 }],
        entries: [
          entry({ dayType: 'holiday', multiplierAtTime: '0.00' }),
          { ...NUMERIC_ENTRY, dayType: 'holiday', multiplierAtTime: '0.00' },
        ],
      }),
    })
    renderPage()
    expect(await screen.findByTestId('habits-day-percent')).toHaveTextContent('0%')
    expect(
      await screen.findByText(/Soma dos pesos efetivos do dia: 0,0 · 1 de 2 registros preenchidos/),
    ).toBeInTheDocument()
    // A barra continua redundante ao número — 0% NÃO é ausência de leitura.
    expect(screen.getByRole('img', { name: 'Completude do dia: 0 por cento' })).toBeInTheDocument()
    // O 0% saiu do payload: a interface nunca recalculou nada.
    expect(screen.getByTestId('habit-group-percent')).toHaveTextContent('0%')
  })

  it('mostra data por extenso, chip de tipo de dia e a navegação de data', async () => {
    mockApi()
    renderPage()
    expect(await screen.findByTestId('habits-day-type-chip')).toHaveTextContent('Dia útil')
    expect(screen.getByRole('button', { name: 'Dia anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeInTheDocument()
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

  it('nenhum emoji é renderizado; a coluna do glifo existe e fica VAZIA sem `iconKey`', async () => {
    mockApi()
    renderPage()
    await screen.findByTestId('habits-day-percent')
    expect(screen.getByRole('main').textContent).not.toContain('🧘')
    const columns = screen.getAllByTestId('habit-glyph-column')
    expect(columns).toHaveLength(2)
    // Fixture default = `iconKey: null` nas duas linhas: layout da 16.1 intacto.
    // Nada de `waitFor` aqui: sem chave não há nada em voo para esperar.
    for (const column of columns) {
      expect(column).toBeEmptyDOMElement()
      expect(column).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('DW-60: `iconKey` válido rende o glifo no tracker; chave ÓRFÃ deixa a coluna vazia', async () => {
    mockApi({
      day: habitDay({
        entries: [
          entry({ iconKey: 'barbell' }),
          { ...NUMERIC_ENTRY, iconKey: 'glifo-que-saiu-numa-atualizacao' },
        ],
      }),
    })
    renderPage()
    await screen.findByTestId('habits-day-percent')
    const [comGlifo, orfa] = screen.getAllByTestId('habit-glyph-column')

    const svg = await waitFor(() => {
      const found = comGlifo.querySelector('svg')
      expect(found).not.toBeNull()
      return found!
    })
    // Decorativo (a coluna é `aria-hidden`), monocromático e medido por token.
    expect(svg).toHaveAttribute('fill', 'currentColor')
    expect(svg.getAttribute('style')).toContain('var(--ds-domain-icon-size-default)')
    // Chave órfã: ausência, NUNCA tofu/quadrado/glifo de erro. A asserção vem
    // DEPOIS de a chave válida já ter resolvido — a janela de resolução passou,
    // então a coluna vazia é prova de ausência, não de "ainda não chegou".
    expect(orfa).toBeEmptyDOMElement()
    expect(orfa.querySelector('svg')).toBeNull()
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
    // E3: o campo mostra o DIGITADO e o estado o CONFIRMADO — a linha diz qual
    // é qual, em vez de exibir dois números que se contradizem em silêncio.
    expect(screen.getByText(/— valor no servidor/)).toBeInTheDocument()

    const calls = mockPatch.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(mockPatch.mock.calls.length).toBe(calls + 1)
    expect(mockPatch).toHaveBeenLastCalledWith('/api/habits/days/e2/', { value: '7.5' })
  })

  // E2: durante a escrita a linha recebe o tom suave do primário e o texto
  // "salvando…". O estado é curtíssimo, então a altura tem de estar RESERVADA
  // desde antes — a linha não pode crescer e encolher no caminho.
  it('E2: linha ganha fundo e "salvando…" sem mudar de altura', async () => {
    const user = userEvent.setup()
    mockApi()
    // Escrita que não resolve: o estado pendente fica observável.
    mockPatch.mockReturnValue(new Promise(() => {}))
    renderPage()
    const checkbox = await screen.findByRole('checkbox', { name: 'Alongamento' })
    const row = screen.getAllByTestId('habit-tracker-row')[0]

    // O slot do estado transitório existe ANTES de qualquer escrita, com altura
    // mínima reservada — é isso que impede o pulo. (jsdom não faz layout, então
    // a prova é estrutural: o slot está montado e reserva medida por token.)
    const slotBefore = row.querySelector('[data-testid="habit-row-transient"]')
    expect(slotBefore).not.toBeNull()
    expect(slotBefore).toBeEmptyDOMElement()

    await user.click(checkbox)

    const saving = await screen.findByText('salvando…')
    expect(saving).toHaveAttribute('role', 'status')
    // O texto entra DENTRO do slot já existente — nenhum nó novo acima/abaixo.
    expect(row.querySelector('[data-testid="habit-row-transient"]')).toContainElement(saving)
    // E2: a linha inteira recebe o tom suave do primário durante a escrita.
    expect(row).toHaveStyle({ backgroundColor: 'var(--ds-primary-soft)' })
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

  // `GET /api/habits/days/?date=` chama `seed_habit_day` SEM teto, então abrir
  // um dia futuro MATERIALIZA linhas nele com os pesos de hoje congelados — e
  // esse dia passa a contar como "dia com registro" na grade (5/7 viraria
  // 5/12). A I/O Matrix só contempla dia PASSADO: o futuro não é destino.
  it('o futuro não é navegável: "Próximo dia" para em hoje (botão desabilitado basta)', async () => {
    mockApi()
    renderPage()
    await screen.findByTestId('habits-day-percent')

    const next = screen.getByRole('button', { name: 'Próximo dia' })
    expect(next).toBeDisabled()
    expect(screen.queryByText(/último dia registrável/)).not.toBeInTheDocument()

    // `fireEvent` (não `userEvent`): queremos provar que nem um clique
    // sintético atravessa o `disabled` — `userEvent` recusaria antes, no
    // `pointer-events: none`, e a asserção nunca chegaria à requisição.
    fireEvent.click(next)
    // NENHUMA leitura de dia futuro foi disparada (nem materialização, então).
    const requestedDates = mockGet.mock.calls
      .filter(([url]: [string]) => String(url).startsWith('/api/habits/days/'))
      .map(([, config]: [string, { params?: { date?: string } }]) => config?.params?.date)
      .filter((value): value is string => value != null)
    for (const requested of requestedDates) expect(requested <= TODAY).toBe(true)
  })

  it('voltando ao passado, "Próximo dia" volta a existir (o teto é hoje, não a navegação)', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()
    await screen.findByTestId('habits-day-percent')
    await user.click(screen.getByRole('button', { name: 'Dia anterior' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeEnabled(),
    )
    expect(screen.queryByText(/último dia registrável/)).not.toBeInTheDocument()
  })

  it('feriado que FALHA: alerta + retry da MESMA escrita, sem mexer na porcentagem', async () => {
    const user = userEvent.setup()
    mockApi()
    mockPost.mockRejectedValue(new Error('nope'))
    renderPage()
    await screen.findByTestId('habits-day-percent')
    await user.click(screen.getByRole('checkbox', { name: 'Marcar este dia como feriado' }))

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível salvar. Tente novamente.'),
      ).toHaveAttribute('role', 'alert'),
    )
    // A porcentagem NÃO se move: quem a calcula é o servidor.
    expect(screen.getByTestId('habits-day-percent')).toHaveTextContent('64%')

    const before = mockPost.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(mockPost.mock.calls.length).toBe(before + 1))
    expect(mockPost).toHaveBeenLastCalledWith('/api/habits/holidays/', {
      date: TODAY,
      isHoliday: true,
    })
  })

  it('override que FALHA: erro agregado + retry das MESMAS linhas', async () => {
    const user = userEvent.setup()
    mockApi({
      day: habitDay({
        dayType: 'holiday',
        entries: [
          entry({ dayType: 'holiday', multiplierAtTime: '0.50' }),
          { ...NUMERIC_ENTRY, dayType: 'holiday', multiplierAtTime: '0.50' },
        ],
      }),
    })
    mockPatch.mockRejectedValue(new Error('nope'))
    renderPage()
    await screen.findByTestId('habits-day-percent')
    await user.click(
      screen.getByRole('button', { name: 'Tratar este dia como dia útil (peso cheio)' }),
    )

    await waitFor(() =>
      expect(screen.getAllByRole('alert').map((node) => node.textContent)).toContain(
        'Não foi possível salvar. Tente novamente.',
      ),
    )
    expect(screen.getByTestId('habits-day-percent')).toHaveTextContent('64%')

    const before = mockPatch.mock.calls.length
    await user.click(
      screen.getAllByRole('button', { name: 'Tentar de novo' })[0],
    )
    // As MESMAS duas linhas do dia visível, de novo.
    await waitFor(() => expect(mockPatch.mock.calls.length).toBe(before + 2))
    expect(mockPatch).toHaveBeenLastCalledWith('/api/habits/days/e2/', {
      multiplierAtTime: '1.00',
    })
  })

  it('dia passado: a navegação de data busca aquele dia, com os pesos congelados DELE', async () => {
    const user = userEvent.setup()
    const yesterday = addDays(TODAY, -1)
    mockApi()
    renderPage()
    await screen.findByTestId('habits-day-percent')
    await user.click(screen.getByRole('button', { name: 'Dia anterior' }))
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

  // P5: navegar de data offline dispara uma LEITURA que não pode completar — o
  // usuário cairia no erro de leitura com um retry incapaz de funcionar. A
  // navegação para junto da escrita, apontando para a MESMA faixa.
  it('offline: a navegação de DATA também fica indisponível apontando para a faixa', async () => {
    mockApi()
    renderPage()
    const banner = await screen.findByRole('status')
    for (const name of ['Dia anterior', 'Hoje', 'Próximo dia']) {
      const button = screen.getByRole('button', { name })
      expect(button).toBeDisabled()
      expect(button.getAttribute('aria-describedby')).toContain(banner.id)
    }
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

  // O backend REJEITA (400) os dois campos nulos e IGNORA o campo nulo isolado
  // (`SetGroupMultipliersSerializer.validate` + `if value is not None` no PUT).
  // Logo `null` nunca removeria nada: o campo vazio precisa salvar 1,00 para a
  // I/O Matrix ("a leitura volta a 1,00") valer de fato.
  it('multiplicador vazio salva 1,00 (nunca null) e o placeholder é 1,00', async () => {
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
      weekend: '1.00',
      holiday: '0.5',
    })
  })

  it('grupo sem config nenhuma (dois campos vazios) ainda envia um corpo válido', async () => {
    const user = userEvent.setup()
    // Estado MAIS COMUM: nenhum multiplicador salvo ⇒ servidor devolve 1.00 nos
    // dois ⇒ os dois campos nascem vazios. Enviar `{null, null}` daria 400.
    mockApi()
    renderPage('/habits?tab=configuracao')
    const weekend = await screen.findByRole('textbox', {
      name: 'Multiplicador de fim de semana de Corpo',
    })
    expect(weekend).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Salvar multiplicadores' }))
    expect(mockPut).toHaveBeenCalledWith('/api/habit-groups/g1/multipliers/', {
      weekend: '1.00',
      holiday: '1.00',
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

  // `add_habit_version` faz `update_or_create` na versão de HOJE: disparar sem
  // mudança de peso/meta/bônus cria uma versão espúria — e num hábito INATIVO
  // reescreve o `effective_from`, fazendo o resumo dizer "inativo desde hoje".
  it('mudança só de IDENTIDADE não abre versão (espelho do teste do peso)', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Editar Alongamento' }))
    const name = within(screen.getByTestId('habit-edit-block')).getByLabelText('Nome')
    await user.clear(name)
    await user.type(name, 'Alongar')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/habits/h1/', { name: 'Alongar' }),
    )
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('peso reescrito com o MESMO valor (3 vs 3,00) não abre versão', async () => {
    const user = userEvent.setup()
    mockApi({ habits: [habit({ weight: '3.00' })] })
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Editar Alongamento' }))
    const weight = screen.getByRole('textbox', { name: 'Peso de Alongamento' })
    await user.clear(weight)
    await user.type(weight, '3,00')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    // Nada mudou por VALOR: submit é no-op de servidor.
    await waitFor(() => expect(screen.queryByTestId('habit-edit-block')).not.toBeInTheDocument())
    expect(mockPost).not.toHaveBeenCalled()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('salvar com sucesso FECHA o bloco de edição (paridade HabitsManager.tsx:136-138)', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Editar Alongamento' }))
    const weight = screen.getByRole('textbox', { name: 'Peso de Alongamento' })
    await user.clear(weight)
    await user.type(weight, '5')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(screen.queryByTestId('habit-edit-block')).not.toBeInTheDocument())
  })

  it('salvar que FALHA mantém o bloco aberto com o valor digitado e o alerta', async () => {
    const user = userEvent.setup()
    mockApi()
    mockPost.mockRejectedValue(new Error('nope'))
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Editar Alongamento' }))
    const weight = screen.getByRole('textbox', { name: 'Peso de Alongamento' })
    await user.clear(weight)
    await user.type(weight, '5')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() =>
      expect(
        within(screen.getByTestId('habit-edit-block')).getByRole('alert'),
      ).toHaveTextContent('Não foi possível salvar. Tente novamente.'),
    )
    expect(screen.getByRole('textbox', { name: 'Peso de Alongamento' })).toHaveValue('5')
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

  // Toda outra escrita desta superfície tem alerta + retry; a ativação era a
  // única MUDA (só `isPending` era consumido).
  it('desativar que FALHA mostra alerta + retry que reenvia a MESMA escrita', async () => {
    const user = userEvent.setup()
    mockApi()
    mockPost.mockRejectedValue(new Error('nope'))
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Desativar hábito Alongamento' }))

    const box = await screen.findByTestId('habit-activation-error')
    expect(within(box).getByRole('alert')).toHaveTextContent(
      'Não foi possível salvar. Tente novamente.',
    )
    const before = mockPost.mock.calls.length
    await user.click(within(box).getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(mockPost.mock.calls.length).toBe(before + 1))
    expect(mockPost).toHaveBeenLastCalledWith('/api/habits/h1/versions/', { active: false })
  })

  it('"Mostrar inativos" NÃO desmonta o bloco de edição aberto (nem perde o digitado)', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.click(await screen.findByRole('button', { name: 'Editar Alongamento' }))
    const weight = screen.getByRole('textbox', { name: 'Peso de Alongamento' })
    await user.clear(weight)
    await user.type(weight, '9')

    // A troca de `includeInactive` TROCA a chave da query: `data` volta a
    // `undefined` enquanto a nova página não chega. Se o skeleton do painel
    // aparecer nesse intervalo, o bloco (e o que foi digitado) morre.
    const original = mockGet.getMockImplementation() as (
      url: string,
      config?: unknown,
    ) => Promise<unknown>
    mockGet.mockImplementation((url: string, config?: unknown) =>
      url === '/api/habits/' ? new Promise(() => {}) : original(url, config),
    )
    await user.click(screen.getByRole('checkbox', { name: 'Mostrar inativos' }))

    expect(screen.getByTestId('habit-edit-block')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Peso de Alongamento' })).toHaveValue('9')
    expect(screen.queryByTestId('habits-config-skeleton')).not.toBeInTheDocument()
  })

  it('offline: toda escrita da Configuração fica indisponível apontando para a faixa', async () => {
    const user = userEvent.setup()
    setOnline(false)
    mockApi()
    renderPage('/habits?tab=configuracao')
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('Sem conexão. Registrar e configurar hábitos exige rede.')

    for (const name of [
      'Adicionar hábito',
      'Adicionar grupo',
      'Salvar multiplicadores',
      'Desativar hábito Alongamento',
    ]) {
      const control = screen.getByRole('button', { name })
      expect(control).toBeDisabled()
      expect(control.getAttribute('aria-describedby')).toBe(banner.id)
    }

    // "Salvar alterações" vive dentro do bloco de edição — abrir é LEITURA.
    await user.click(screen.getByRole('button', { name: 'Editar Alongamento' }))
    const save = screen.getByRole('button', { name: 'Salvar alterações' })
    expect(save).toBeDisabled()
    expect(save.getAttribute('aria-describedby')).toBe(banner.id)
    // Rótulos seguem legíveis (offline não é readonly disfarçado).
    expect(screen.getByText('Identidade')).toBeVisible()
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

  // O payload NUMÉRICO tem campos que o booleano não tem (e que o backend
  // REJEITA no booleano: `HabitCreateSerializer`). Sem esta asserção, perder
  // `unit` — ou enviar meta/bônus incondicionalmente — passaria verde.
  it('criar hábito NUMÉRICO envia meta, bônus e unidade', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.type(await screen.findByLabelText(/^Nome \(obrigatório\)$/), 'Correr')
    await user.selectOptions(screen.getByLabelText(/^Grupo \(obrigatório\)$/), 'g1')
    const radiogroup = screen.getByRole('radiogroup', { name: 'Tipo do hábito' })
    await user.click(within(radiogroup).getByRole('radio', { name: 'Numérico' }))
    await user.type(screen.getByLabelText('Meta'), '8')
    await user.type(screen.getByLabelText('Bônus (%)'), '10')
    await user.type(screen.getByLabelText('Unidade'), 'km')
    await user.click(screen.getByRole('button', { name: 'Adicionar hábito' }))
    expect(mockPost).toHaveBeenCalledWith('/api/habits/', {
      name: 'Correr',
      group: 'g1',
      type: 'numeric',
      weight: '1',
      meta: '8',
      bonus: '10',
      unit: 'km',
    })
  })

  // `Adicionar grupo` é a ÚNICA saída do estado "zero grupos" (com o formulário
  // de hábito todo `disabled`). Antes deste teste a string só aparecia na
  // asserção de `disabled` offline: quebrar o submit não falhava nada.
  it('criar grupo envia o nome TRIMADO e limpa o campo no sucesso', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    const field = await screen.findByLabelText('Nome do grupo')
    await user.type(field, '  Saúde  ')
    await user.click(screen.getByRole('button', { name: 'Adicionar grupo' }))
    expect(mockPost).toHaveBeenCalledWith('/api/habit-groups/', { name: 'Saúde' })
    await waitFor(() => expect(field).toHaveValue(''))
  })

  it('criar grupo com nome vazio NÃO submete', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=configuracao')
    await user.type(await screen.findByLabelText('Nome do grupo'), '   ')
    await user.click(screen.getByRole('button', { name: 'Adicionar grupo' }))
    expect(mockPost).not.toHaveBeenCalledWith('/api/habit-groups/', expect.anything())
  })

  it('mover hábito de grupo vai no PATCH de IDENTIDADE', async () => {
    const user = userEvent.setup()
    mockApi({
      groups: [
        { id: 'g1', name: 'Corpo', displayOrder: 0 },
        { id: 'g2', name: 'Mente', displayOrder: 1 },
      ],
    })
    renderPage('/habits?tab=configuracao')
    await user.click((await screen.findAllByRole('button', { name: /^Editar / }))[0])
    await user.selectOptions(screen.getByLabelText('Grupo'), 'g2')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/api/habits/h1/',
        expect.objectContaining({ group: 'g2' }),
      ),
    )
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

  // P1: `% da meta` num BOOLEANO zeraria a série inteira (metaAtTime é sempre
  // nulo) e a tabela equivalente imprimiria "Sem registro neste dia." em dias
  // QUE TÊM registro — absência fabricada. A visão não é oferecida.
  it('hábito booleano NÃO oferece a visão "% da meta"', async () => {
    const user = userEvent.setup()
    mockApi({ historyRange: twoWeekHistory(), series: BOOLEAN_SERIES })
    renderPage('/habits?tab=historico')
    await user.selectOptions(await screen.findByLabelText('Hábito'), 'h1')
    await waitFor(() => {
      const view = screen.getByLabelText('Visão')
      expect(within(view).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Valor diário',
        'Contribuição na completude',
      ])
    })
  })

  // P2: booleano com linha materializada e valor nulo é "não feito" ⇒ 0 em
  // TODAS as visões. O gráfico desenhava lacuna enquanto a tabela imprimia 0.
  it('booleano não feito lê 0 na contribuição — gráfico e tabela concordam', async () => {
    const user = userEvent.setup()
    mockApi({ historyRange: twoWeekHistory(), series: BOOLEAN_SERIES })
    renderPage('/habits?tab=historico')
    await user.selectOptions(await screen.findByLabelText('Hábito'), 'h1')
    await user.selectOptions(screen.getByLabelText('Visão'), 'contribution')
    const table = await screen.findByRole('table', { name: /Tabela equivalente do gráfico/ })
    // Feito ⇒ 100%; não feito ⇒ 0%, NUNCA "Sem registro neste dia."
    expect(within(table).getByText('100 %')).toBeInTheDocument()
    expect(within(table).getByText('0 %')).toBeInTheDocument()
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

  // P3: o cabeçalho da coluna conta dias COM REGISTRO, não dias corridos. A
  // WEEK_2 do fixture tem 2 datas e ZERO linhas materializadas: dizer "2 dias"
  // ali, sobre células "—", é a leitura errada que o rótulo existe para evitar.
  it('cabeçalho da coluna da grade conta dias COM REGISTRO, não dias corridos', async () => {
    mockApi({ historyRange: twoWeekHistory() })
    renderPage('/habits?tab=historico')
    const table = await screen.findByRole('table', { name: /Completude por hábito e semana/ })
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent ?? '')
    // Semana 1: 7 datas, todas com linha ⇒ "7 dias".
    expect(headers.some((text) => text.includes('7 dias'))).toBe(true)
    // Semana 2: 2 datas, NENHUMA com linha ⇒ "0 dias" (nunca "2 dias").
    expect(headers.some((text) => text.includes('0 dias'))).toBe(true)
    expect(headers.some((text) => text.includes('2 dias'))).toBe(false)
  })

  // DW-60 — o MESMO `iconKey` nas três superfícies. O tracker é coberto na aba
  // Hoje; aqui ficam as duas leituras do Histórico (detalhe do dia e grade), e
  // a prova de que a TABELA EQUIVALENTE — a representação de acessibilidade —
  // continua só texto.
  it('DW-60: o glifo aparece no detalhe do dia e na grade, e NUNCA na tabela equivalente', async () => {
    mockApi({
      historyRange: {
        ...history(),
        habits: [
          { id: 'h1', name: 'Alongamento', emoticon: null, iconKey: 'barbell', type: 'boolean', unit: '', group: 'g1' },
        ],
        // O detalhe abre em HOJE, então a entrada com glifo tem de morar em HOJE.
        days: [
          {
            date: TODAY,
            dayType: 'weekday' as const,
            totalCompletion: 50,
            groups: [{ id: 'g1', name: 'Corpo', completion: 50 }],
            entries: [entry({ id: 'he1', value: '1', iconKey: 'barbell' })],
          },
        ],
      },
    })
    renderPage('/habits?tab=historico')

    // Detalhe do dia: glifo `compact` antes do nome da entrada.
    const detailHeading = await screen.findByRole('heading', {
      name: /^\w+, \d{1,2} de \w+ de \d{4}$/,
    })
    const detail = detailHeading.closest('section')!
    const detailGlyph = await waitFor(() => {
      const found = detail.querySelector('svg')
      expect(found).not.toBeNull()
      return found!
    })
    expect(detailGlyph.getAttribute('style')).toContain('var(--ds-domain-icon-size-compact)')
    expect(detailGlyph).toHaveAttribute('fill', 'currentColor')

    // Grade wide: o glifo mora DENTRO do `th scope="row"`.
    const grid = screen.getByRole('table', { name: /Completude por hábito e semana/ })
    const rowHeader = within(grid).getByRole('rowheader', { name: /Alongamento/ })
    await waitFor(() => expect(rowHeader.querySelector('svg')).not.toBeNull())
    expect(rowHeader.querySelector('svg')!.getAttribute('style')).toContain(
      'var(--ds-domain-icon-size-compact)',
    )

    // Tabela equivalente: SÓ TEXTO. Glifo ali seria ruído sem informação nova.
    const equivalent = screen.getByRole('table', { name: /Mesma leitura em formato linear/ })
    expect(equivalent.querySelectorAll('svg')).toHaveLength(0)
  })

  it('DW-60: sem `iconKey`, o Histórico não rende glifo nenhum (estado da 16.1)', async () => {
    mockApi()
    renderPage('/habits?tab=historico')
    const grid = await screen.findByRole('table', { name: /Completude por hábito e semana/ })
    const rowHeader = within(grid).getByRole('rowheader', { name: /Alongamento/ })
    await waitFor(() => expect(rowHeader).toHaveTextContent('Alongamento'))
    // Sem `iconKey` no payload, nenhum import é disparado — não há janela de
    // resolução a esperar, e a ausência é imediata e definitiva.
    expect(rowHeader.querySelector('svg')).toBeNull()
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

  // Antes desta rodada NENHUM teste lia o CONTEÚDO de uma célula: a moldura
  // (rowheader/colunas/tabela equivalente) era asserida e os dois laços e2e só
  // exigiam `not.toHaveText('')` — que um "—" satisfaz. Re-chavear
  // `entriesByHabit` por `entry.id` derrubaria toda célula para "—" com a
  // suíte inteira verde. Este teste fixa a leitura real de cada célula.
  it('a grade lê o CONTEÚDO de cada célula: 5/7 booleano, 75% numérico, "—" na semana sem linha', async () => {
    mockApi({ historyRange: twoWeekHistory() })
    renderPage('/habits?tab=historico')
    const grid = await screen.findByRole('table', { name: /Completude por hábito e semana/ })

    function cellsOf(habitName: string) {
      const row = within(grid)
        .getAllByRole('row')
        .find((candidate) => candidate.textContent?.startsWith(habitName))
      expect(row).toBeDefined()
      return within(row!).getAllByRole('cell')
    }

    // Duas semanas ISO fechadas ⇒ exatamente duas colunas de dados.
    expect(cellsOf('Alongamento')).toHaveLength(2)
    // Booleano: 5 feitos em 7 dias COM registro — a razão real, não o numerador.
    expect(cellsOf('Alongamento')[0].textContent).toMatch(/^5\/7/)
    // Numérico com meta: média do percentual da meta dos dias MEDIDOS.
    expect(cellsOf('Corrida')[0].textContent).toMatch(/^75%/)
    // Numérico SEM meta congelada: tem registro, logo tem NÚMERO (a média dos
    // valores crus) — nunca o travessão do "período sem linha".
    expect(cellsOf('Água')[0].textContent).toMatch(/^2,5/)
    // Semana sem nenhuma linha: travessão nas três.
    for (const name of ['Alongamento', 'Corrida', 'Água']) {
      expect(cellsOf(name)[1].textContent).toMatch(/^—/)
    }

    // A tabela equivalente diz a MESMA coisa, em contraste normal.
    const equivalent = screen.getByRole('table', { name: /Mesma leitura em formato linear/ })
    expect(within(equivalent).getByText('5 de 7 dias com registro feitos')).toBeInTheDocument()
    expect(
      within(equivalent).getByText('75% do percentual médio da meta em 2 dias com registro'),
    ).toBeInTheDocument()
    expect(
      within(equivalent).getByText(
        'média 2,5 em 2 dias com registro · sem meta configurada no período',
      ),
    ).toBeInTheDocument()
    // Coluna "Dias com registro": o denominador nomeado da célula booleana.
    const boolRow = within(equivalent)
      .getAllByRole('row')
      .find((row) => row.textContent?.includes('5 de 7 dias com registro feitos'))
    expect(within(boolRow!).getAllByRole('cell')[1]).toHaveTextContent('7')
    expect(within(equivalent).getAllByText('Sem registro no período').length).toBe(3)
  })

  // `viewSeries` remapeia a série com `metaPercent`/`contributionFactor` contra
  // os fatores congelados. Antes, só os três `<option>` eram asseridos e o mock
  // de `/series/` devolvia `points: []` — as duas visões derivadas podiam
  // calcular a métrica ERRADA (ou nada) com tudo verde.
  it('visão "% da meta" reescreve a leitura como percentual da meta congelada', async () => {
    const user = userEvent.setup()
    mockApi({ historyRange: twoWeekHistory(), series: NUMERIC_SERIES })
    renderPage('/habits?tab=historico')
    await user.selectOptions(await screen.findByLabelText('Hábito'), 'h2')
    await user.selectOptions(screen.getByLabelText('Visão'), 'metaPercent')

    const table = await screen.findByRole('table', { name: /Tabela equivalente do gráfico/ })
    // 8/8 = 100%; 4/8 = 50% (peso e bônus NÃO entram no percentual da meta).
    expect(within(table).getByText('100 %')).toBeInTheDocument()
    expect(within(table).getByText('50 %')).toBeInTheDocument()
  })

  it('visão "contribuição" aplica a penalidade do bônus — leitura DIFERENTE da % da meta', async () => {
    const user = userEvent.setup()
    mockApi({ historyRange: twoWeekHistory(), series: NUMERIC_SERIES })
    renderPage('/habits?tab=historico')
    await user.selectOptions(await screen.findByLabelText('Hábito'), 'h2')
    await user.selectOptions(screen.getByLabelText('Visão'), 'contribution')

    const table = await screen.findByRole('table', { name: /Tabela equivalente do gráfico/ })
    // Na meta ⇒ 1 (ganha o bônus) = 100%. Abaixo ⇒ (4/8)×(1−0,20) = 40%,
    // e é justamente o 40 que separa esta visão da "% da meta" (50).
    expect(within(table).getByText('100 %')).toBeInTheDocument()
    expect(within(table).getByText('40 %')).toBeInTheDocument()
    expect(within(table).queryByText('50 %')).not.toBeInTheDocument()
  })

  it('o intervalo não avança para o futuro: "Próximo período ›" para no período mais recente', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage('/habits?tab=historico')
    const next = await screen.findByRole('button', { name: 'Próximo período ›' })
    expect(next).toBeDisabled()
    // A nota redundante saiu: o botão desabilitado é o contrato.
    expect(screen.queryByText('Este é o período mais recente.')).not.toBeInTheDocument()

    // Recuando um período, avançar volta a existir — e não passa de hoje.
    await user.click(screen.getByRole('button', { name: '‹ Período anterior' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Próximo período ›' })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Próximo período ›' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Próximo período ›' })).toBeDisabled(),
    )
    const requestedEnds = mockGet.mock.calls
      .filter(([url]: [string]) => String(url).startsWith('/api/habits/history/'))
      .map(([, config]: [string, { params?: { end?: string } }]) => config?.params?.end)
      .filter((value): value is string => value != null)
    expect(requestedEnds.length).toBeGreaterThan(0)
    for (const end of requestedEnds) expect(end <= TODAY).toBe(true)
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

  // DW-60 no COMPACT. A faixa compact é um branch SEPARADO da grade (lista por
  // dia, não tabela): sem um caso próprio, apagar o `DomainIcon` de lá deixa a
  // suíte inteira verde — verificado por mutação.
  it('DW-60: no compact o glifo aparece na linha do hábito, em tamanho `compact`', async () => {
    mockCompactFaixa()
    mockApi({
      historyRange: {
        ...history(),
        habits: [
          {
            id: 'h1',
            name: 'Alongamento',
            emoticon: null,
            iconKey: 'barbell',
            type: 'boolean',
            unit: '',
            group: 'g1',
          },
          {
            id: 'h2',
            name: 'Corrida',
            emoticon: null,
            iconKey: 'glifo-que-saiu',
            type: 'boolean',
            unit: '',
            group: 'g1',
          },
        ],
        days: [
          {
            date: addDays(TODAY, -1),
            dayType: 'weekday' as const,
            totalCompletion: 50,
            groups: [{ id: 'g1', name: 'Corpo', completion: 50 }],
            entries: [
              entry({ id: 'he1', habitId: 'h1', value: '1' }),
              entry({ id: 'he2', habitId: 'h2', name: 'Corrida', value: '1' }),
            ],
          },
        ],
      },
    })
    renderPage('/habits?tab=historico')
    await screen.findByText('Completude por dia')

    // A lista do compact é ANINHADA (um `li` por dia, com um `ul` de hábitos
    // dentro), então buscar por `li` que contenha o nome pegaria o do DIA — que
    // contém o glifo do outro hábito. Só as FOLHAS são linhas de hábito.
    const habitRow = (name: string) => {
      const rows = screen
        .getAllByRole('listitem')
        .filter((li) => li.querySelector('li') == null && li.textContent?.includes(name))
      expect(rows, name).toHaveLength(1)
      return rows[0]
    }

    // A linha do hábito COM chave: o glifo mora lá, medido pelo token COMPACT.
    // Sem a checagem do `style`, trocar `size="compact"` por `"default"`
    // passaria — o `svg` existiria do mesmo jeito.
    const comChave = await waitFor(() => {
      const svg = habitRow('Alongamento').querySelector('svg')
      expect(svg).not.toBeNull()
      return svg!
    })
    expect(comChave.getAttribute('style')).toContain('var(--ds-domain-icon-size-compact)')
    expect(comChave.getAttribute('style')).not.toContain('var(--ds-domain-icon-size-default)')

    // A linha do hábito com chave ÓRFÃ: nenhum glifo. A asserção vem DEPOIS de a
    // chave válida ter resolvido, então a janela de resolução já passou.
    expect(habitRow('Corrida').querySelector('svg')).toBeNull()
  })

  // PARIDADE com `HabitHistoryGrid.tsx:86-118`: o legado renderiva uma linha por
  // HÁBITO por dia. Recompor no compact não pode virar compressão — perder a
  // dimensão hábito é perda de informação, não de layout.
  it('compact mantém a leitura POR HÁBITO (recomposição, não compressão)', async () => {
    mockCompactFaixa()
    mockApi()
    renderPage('/habits?tab=historico')
    expect(await screen.findByText('Completude por dia')).toBeInTheDocument()
    // O nome do hábito e a leitura da sua linha aparecem no compact.
    const items = await screen.findAllByText(/Alongamento/)
    expect(items.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/feito|não feito|sem registro/).length).toBeGreaterThan(0)
  })
})
