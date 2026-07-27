import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import { createBujoTheme } from '../../theme'
import { futureBoard, mediaQueries } from '../../shared/design/tokens'
import { FutureBoardPage } from './FutureBoardPage'
import type { FutureLogHorizon, Task } from '../../features/bujo'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

const HORIZON: FutureLogHorizon = {
  anchorMonthFirst: '2026-07-01',
  horizon: [
    { monthFirst: '2026-08-01', taskCount: 3 },
    { monthFirst: '2026-09-01', taskCount: 1 },
    { monthFirst: '2026-10-01', taskCount: 0 },
    { monthFirst: '2026-11-01', taskCount: 0 },
    { monthFirst: '2026-12-01', taskCount: 2 },
    { monthFirst: '2027-01-01', taskCount: 0 },
    { monthFirst: '2027-02-01', taskCount: 0 },
    { monthFirst: '2027-03-01', taskCount: 1 },
  ],
  distant: [
    { monthFirst: '2027-06-01', taskCount: 2 },
    { monthFirst: '2028-01-01', taskCount: 4 },
  ],
}

const EMPTY_HORIZON: FutureLogHorizon = {
  anchorMonthFirst: '2026-07-01',
  horizon: HORIZON.horizon.map((month) => ({ ...month, taskCount: 0 })),
  distant: [],
}

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: `Tarefa ${overrides.id}`,
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    scheduledDate: null,
    ...overrides,
  } as Task
}

const AGOSTO_TASKS: Task[] = [
  task({ id: 'sem-dia', title: 'Consulta com a dentista' }),
  task({ id: 'dia-20', title: 'Aniversário da Maria', scheduledDate: '2026-08-20' }),
  task({ id: 'dia-14', title: 'Renovar passaporte', scheduledDate: '2026-08-14' }),
]

function mockRoutes({
  horizon = HORIZON,
  tasksByMonth = { '2026-08-01': AGOSTO_TASKS } as Record<string, Task[]>,
  annuals = [] as unknown[],
  horizonError = false,
  monthlyError = false,
}: {
  horizon?: FutureLogHorizon
  tasksByMonth?: Record<string, Task[]>
  annuals?: unknown[]
  horizonError?: boolean
  monthlyError?: boolean
} = {}) {
  mockGet.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
    if (url === '/api/bujo/future-log/horizon/') {
      return horizonError
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ data: horizon })
    }
    if (url === '/api/bujo/logs/monthly/') {
      if (monthlyError) return Promise.reject(new Error('boom'))
      const monthFirst = String(config?.params?.month_first ?? '')
      return Promise.resolve({
        data: { monthFirst, tasks: tasksByMonth[monthFirst] ?? [], closed: false, status: null },
      })
    }
    if (url === '/api/bujo/recurring-templates/') return Promise.resolve({ data: annuals })
    return Promise.reject(new Error(`unhandled GET ${url}`))
  })
}

function mockFaixa(faixa: 'wide' | 'medium' | 'tablet' | 'compact') {
  const wideUp: string = mediaQueries.wideUp
  const desktop: string = mediaQueries.desktop
  const tabletUp: string = mediaQueries.tabletUp
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        (faixa === 'wide' && [wideUp, desktop, tabletUp].includes(query)) ||
        (faixa === 'medium' && [desktop, tabletUp].includes(query)) ||
        (faixa === 'tablet' && query === tabletUp) ||
        false,
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

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter>
          <FutureBoardPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mockFaixa('wide')
  setOnline(true)
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  setOnline(true)
})

