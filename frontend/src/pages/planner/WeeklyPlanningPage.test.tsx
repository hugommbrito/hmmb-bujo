import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import { createBujoTheme } from '../../theme'
import { WeeklyPlanningPage } from './WeeklyPlanningPage'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

// `vi.resetAllMocks()` (usado em cada `beforeEach`) limpa a implementação do
// `window.matchMedia` global de `test-setup.ts` — sem isso, `useMediaQuery`
// (faixa compact do seletor de destino) recebe `undefined` e quebra o mount.
function mockMatchMediaDefault() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
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

const READINESS_WITH_TARGET = {
  active: null,
  planning: { weekStart: '2026-07-27', status: 'planning', planningCompletedAt: null },
  start: null,
  finalize: null,
}

const EMPTY_TASK_SOURCE = {
  sourceId: 'monthly-in-week',
  blocking: false,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
}

const EMPTY_RECURRING_SOURCE = {
  sourceId: 'recurring',
  blocking: false,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
  alreadyPlaced: { countsTowardProgress: false, items: [] },
}

const EMPTY_BLOCKING_SOURCE = {
  sourceId: 'previous-weekly',
  blocking: true,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  items: [],
  readyToFinalize: false,
  previousPeriodStart: null,
}

const EMPTY_PENDING_DAILIES = {
  sourceId: 'pending-dailies',
  blocking: false,
  countsTowardProgress: true,
  eligibleCount: 0,
  pendingDecisionCount: 0,
  reviewed: true,
  groups: [],
}

const EMPTY_DENSITY = {
  days: [],
  undated: { total: 0, byStatus: { pending: 0, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 } },
  total: 0,
}

