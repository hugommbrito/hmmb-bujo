import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, Routes, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let monthlyLogResult: { isPending: boolean; isError: boolean; data?: unknown; refetch: () => void }
const mockNavigate = vi.fn()

vi.mock('../../features/bujo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/bujo')>()
  return {
    ...actual,
    useMonthlyLogQuery: () => monthlyLogResult,
  }
})

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../api/client'
import { createBujoTheme } from '../../theme'
import { ArchiveMonthlyDetailPage } from './ArchiveMonthlyDetailPage'

const mockPost = client.post as ReturnType<typeof vi.fn>

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Tarefa',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    migrationTarget: null,
    ...overrides,
  }
}

function monthlyLog(overrides: Record<string, unknown> = {}) {
  return {
    monthFirst: '2026-06-01',
    tasks: [],
    closed: false,
    status: null,
    ...overrides,
  }
}

function queryResult(overrides: Partial<NonNullable<typeof monthlyLogResult>> = {}) {
  return { isPending: false, isError: false, data: undefined, refetch: vi.fn(), ...overrides }
}

function renderPage(initialEntry = '/archive/monthly/2026-06-01', state?: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter
          initialEntries={[{ pathname: '/archive/monthly/2026-06-01', search: '', state, key: initialEntry }]}
        >
          <Routes>
            <Route path="/archive/monthly/:monthFirst" element={<ArchiveMonthlyDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  monthlyLogResult = queryResult({ data: undefined })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ArchiveMonthlyDetailPage (Story 14.10)', () => {
  it('loading: mostra o esqueleto', () => {
    monthlyLogResult = queryResult({ isPending: true, data: undefined })
    renderPage()
    expect(screen.getByRole('main', { name: 'Arquivo — Mês' })).toBeInTheDocument()
  })

  it('erro de leitura (online): mensagem genérica com retry', () => {
    const refetch = vi.fn()
    monthlyLogResult = queryResult({ isError: true, data: undefined, refetch })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('erro de leitura offline: "não disponível offline", sem retry inútil', () => {
    const onLineSpy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    monthlyLogResult = queryResult({ isError: true, data: undefined })
    renderPage()

    expect(screen.getByText('Este mês não está disponível offline.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
    onLineSpy.mockRestore()
  })

  it('mês fechado: "Fechado"/"Somente leitura", sem forms de mutação', () => {
    monthlyLogResult = queryResult({
      data: monthlyLog({ closed: true, tasks: [task({ title: 'Concluída', status: 'completed', scheduledDate: '2026-06-03' })] }),
    })
    renderPage()

    expect(screen.getByText('Fechado')).toBeInTheDocument()
    expect(screen.getByText('Somente leitura')).toBeInTheDocument()
    expect(screen.queryByLabelText('Adicionar tarefa ao mês')).not.toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
  })

  it('mês NÃO fechado (alcançado via linhagem): renderiza mutável, com form de criação com min/max do mês exibido', () => {
    monthlyLogResult = queryResult({ data: monthlyLog({ closed: false, status: 'active' }) })
    renderPage()

    expect(screen.queryByText('Fechado')).not.toBeInTheDocument()
    const dayField = screen.getByLabelText('Dia (opcional)')
    expect(dayField).toHaveAttribute('min', '2026-06-01')
    expect(dayField).toHaveAttribute('max', '2026-06-30')
  })

  it('form de criação: cria tarefa com título e dia, guarda título vazio, refetch ao concluir', async () => {
    const refetch = vi.fn()
    monthlyLogResult = queryResult({ data: monthlyLog({ closed: false }), refetch })
    mockPost.mockResolvedValue({ data: task({ id: 'nova' }) })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(mockPost).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Título'), 'Nova tarefa')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/bujo/logs/monthly/', expect.objectContaining({ title: 'Nova tarefa' })),
    )
    await waitFor(() => expect(refetch).toHaveBeenCalled())
  })

  it('form de criação: dia fora do mês exibido é rejeitado (min/max não é confiável em todo caminho de submissão)', async () => {
    monthlyLogResult = queryResult({ data: monthlyLog({ closed: false }) })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Título'), 'Nova tarefa')
    // Preenche o campo de data diretamente com um valor fora do mês exibido
    // (2026-06) — simula um caminho que o `min`/`max` do input não bloqueia.
    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '2026-07-01' } })
    // `fireEvent.submit` direto no `<form>` (não `user.click` no botão):
    // clicar um `<button type="submit">` com um campo `min`/`max` fora do
    // range aciona a VALIDAÇÃO NATIVA do navegador/jsdom ANTES do evento
    // `submit` — isso mascararia o guard novo (testaria a validação nativa do
    // browser, não o código do handler). Disparar `submit` no form direto
    // prova o guard em JS por si só, defesa em profundidade independente da
    // validação nativa (a mesma razão pela qual o guard existe).
    fireEvent.submit(screen.getByRole('form', { name: 'Adicionar tarefa ao mês' }))

    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('O dia deve pertencer ao mês exibido.')
  })

  it('agrupa por scheduledDate e mantém "Sem dia definido" para tarefas sem data', () => {
    monthlyLogResult = queryResult({
      data: monthlyLog({
        tasks: [
          task({ id: 't1', title: 'Com data', scheduledDate: '2026-06-03' }),
          task({ id: 't2', title: 'Sem data' }),
        ],
      }),
    })
    renderPage()

    expect(screen.getByText('Com data')).toBeInTheDocument()
    expect(screen.getByText('Sem data')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sem dia definido' })).toBeInTheDocument()
  })

  it('detalhe da tarefa mostra predecessor quando o predecessor é uma SUBTAREFA (Story 14.10, review)', async () => {
    const origemSub = task({
      id: 'origem-sub',
      title: 'Origem sub',
      status: 'migrated',
      migratedToTask: 'sucessor',
    })
    const origemPai = task({ id: 'origem-pai', title: 'Pai', scheduledDate: '2026-06-05', subtasks: [origemSub] })
    const sucessor = task({ id: 'sucessor', title: 'Sucessor', scheduledDate: '2026-06-10' })
    monthlyLogResult = queryResult({ data: monthlyLog({ tasks: [origemPai, sucessor] }) })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Ver detalhes de Sucessor/i }))
    expect(screen.getByText(/Veio de/)).toBeInTheDocument()
  })

  it('linhagem cross-período: sucessor fora do DOM navega para a rota do destino e grava retorno', async () => {
    const origem = task({
      id: 'origem',
      title: 'Origem',
      status: 'postponed',
      migratedToTask: 'sucessor',
      migrationTarget: { type: 'daily', logDate: '2026-08-05' },
    })
    monthlyLogResult = queryResult({ data: monthlyLog({ tasks: [origem] }) })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /ir para o sucessor/i }))

    expect(mockNavigate).toHaveBeenCalledWith(
      '/daily/2026-08-05',
      expect.objectContaining({ state: expect.objectContaining({ focusTaskId: 'sucessor' }) }),
    )
    expect(sessionStorage.getItem('bujo:archive-lineage-return-task-id')).toBe('origem')
  })

  it('linhagem cross-período com migrationTarget sem chave utilizável: mostra erro visível, não navega, não grava retorno (achado da review)', async () => {
    const origem = task({
      id: 'origem',
      title: 'Origem',
      status: 'postponed',
      migratedToTask: 'sucessor',
      migrationTarget: { type: 'daily' },
    })
    monthlyLogResult = queryResult({ data: monthlyLog({ tasks: [origem] }) })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /ir para o sucessor/i }))

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('bujo:archive-lineage-return-task-id')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível abrir o período de destino desta linhagem.',
    )
  })

  it('retorno cuja linha de origem não existe mais: a entrada de sessionStorage é limpa mesmo assim (não vaza)', async () => {
    sessionStorage.setItem('bujo:archive-lineage-return-task-id', 'tarefa-que-sumiu')
    monthlyLogResult = queryResult({ data: monthlyLog({ tasks: [task({ title: 'Outra tarefa' })] }) })
    renderPage()

    await waitFor(() =>
      expect(sessionStorage.getItem('bujo:archive-lineage-return-task-id')).toBeNull(),
    )
  })

  it('chegada por linhagem (location.state.focusTaskId) foca a linha sucessora', async () => {
    monthlyLogResult = queryResult({
      data: monthlyLog({ tasks: [task({ id: 'sucessor', title: 'Sucessor aqui' })] }),
    })
    renderPage('/archive/monthly/2026-06-01', { focusTaskId: 'sucessor' })

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled())
    // Foco vai para o primeiro botão da linha (o controle de status, já que o
    // sucessor mutável não tem seta de linhagem própria) — ver
    // `archiveLineageReturn.focusTaskRow`.
    const row = screen.getByText('Sucessor aqui').closest('[data-task-id]') as HTMLElement
    expect(row.querySelector('button')).toHaveFocus()
  })

  it('segunda chegada por linhagem no MESMO período já montado também foca a linha sucessora (achado da review)', async () => {
    monthlyLogResult = queryResult({
      data: monthlyLog({
        tasks: [
          task({ id: 'sucessor-1', title: 'Sucessor um' }),
          task({ id: 'sucessor-2', title: 'Sucessor dois' }),
        ],
      }),
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const router = createMemoryRouter(
      [{ path: '/archive/monthly/:monthFirst', element: <ArchiveMonthlyDetailPage /> }],
      { initialEntries: [{ pathname: '/archive/monthly/2026-06-01', state: { focusTaskId: 'sucessor-1' } }] },
    )
    render(
      <QueryClientProvider client={qc}>
        <ThemeProvider theme={createBujoTheme('light')}>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      const row = screen.getByText('Sucessor um').closest('[data-task-id]') as HTMLElement
      expect(row.querySelector('button')).toHaveFocus()
    })

    // Mesmo `monthFirst` — só `location.state.focusTaskId` muda, simulando um
    // segundo salto de linhagem pousando no mês já montado. Sem o reset de
    // `arrivalHandledRef` por `location.key`, esta chegada nunca focaria a
    // linha sucessora.
    await act(async () => {
      await router.navigate('/archive/monthly/2026-06-01', { state: { focusTaskId: 'sucessor-2' } })
    })

    await waitFor(() => {
      const row = screen.getByText('Sucessor dois').closest('[data-task-id]') as HTMLElement
      expect(row.querySelector('button')).toHaveFocus()
    })
  })

  it('"Voltar ao Arquivo" preserva a querystring de retorno recebida em location.state', () => {
    monthlyLogResult = queryResult({ data: monthlyLog({ tasks: [] }) })
    renderPage('/archive/monthly/2026-06-01', { archiveReturnQuery: '?tab=monthly&from=2026-01-01' })

    expect(screen.getByRole('link', { name: /Voltar ao Arquivo/ })).toHaveAttribute(
      'href',
      '/archive?tab=monthly&from=2026-01-01',
    )
  })

  it('sem violações de acessibilidade (jest-axe) — mês fechado', async () => {
    monthlyLogResult = queryResult({
      data: monthlyLog({ closed: true, tasks: [task({ scheduledDate: '2026-06-03' })] }),
    })
    const { container } = renderPage()
    expect(await axe(container)).toHaveNoViolations()
  })
})