describe('FutureBoardPage — trilho + foco (AC1)', () => {
  it('renderiza um único <main aria-label="Futuro">', async () => {
    mockRoutes()
    renderPage()
    await waitFor(() => expect(screen.getByRole('main', { name: 'Futuro' })).toBeInTheDocument())
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('o trilho mostra os 8 meses do horizonte, INCLUSIVE os vazios', async () => {
    mockRoutes()
    renderPage()
    const trilho = await screen.findByRole('navigation', { name: 'Meses do horizonte' })
    expect(within(trilho).getAllByRole('listitem')).toHaveLength(8)
    expect(within(trilho).getByRole('button', { name: /Outubro de 2026/ })).toHaveTextContent('0 itens')
  })

  it('o mês em foco começa no PRIMEIRO mês do horizonte', async () => {
    mockRoutes()
    renderPage()
    const trilho = await screen.findByRole('navigation', { name: 'Meses do horizonte' })
    expect(within(trilho).getByRole('button', { name: /Agosto de 2026/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(await screen.findByRole('heading', { name: 'Agosto de 2026', level: 2 })).toBeInTheDocument()
  })

  it('o cabeçalho de foco deriva a contagem da PRÓPRIA lista carregada', async () => {
    mockRoutes()
    renderPage()
    // 3 itens no mês, 2 com dia e 1 sem — derivado das tasks, NÃO do taskCount
    // do trilho (que poderia divergir).
    expect(await screen.findByText('3 itens · 2 com dia · 1 sem dia')).toBeInTheDocument()
  })

  it('selecionar outra linha do trilho troca o foco sem o trilho encolher', async () => {
    mockRoutes({ tasksByMonth: { '2026-08-01': AGOSTO_TASKS, '2026-12-01': [task({ id: 'x' })] } })
    renderPage()
    const trilho = await screen.findByRole('navigation', { name: 'Meses do horizonte' })
    fireEvent.click(within(trilho).getByRole('button', { name: /Dezembro de 2026/ }))

    expect(await screen.findByRole('heading', { name: 'Dezembro de 2026', level: 2 })).toBeInTheDocument()
    expect(within(trilho).getAllByRole('listitem')).toHaveLength(8)
    expect(within(trilho).getByRole('button', { name: /Dezembro de 2026/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('itens datados vêm ordenados por dia e os sem dia DEPOIS deles (AC3)', async () => {
    mockRoutes()
    renderPage()
    const lista = await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })
    const titulos = within(lista)
      .getAllByTestId('task-row')
      .map((row) => row.getAttribute('data-task-id'))
    expect(titulos).toEqual(['dia-14', 'dia-20', 'sem-dia'])
  })

  it('data completa mostra (14) e data parcial mostra — ago, com rótulo acessível distinto', async () => {
    mockRoutes()
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })
    expect(screen.getByLabelText('Dia 14 de agosto')).toHaveTextContent('(14)')
    expect(screen.getByLabelText('Sem dia definido em agosto')).toHaveTextContent('— ago')
  })
})

describe('FutureBoardPage — "Ir para mês…" e meses distantes (AC1)', () => {
  it('lista os meses distantes com contagem e leva o foco a um deles', async () => {
    mockRoutes({ tasksByMonth: { '2026-08-01': AGOSTO_TASKS, '2028-01-01': [task({ id: 'd' })] } })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Ir para mês…' }))

    expect(await screen.findByRole('heading', { name: '2028' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Janeiro de 2028/ }))

    expect(await screen.findByRole('heading', { name: 'Janeiro de 2028', level: 2 })).toBeInTheDocument()
  })

  it('com o foco num mês DISTANTE, nenhuma linha do trilho fica selecionada e o trilho não cresce', async () => {
    mockRoutes({ tasksByMonth: { '2026-08-01': AGOSTO_TASKS, '2028-01-01': [] } })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Ir para mês…' }))
    fireEvent.click(await screen.findByRole('button', { name: /Janeiro de 2028/ }))
    await screen.findByRole('heading', { name: 'Janeiro de 2028', level: 2 })

    const trilho = screen.getByRole('navigation', { name: 'Meses do horizonte' })
    expect(within(trilho).getAllByRole('listitem')).toHaveLength(8)
    expect(within(trilho).queryByRole('button', { current: true })).not.toBeInTheDocument()

    // Voltar é selecionar qualquer linha do trilho.
    fireEvent.click(within(trilho).getByRole('button', { name: /Setembro de 2026/ }))
    expect(await screen.findByRole('heading', { name: 'Setembro de 2026', level: 2 })).toBeInTheDocument()
  })

  it('sem mês distante nenhum, o seletor mostra o estado vazio orientando à captura por data', async () => {
    mockRoutes({ horizon: { ...HORIZON, distant: [] } })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Ir para mês…' }))
    expect(await screen.findByText('Nada capturado além de Março de 2027.')).toBeInTheDocument()
    expect(
      screen.getByText('Use o campo de captura com uma data para registrar mais adiante.'),
    ).toBeInTheDocument()
  })
})

describe('FutureBoardPage — captura no header (AC3)', () => {
  it('o campo Mês nasce com o mês em FOCO e acompanha a troca de foco', async () => {
    mockRoutes()
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Mês')).toHaveValue('2026-08'))

    const trilho = screen.getByRole('navigation', { name: 'Meses do horizonte' })
    fireEvent.click(within(trilho).getByRole('button', { name: /Dezembro de 2026/ }))
    await waitFor(() => expect(screen.getByLabelText('Mês')).toHaveValue('2026-12'))
  })

  it('captura com dia posta scheduledDate no mês em foco', async () => {
    mockRoutes()
    mockPost.mockResolvedValue({ data: task({ id: 'novo' }) })
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Renovar passaporte' } })
    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/monthly/', {
        monthFirst: '2026-08-01',
        title: 'Renovar passaporte',
        scheduledDate: '2026-08-14',
      }),
    )
  })

  it('captura em mês ≤ âncora é REJEITADA no cliente, sem POST', async () => {
    mockRoutes()
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Passado' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-07' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este mês não pertence ao Futuro. Use o Mês ou a Semana para datas de agora.',
    )
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('FutureBoardPage — datear/mover no lugar (AC4)', () => {
  it('item SEM dia oferece "Definir dia" e confirma com o rótulo NOMEADO do ato', async () => {
    mockRoutes()
    mockPost.mockResolvedValue({ data: task({ id: 'sem-dia', status: 'postponed' }) })
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.click(screen.getByRole('button', { name: 'Definir dia de Consulta com a dentista' }))
    fireEvent.click(await screen.findByRole('gridcell', { name: '14' }))

    // Nunca um "Confirmar" genérico.
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Datar em 14 de agosto' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/sem-dia/migrate/', {
        destination: 'future',
        monthFirst: '2026-08-01',
        scheduledDate: '2026-08-14',
      }),
    )
  })

  it('"Manter sem dia definido" é a confirmação nomeada quando não há dia armado', async () => {
    mockRoutes()
    mockPost.mockResolvedValue({ data: task({ id: 'sem-dia', status: 'postponed' }) })
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.click(screen.getByRole('button', { name: 'Definir dia de Consulta com a dentista' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sem dia definido' }))
    fireEvent.click(screen.getByRole('button', { name: 'Manter sem dia definido' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/sem-dia/migrate/', {
        destination: 'future',
        monthFirst: '2026-08-01',
      }),
    )
  })

  it('a aba "Outro mês" retarga o destino e a confirmação vira "Mover para …"', async () => {
    mockRoutes()
    mockPost.mockResolvedValue({ data: task({ id: 'dia-20', status: 'postponed' }) })
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.click(screen.getByRole('button', { name: 'Mover Aniversário da Maria' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'Outro mês' }))
    // Os meses do trilho E os distantes, mesma origem de dados.
    expect(screen.getAllByRole('option')).toHaveLength(10)
    fireEvent.click(screen.getByRole('option', { name: 'Setembro de 2026' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Sem dia definido' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para setembro de 2026' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/dia-20/migrate/', {
        destination: 'future',
        monthFirst: '2026-09-01',
      }),
    )
  })

  it('TODO mês oferecido ao migrate é estritamente MAIOR que o mês corrente (invariante da AC2)', async () => {
    mockRoutes()
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.click(screen.getByRole('button', { name: 'Mover Aniversário da Maria' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'Outro mês' }))

    const meses = screen.getAllByRole('option').map((option) => option.textContent ?? '')
    expect(meses.length).toBeGreaterThan(0)
    // O âncora tem piso no mês corrente (AC2), e o horizonte começa em âncora+1:
    // nenhum caminho desta superfície monta `destination:'future'` com mês ≤
    // corrente, que é o 400 "Use 'month' para o mês corrente".
    expect(meses).not.toContain('Julho de 2026')
    expect(meses).not.toContain('Junho de 2026')
    expect(meses[0]).toBe('Agosto de 2026')
  })

  it('falha de escrita PRESERVA o seletor com o destino armado, mostra o motivo e permite nova tentativa', async () => {
    mockRoutes()
    mockPost.mockRejectedValueOnce(new Error('500'))
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.click(screen.getByRole('button', { name: 'Definir dia de Consulta com a dentista' }))
    fireEvent.click(await screen.findByRole('gridcell', { name: '14' }))
    fireEvent.click(screen.getByRole('button', { name: 'Datar em 14 de agosto' }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((el) => el.textContent?.includes('Não foi possível mover a tarefa'))).toBe(true)
    // Seletor aberto E destino ainda armado.
    expect(screen.getByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Datar em 14 de agosto' })).toBeInTheDocument()
  })

  it('origem "Adiada" com sucessor no MESMO mês tem seta ACIONÁVEL que navega ao sucessor', async () => {
    // É o frame C do mockup: depois de datar, origem readonly + sucessor
    // convivem no mesmo mês, e nenhuma das duas linhas some.
    mockRoutes({
      tasksByMonth: {
        '2026-08-01': [
          task({ id: 'origem', title: 'Consulta com a dentista', status: 'postponed', migratedToTask: 'sucessor' }),
          task({ id: 'sucessor', title: 'Consulta com a dentista', scheduledDate: '2026-08-14' }),
        ],
      },
    })
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })
    await act(async () => {
      await Promise.resolve()
    })

    const seta = screen.getByRole('button', { name: 'Adiada — ir para o sucessor' })
    expect(seta).toHaveAttribute('aria-disabled', 'false')

    await act(async () => {
      fireEvent.click(seta)
    })

    const linhas = screen.getAllByTestId('task-row')
    expect(linhas).toHaveLength(2) // nenhuma linha some
    const sucessor = linhas.find((row) => row.getAttribute('data-task-id') === 'sucessor')!
    expect(sucessor).toHaveStyle({ backgroundColor: 'var(--ds-info-soft)' })
    expect(sucessor).toHaveFocus()
  })
})

describe('FutureBoardPage — "Mover tarefa" do detalhe (AC5 — primeiro consumidor real de onMove)', () => {
  it('"Mover tarefa" fecha o detalhe e abre o seletor de destino armado no mês em foco', async () => {
    // O `onMove` do `TaskDetailCard` nasceu na 14.5 SEM handler no Weekly e no
    // Monthly Board (Questão aberta #6): esta superfície é a primeira que o fia
    // de verdade, então o botão existir não prova nada — o que prova é ele
    // abrir o seletor.
    mockRoutes()
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Renovar passaporte' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mover tarefa' }))

    const seletor = await screen.findByRole('dialog', { name: 'Escolher destino' })
    expect(within(seletor).getByRole('grid', { name: 'Dias de Agosto de 2026' })).toBeInTheDocument()
    // O detalhe deu lugar ao seletor — os dois não convivem.
    expect(screen.queryByRole('button', { name: 'Excluir tarefa' })).not.toBeInTheDocument()
  })

  it('mover pelo detalhe migra a MESMA tarefa que estava aberta', async () => {
    mockRoutes()
    mockPost.mockResolvedValue({ data: task({ id: 'dia-14', status: 'postponed' }) })
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Renovar passaporte' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mover tarefa' }))
    fireEvent.click(await screen.findByRole('gridcell', { name: '20' }))
    fireEvent.click(screen.getByRole('button', { name: 'Datar em 20 de agosto' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/dia-14/migrate/', {
        destination: 'future',
        monthFirst: '2026-08-01',
        scheduledDate: '2026-08-20',
      }),
    )
  })
})

describe('FutureBoardPage — concluir/cancelar NÃO existem (AC5)', () => {
  it('a linha não oferece o ciclo de status por clique', async () => {
    mockRoutes()
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })
    expect(screen.queryByRole('button', { name: 'Pendente' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pendente' }).length).toBeGreaterThan(0)
  })

  it('o detalhe omite "Cancelar tarefa" mas mantém Salvar/Mover/Excluir e a edição', async () => {
    mockRoutes()
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Renovar passaporte' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar tarefa' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mover tarefa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir tarefa' })).toBeInTheDocument()
  })
})

describe('FutureBoardPage — anuais pendentes (AC6)', () => {
  const ANUAIS = [
    { id: 'tpl-1', title: 'Check-up médico anual', recurrenceGroup: 'annual', active: true },
    { id: 'tpl-2', title: 'Backup fiscal do ano', recurrenceGroup: 'annual', active: true },
  ]

  it('a seção é uma region nomeada e o botão diz "Alocar"', async () => {
    mockRoutes({ annuals: ANUAIS })
    renderPage()
    const secao = await screen.findByRole('region', { name: 'Anuais pendentes de 2026' })
    expect(within(secao).getAllByRole('button', { name: 'Alocar' })).toHaveLength(2)
    expect(within(secao).getByText('Check-up médico anual')).toBeInTheDocument()
    // O dialog (título "Alocar" desde a 14.8) não está aberto ainda — só o
    // botão da seção existe neste ponto do teste.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"banner vazio = sem DOM": sem anual pendente, a seção não renderiza', async () => {
    mockRoutes({ annuals: [] })
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })
    expect(screen.queryByRole('region', { name: /Anuais pendentes/ })).not.toBeInTheDocument()
  })

  it('"Alocar" abre o RecurringPlacementDialog INTOCADO e coloca no mês DA DATA escolhida', async () => {
    // AC6: alocar numa data futura faz o item aparecer no mês correspondente —
    // o que exige que o `monthFirst` derive da DATA, não do mês em foco.
    mockRoutes({ annuals: ANUAIS })
    mockPost.mockResolvedValue({ data: task({ id: 'nova-instancia' }) })
    renderPage()
    const secao = await screen.findByRole('region', { name: 'Anuais pendentes de 2026' })

    const linhaCheckup = within(secao)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('Check-up médico anual'))!
    fireEvent.click(within(linhaCheckup).getByRole('button', { name: 'Alocar' }))

    // O TÍTULO do dialog é "Alocar" desde a 14.8 (reuso intocado do componente).
    // Escopado ao `dialog`: a seção por trás continua com botões "Alocar"
    // próprios (um por anual pendente), e `screen.findByText` sem escopo bate
    // em mais de um nó com o rename — ambíguo por construção, não regressão.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Alocar')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Data (opcional)'), { target: { value: '2026-12-09' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/recurring-templates/tpl-1/place/', {
        monthFirst: '2026-12-01',
        scheduledDate: '2026-12-09',
      }),
    )
  })

  it('IRMÃ de não-vacuidade: sem data, o placement cai no mês do ÂNCORA (mês corrente)', async () => {
    // É o comportamento do Future Log legado que o E2E `future-log-annual`
    // confere em "Este Mês" — o mês vem do ÂNCORA do servidor, nunca de
    // `new Date()` no cliente (Convenção #8).
    mockRoutes({ annuals: ANUAIS })
    mockPost.mockResolvedValue({ data: task({ id: 'nova-instancia' }) })
    renderPage()
    const secao = await screen.findByRole('region', { name: 'Anuais pendentes de 2026' })

    const linhaBackup = within(secao)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('Backup fiscal do ano'))!
    fireEvent.click(within(linhaBackup).getByRole('button', { name: 'Alocar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/recurring-templates/tpl-2/place/', {
        monthFirst: '2026-07-01',
        scheduledDate: undefined,
      }),
    )
  })

  it('consulta a elegibilidade pelo endpoint (não reimplementa no cliente)', async () => {
    mockRoutes({ annuals: ANUAIS })
    renderPage()
    await screen.findByRole('region', { name: 'Anuais pendentes de 2026' })
    expect(mockGet).toHaveBeenCalledWith('/api/bujo/recurring-templates/', {
      params: { active: true, recurrence_group: 'annual', unplaced_year: 2026 },
    })
  })
})