function mockRoutes({
  readiness = READINESS_WITH_TARGET,
  monthlyInWeek = EMPTY_TASK_SOURCE,
  recurring = EMPTY_RECURRING_SOURCE,
  previousWeekly = EMPTY_BLOCKING_SOURCE,
  pendingDailies = EMPTY_PENDING_DAILIES,
  previousWeeklyStatus = 200,
  weeklyDensity = EMPTY_DENSITY,
}: {
  readiness?: unknown
  monthlyInWeek?: unknown
  recurring?: unknown
  previousWeekly?: unknown
  pendingDailies?: unknown
  previousWeeklyStatus?: number
  weeklyDensity?: unknown
} = {}) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/bujo/logs/weekly/cycle/') return Promise.resolve({ data: readiness })
    if (url === '/api/bujo/logs/weekly/') {
      // Referência de "semana corrente" (Convenção #8) — deliberadamente
      // DIFERENTE do alvo do ritual, para o caso comum (planejar a PRÓXIMA
      // semana) não ser confundido com "planejando a semana corrente".
      return Promise.resolve({
        data: {
          weekStart: '2026-07-20',
          days: Array.from({ length: 7 }, (_, i) => ({ date: `2026-07-${20 + i}`, tasks: [] })),
          unscheduled: [],
          closed: false,
          status: 'active',
          planningCompletedAt: null,
        },
      })
    }
    if (url === '/api/bujo/rituals/weekly/sources/monthly-in-week/') return Promise.resolve({ data: monthlyInWeek })
    if (url === '/api/bujo/rituals/weekly/sources/recurring/') return Promise.resolve({ data: recurring })
    if (url === '/api/bujo/rituals/weekly/sources/previous-weekly/') {
      return previousWeeklyStatus === 200
        ? Promise.resolve({ data: previousWeekly })
        : Promise.reject(new Error('falha ao consultar previous-weekly'))
    }
    if (url === '/api/bujo/rituals/weekly/sources/pending-dailies/') return Promise.resolve({ data: pendingDailies })
    if (url === '/api/bujo/logs/monthly/') return Promise.resolve({ data: { monthFirst: '2026-07-01', tasks: [], closed: false, status: null, planningCompletedAt: null } })
    // Densidade real por dia: alimenta TANTO o rail de contexto QUANTO os
    // contadores dos dias no seletor de destino (mesma chave, dedup do Query).
    if (url === '/api/bujo/rituals/weekly/density/') return Promise.resolve({ data: weeklyDensity })
    return Promise.reject(new Error(`unhandled GET ${url}`))
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter>
          <WeeklyPlanningPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('WeeklyPlanningPage — três regiões (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('renderiza main, nav de fontes e a lista de decisões da fonte ativa', async () => {
    mockRoutes()
    renderPage()

    expect(await screen.findByRole('navigation', { name: 'Fontes do planejamento' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Planejar a semana' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Decisões — Monthly na semana' })).toBeInTheDocument()
  })

  it('sem alvo de planejamento, mostra mensagem em vez da lista', async () => {
    mockRoutes({ readiness: { active: null, planning: null, start: null, finalize: null } })
    renderPage()
    expect(await screen.findByText('Nenhuma semana em planejamento no momento.')).toBeInTheDocument()
  })

  it('trocar de fonte no rail muda a fonte exibida na lista', async () => {
    mockRoutes()
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento' })

    fireEvent.click(screen.getByRole('button', { name: /Recorrentes/ }))

    expect(await screen.findByRole('region', { name: 'Decisões — Recorrentes' })).toBeInTheDocument()
  })

  it('jest-axe: sem violações', async () => {
    mockRoutes()
    const { container } = renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento' })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('WeeklyPlanningPage — fontes independentes (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('uma fonte em erro (previous-weekly) NÃO bloqueia as outras', async () => {
    mockRoutes({ previousWeeklyStatus: 500 })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento' })

    // monthly-in-week (a fonte ativa por padrão) segue operável.
    expect(screen.getByRole('region', { name: 'Decisões — Monthly na semana' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // Trocar para a fonte com erro mostra a mensagem local, sem afetar as demais.
    fireEvent.click(screen.getByRole('button', { name: /Weekly anterior/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Recorrentes/ }))
    expect(screen.getByRole('region', { name: 'Decisões — Recorrentes' })).toBeInTheDocument()
  })

  it('pending-dailies usa groups (não uma fonte quebrada por assumir items)', async () => {
    mockRoutes({
      pendingDailies: {
        ...EMPTY_PENDING_DAILIES,
        groups: [{ date: '2026-07-10', items: [{ task: { id: 't-1', title: 'Tarefa antiga', status: 'pending', eisenhower: null, category: null, subtasks: [] }, decision: null }] }],
      },
    })
    renderPage()
    await screen.findByRole('navigation', { name: 'Fontes do planejamento' })

    const nav = screen.getByRole('navigation', { name: 'Fontes do planejamento' })
    fireEvent.click(within(nav).getByRole('button', { name: /Daily pendentes/ }))
    expect(await screen.findByText('Tarefa antiga')).toBeInTheDocument()
  })
})

describe('WeeklyPlanningPage — seletor de destino (AC5, Task 9)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('"Escolher destino…" abre o seletor; confirmar migra e fecha', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: {
              id: 't-1',
              title: 'Rever contrato',
              status: 'pending',
              eisenhower: null,
              category: null,
              subtasks: [],
              scheduledDate: '2026-07-29',
            },
            decision: null,
          },
        ],
      },
    })
    mockPost.mockResolvedValueOnce({ data: { id: 't-1', title: 'Rever contrato', status: 'migrated', eisenhower: null, category: null, subtasks: [] } })
    renderPage()
    await screen.findByText('Rever contrato')

    // Capturado ANTES de abrir: com o modal aberto a subárvore da página fica
    // `aria-hidden`, e uma consulta por role não a encontraria mais.
    const main = screen.getByRole('main', { name: 'Planejar a semana' })

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })

    // O DEFEITO corrigido: antes, no desktop, não havia `Dialog` nenhum e o
    // seletor entrava no fluxo do DOM depois da grade de 3 colunas do ritual —
    // abria abaixo da dobra. A prova é estrutural: ele é PORTALIZADO para fora
    // do `main`, dentro da raiz de modal (overlay + posição fixa) do MUI.
    expect(main).not.toContainElement(dialog)
    expect(dialog.closest('.MuiDialog-root')).not.toBeNull()

    // A semana-alvo é 2026-07-27 (segunda) ⇒ quarta = 29/07.
    fireEvent.click(within(dialog).getByRole('radio', { name: '3 Quarta, 29 jul.' }))
    fireEvent.keyDown(within(dialog).getByRole('radiogroup', { name: /^Dias de/ }), { key: 'Enter' })

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'week',
        scheduledDate: '2026-07-29',
      }),
    )
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Escolher destino' })).not.toBeInTheDocument()
  })

  // Story 14.5 AC5 — os dígitos existem e chegam ao usuário PELA PÁGINA do
  // ritual, não só pelo componente isolado (achado de review: o teste do
  // componente antigo guarda um arquivo sem importador de produção).
  it('atalhos 1–7 escolhem o dia e Enter confirma, pela página do ritual (AC5)', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-29' },
            decision: null,
          },
        ],
      },
    })
    mockPost.mockResolvedValueOnce({ data: { id: 't-1', title: 'Rever contrato', status: 'migrated', eisenhower: null, category: null, subtasks: [] } })
    renderPage()
    await screen.findByText('Rever contrato')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })

    // Lembrete VISÍVEL dos atalhos (também restaurado).
    expect(
      within(dialog).getByText('Atalhos: 1–7 escolhem o dia · 0 deixa sem data · Enter confirma.'),
    ).toBeInTheDocument()

    const group = within(dialog).getByRole('radiogroup', { name: /^Dias de/ })
    fireEvent.keyDown(group, { key: '3' }) // quarta da semana-alvo = 29/07
    expect(within(dialog).getByRole('button', { name: 'Migrar para quarta, 29 jul.' })).toBeInTheDocument()

    fireEvent.keyDown(group, { key: 'Enter' })

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'week',
        scheduledDate: '2026-07-29',
      }),
    )
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  // Story 14.5 AC6 — "selecionar um dia escolhe destino para a decisão corrente".
  // Com o seletor aberto o rail fica `aria-hidden` atrás do backdrop, então o
  // caminho do rail arma o dia ANTES: o seletor abre com ele já armado, a um
  // clique da confirmação nomeada — em vez de virar código morto.
  it('clicar num dia do rail de densidade arma o destino da decisão corrente (AC6)', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-29' },
            decision: null,
          },
        ],
      },
      weeklyDensity: {
        ...EMPTY_DENSITY,
        total: 1,
        days: [
          { date: '2026-07-28', total: 1, byStatus: { pending: 1, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 } },
        ],
      },
    })
    mockPost.mockResolvedValueOnce({ data: { id: 't-1', title: 'Rever contrato', status: 'migrated', eisenhower: null, category: null, subtasks: [] } })
    renderPage()
    await screen.findByText('Rever contrato')

    const densityRail = await screen.findByRole('group', { name: 'Densidade por dia' })
    fireEvent.click(within(densityRail).getByRole('button', { name: 'Terça: 1 registros' }))

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })

    // Já ARMADO no dia escolhido no rail — a confirmação nomeada está pronta.
    expect(within(dialog).getByRole('radio', { name: /^2 Terça, 28 jul\./ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Migrar para terça, 28 jul.' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'week',
        scheduledDate: '2026-07-28',
      }),
    )
  })

  // Achado de review: sem gate de escrita EM CURSO, dois cliques rápidos em
  // confirmar viram dois POST de migração da MESMA tarefa — alcançável só com o
  // mouse, sem nenhum atalho de teclado envolvido.
  it('durante a escrita em curso o seletor fica bloqueado — nada de duplicar a migração', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-29' },
            decision: null,
          },
        ],
      },
    })
    // Nunca resolve: mantém a mutação PENDENTE durante todo o teste.
    mockPost.mockImplementation(() => new Promise(() => {}))
    renderPage()
    await screen.findByText('Rever contrato')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })
    fireEvent.click(within(dialog).getByRole('radio', { name: '3 Quarta, 29 jul.' }))

    const confirmButton = within(dialog).getByRole('button', { name: 'Migrar para quarta, 29 jul.' })
    fireEvent.click(confirmButton)

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Migrar para quarta, 29 jul.' })).toBeDisabled(),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Migrar para quarta, 29 jul.' }))
    fireEvent.keyDown(within(dialog).getByRole('radiogroup', { name: /^Dias de/ }), { key: 'Enter' })

    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('o ato de confirmação é NOMEADO pelo dia escolhido, nunca um "Confirmar" genérico', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-29' },
            decision: null,
          },
        ],
      },
    })
    mockPost.mockResolvedValueOnce({ data: { id: 't-1', title: 'Rever contrato', status: 'migrated', eisenhower: null, category: null, subtasks: [] } })
    renderPage()
    await screen.findByText('Rever contrato')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })

    expect(within(dialog).queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('radio', { name: '2 Terça, 28 jul.' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Migrar para terça, 28 jul.' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/tasks/t-1/migrate/', {
        destination: 'week',
        scheduledDate: '2026-07-28',
      }),
    )
  })

  // REGRA DE DOMÍNIO (lacuna B7 da Story 14.5), preservada na troca de seletor:
  // `migrate` com `destination: 'week'` sem `scheduledDate` cai na semana
  // CORRENTE no servidor, não na semana-alvo — nunca mandar em silêncio para a
  // semana errada. A semana corrente mockada (2026-07-20) ≠ alvo (2026-07-27).
  it('semana-alvo ≠ corrente: "Sem dia definido" fica indisponível COM MOTIVO e não migra', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-29' },
            decision: null,
          },
        ],
      },
    })
    renderPage()
    await screen.findByText('Rever contrato')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })

    const undated = within(dialog).getByRole('button', {
      name: '0 Sem dia definido — indisponível: a semana-alvo não é a semana corrente',
    })
    expect(undated).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(undated)
    expect(within(dialog).queryByRole('button', { name: /^Migrar/ })).not.toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('a densidade real por dia aparece no nome acessível de cada dia ofertado', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-29' },
            decision: null,
          },
        ],
      },
      weeklyDensity: {
        ...EMPTY_DENSITY,
        total: 2,
        days: [
          { date: '2026-07-27', total: 2, byStatus: { pending: 2, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 } },
          { date: '2026-07-28', total: 1, byStatus: { pending: 1, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 } },
        ],
      },
    })
    renderPage()
    await screen.findByText('Rever contrato')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })

    expect(await within(dialog).findByRole('radio', { name: '1 Segunda, 27 jul., 2 registros' })).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: '2 Terça, 28 jul., 1 registro' })).toBeInTheDocument()
  })
})

describe('WeeklyPlanningPage — falha de decisão preserva item e oferece retry (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('Concluir falhando mostra o motivo + Tentar novamente; retry repete a MESMA ação', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-27' },
            decision: null,
          },
        ],
      },
    })
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))
    mockPost.mockResolvedValueOnce({ data: { id: 't-1', title: 'Rever contrato', status: 'completed', eisenhower: null, category: null, subtasks: [] } })
    renderPage()
    await screen.findByText('Rever contrato')

    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar a decisão'))
    // O item continua na lista — falha não some com ele.
    expect(screen.getByText('Rever contrato')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenLastCalledWith('/api/bujo/tasks/t-1/transition/', { toStatus: 'completed' }),
    )
    expect(mockPost).toHaveBeenCalledTimes(2)
  })
})

describe('WeeklyPlanningPage — falha na confirmação de destino preserva o seletor aberto (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('POST de migrate falhando NÃO fecha o seletor e mostra o motivo', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-29' },
            decision: null,
          },
        ],
      },
    })
    mockPost.mockRejectedValueOnce(new Error('falha de rede'))
    renderPage()
    await screen.findByText('Rever contrato')

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Escolher destino' })

    fireEvent.click(within(dialog).getByRole('radio', { name: '3 Quarta, 29 jul.' }))
    fireEvent.keyDown(within(dialog).getByRole('radiogroup', { name: /^Dias de/ }), { key: 'Enter' })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível migrar a tarefa'))
    // O seletor continua aberto E ARMADO — falha preserva item/foco (AC5), então
    // "tentar novamente" é reconfirmar o mesmo ato já nomeado.
    expect(screen.getByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Migrar para quarta, 29 jul.' })).toBeInTheDocument()
  })
})

describe('WeeklyPlanningPage — offline (AC7)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMatchMediaDefault()
  })

  it('sem rede: aviso persistente role=status e decisões indisponíveis', async () => {
    mockRoutes({
      monthlyInWeek: {
        ...EMPTY_TASK_SOURCE,
        items: [
          {
            task: { id: 't-1', title: 'Rever contrato', status: 'pending', eisenhower: null, category: null, subtasks: [], scheduledDate: '2026-07-27' },
            decision: null,
          },
        ],
      },
    })
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    renderPage()
    await screen.findByText('Rever contrato')

    expect(screen.getByRole('status')).toHaveTextContent('Sem conexão')
    expect(screen.getByRole('button', { name: 'Concluir' })).toHaveAttribute('aria-disabled', 'true')

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })
})