describe('FutureBoardPage — estados obrigatórios (AC7)', () => {
  it('initial loading preserva a geometria trilho + foco (não é o PlannerSkeleton)', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))
    const { container } = renderPage()
    expect(screen.getByRole('main', { name: 'Futuro' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando o futuro…')
    const esqueleto = container.querySelector('[aria-hidden="true"]')
    expect(esqueleto).toBeTruthy()
    // A geometria que a AC7 exige é a do trilho REAL: uma barra por mês do
    // horizonte, contadas a partir de `futureBoard.horizonMonths` (AC8 — o
    // esqueleto é o consumidor de produção desse token, já que o horizonte
    // carregado vem inteiro do servidor). O `+ 1` é a coluna de foco.
    expect(esqueleto?.firstElementChild?.children).toHaveLength(futureBoard.horizonMonths)
    expect(esqueleto?.children).toHaveLength(2)
  })

  it('local loading: trocar de mês afeta SÓ a coluna de foco — o trilho não some', async () => {
    // O estado `local loading` da AC7 é o que distingue esta superfície de uma
    // que recarrega inteira a cada troca de mês: enquanto o mês novo carrega, o
    // trilho continua no DOM, com as 8 linhas e o `aria-current` já no destino.
    let liberarDezembro: (value: unknown) => void = () => {}
    mockGet.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/api/bujo/future-log/horizon/') return Promise.resolve({ data: HORIZON })
      if (url === '/api/bujo/recurring-templates/') return Promise.resolve({ data: [] })
      if (url === '/api/bujo/logs/monthly/') {
        const monthFirst = String(config?.params?.month_first ?? '')
        if (monthFirst === '2026-12-01') {
          return new Promise((resolve) => {
            liberarDezembro = () =>
              resolve({ data: { monthFirst, tasks: [task({ id: 'dez' })], closed: false, status: null } })
          })
        }
        return Promise.resolve({
          data: { monthFirst, tasks: AGOSTO_TASKS, closed: false, status: null },
        })
      }
      return Promise.reject(new Error(`unhandled GET ${url}`))
    })
    renderPage()
    const trilho = await screen.findByRole('navigation', { name: 'Meses do horizonte' })
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    fireEvent.click(within(trilho).getByRole('button', { name: /Dezembro de 2026/ }))

    // Em carregamento LOCAL: só a coluna de foco está em espera.
    expect(await screen.findByText('Carregando o mês…')).toBeInTheDocument()
    expect(within(trilho).getAllByRole('listitem')).toHaveLength(8)
    expect(within(trilho).getByRole('button', { name: /Dezembro de 2026/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    // E não é o skeleton INICIAL (aquele substitui a superfície inteira).
    expect(screen.queryByText('Carregando o futuro…')).not.toBeInTheDocument()

    await act(async () => {
      liberarDezembro(undefined)
    })
    expect(await screen.findByRole('list', { name: 'Itens de Dezembro de 2026' })).toBeInTheDocument()
  })

  it('empty GLOBAL convida a capturar E mantém os 8 meses visíveis no trilho', async () => {
    mockRoutes({ horizon: EMPTY_HORIZON, tasksByMonth: {} })
    renderPage()
    expect(await screen.findByText('Nada no futuro ainda')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Capture algo que ainda não tem data certa e ele espera aqui até você decidir o dia.',
      ),
    ).toBeInTheDocument()
    const trilho = screen.getByRole('navigation', { name: 'Meses do horizonte' })
    expect(within(trilho).getAllByRole('listitem')).toHaveLength(8)
  })

  it('IRMÃ de não-vacuidade: com item no horizonte o vazio global NÃO aparece', async () => {
    mockRoutes()
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })
    expect(screen.queryByText('Nada no futuro ainda')).not.toBeInTheDocument()
  })

  it('empty do mês em foco não é o vazio global', async () => {
    mockRoutes({ tasksByMonth: {} })
    renderPage()
    expect(await screen.findByText(/Nada capturado em agosto de 2026 ainda/)).toBeInTheDocument()
    expect(screen.queryByText('Nada no futuro ainda')).not.toBeInTheDocument()
  })

  it('read error do trilho mostra a cópia do mockup e oferece "Tentar de novo"', async () => {
    mockRoutes({ horizonError: true })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os itens do futuro.',
    )
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('read error LOCAL preserva o trilho e o mês em foco', async () => {
    mockRoutes({ monthlyError: true })
    renderPage()
    await screen.findByRole('navigation', { name: 'Meses do horizonte' })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os itens do futuro.',
    )
    // O trilho NÃO some e o mês em foco continua o mesmo.
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByRole('heading', { name: 'Agosto de 2026', level: 2 })).toBeInTheDocument()
  })

  it('offline: capturar, datar e mover ficam indisponíveis COM MOTIVO, sem fila local', async () => {
    setOnline(false)
    mockRoutes()
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled()
    expect(
      screen.getByText(
        'Você está offline. Consulta disponível; capturar, datar e mover ficam indisponíveis até reconectar.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Definir dia de Consulta com a dentista' })).toBeDisabled()
    // Consulta continua disponível (o trilho e a lista seguem renderizados).
    expect(screen.getByRole('navigation', { name: 'Meses do horizonte' })).toBeInTheDocument()
  })

  it('IRMÃ de não-vacuidade: online, os mesmos controles estão habilitados', async () => {
    mockRoutes()
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Definir dia de Consulta com a dentista' })).toBeEnabled()
  })
})

describe('FutureBoardPage — compact (AC1/AC7)', () => {
  it('o trilho vira barra de meses rolável e o foco ocupa a largura toda', async () => {
    mockFaixa('compact')
    mockRoutes()
    renderPage()
    const trilho = await screen.findByRole('navigation', { name: 'Meses do horizonte' })
    expect(within(trilho).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(trilho).getByRole('button', { name: 'Agosto de 2026, 3 itens' })).toBeInTheDocument()
    expect(within(trilho).getByRole('button', { name: 'Novembro de 2026, 0 itens' })).toBeInTheDocument()
  })

  it('"Ir para mês…" abre em SHEET nomeado e devolve o foco ao acionador ao fechar sem navegar (AC7)', async () => {
    mockFaixa('compact')
    mockRoutes()
    renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })

    const acionador = screen.getByRole('button', { name: 'Ir para mês…' })
    acionador.focus()
    fireEvent.click(acionador)

    // O sheet é um overlay COM papel e nome (piso de acessibilidade da AC7).
    const sheet = await screen.findByRole('dialog', { name: 'Ir para mês' })
    expect(within(sheet).getByRole('button', { name: /Junho de 2027/ })).toBeInTheDocument()

    fireEvent.keyDown(sheet, { key: 'Escape' })

    // Fechar SEM navegar devolve o foco a quem abriu — e o mês em foco não muda.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ir para mês' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Ir para mês…' })).toHaveFocus()
    expect(screen.getByRole('heading', { name: 'Agosto de 2026', level: 2 })).toBeInTheDocument()
  })

  it('não tem violações de axe em compact', async () => {
    mockFaixa('compact')
    mockRoutes()
    const { container } = renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('FutureBoardPage — acessibilidade (AC7)', () => {
  it('não tem violações de axe em wide', async () => {
    mockRoutes({ annuals: [{ id: 'tpl-1', title: 'Check-up médico anual', recurrenceGroup: 'annual', active: true }] })
    const { container } = renderPage()
    await screen.findByRole('list', { name: 'Itens de Agosto de 2026' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('a coluna de foco tem heading próprio nomeando o mês', async () => {
    mockRoutes()
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Agosto de 2026', level: 2 })).toBeInTheDocument()
  })
})

describe('FutureBoardPage — anuais pendentes: cada linha tem contorno próprio (regressão E2E)', () => {
  it('cada anual é um listitem, distinguindo dois botões "Alocar" idênticos', async () => {
    mockRoutes({
      annuals: [
        { id: 'tpl-1', title: 'Revisão anual', recurrenceGroup: 'annual', active: true },
        { id: 'tpl-2', title: 'Balanço anual', recurrenceGroup: 'annual', active: true },
      ],
    })
    renderPage()
    const secao = await screen.findByRole('region', { name: 'Anuais pendentes de 2026' })

    const linhas = within(secao).getAllByRole('listitem')
    expect(linhas).toHaveLength(2)
    // Sem o contorno por linha, "o botão Alocar DA Revisão anual" seria
    // inexprimível — dois botões com o mesmo nome acessível (achado real do E2E,
    // onde `locator('div')` casava a linha E o próprio título).
    const linhaRevisao = linhas.find((li) => li.textContent?.includes('Revisão anual'))!
    expect(within(linhaRevisao).getByRole('button', { name: 'Alocar' })).toBeInTheDocument()
    expect(within(linhaRevisao).queryByText('Balanço anual')).not.toBeInTheDocument()
  })
})
