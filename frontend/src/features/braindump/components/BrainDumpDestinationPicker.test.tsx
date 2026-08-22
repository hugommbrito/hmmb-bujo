import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import type { ReactNode } from 'react'

import { BrainDumpDestinationPicker } from './BrainDumpDestinationPicker'
import type { BrainDumpItem } from '../types'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('../../auth', () => ({
  useAuth: () => ({
    userId: 'user-1',
    isAuthenticated: true,
    sessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

import client from '../../../api/client'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

const ITEM: BrainDumpItem = {
  id: 'item-1',
  title: 'Renovar seguro do carro',
  description: null,
  targetLog: 'week',
  createdAt: '2026-07-23T10:00:00Z',
}

function mockReads() {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/bujo/logs/today/') {
      return Promise.resolve({ data: { id: 'log-1', logDate: '2026-07-29', tasks: [] } })
    }
    if (url === '/api/bujo/task-density/') {
      return Promise.resolve({ data: { density: [] } })
    }
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

function renderPicker(props: Partial<React.ComponentProps<typeof BrainDumpDestinationPicker>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const onClose = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const utils = render(<BrainDumpDestinationPicker item={ITEM} onClose={onClose} {...props} />, { wrapper })
  return { ...utils, onClose, qc }
}

describe('BrainDumpDestinationPicker (Story 15.1 — M11)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockReads()
  })

  it('pré-seleciona a opção de item.targetLog sem mover o item sozinho', async () => {
    renderPicker()

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Esta Semana/ })).toHaveAttribute('aria-checked', 'true'),
    )
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('selecionar Hoje habilita "Mover para hoje" e confirma via processItem', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'task-1', title: 'Item', status: 'pending', subtasks: [] } })
    const { onClose } = renderPicker()

    fireEvent.click(screen.getByRole('radio', { name: /Hoje/ }))
    const confirmButton = await screen.findByRole('button', { name: 'Mover para hoje' })
    fireEvent.click(confirmButton)

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/brain-dump/items/item-1/process/', {
        destination: 'today',
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('Esta Semana exige escolher um dia (ou "Sem dia definido") antes de confirmar', async () => {
    renderPicker()

    // Já pré-selecionado em "week" (item.targetLog), mas sem dia armado.
    await waitFor(() => screen.getByRole('radio', { name: /Esta Semana/ }))
    expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sem dia definido' }))

    expect(
      screen.getByRole('button', { name: 'Mover sem dia definido (esta semana)' }),
    ).toBeInTheDocument()
  })

  it('Futuro no mês corrente recusa com erro inline e não confirma', async () => {
    renderPicker()

    fireEvent.click(screen.getByRole('radio', { name: /Futuro/ }))
    const monthInput = await screen.findByLabelText('Mês')
    fireEvent.change(monthInput, { target: { value: '2026-07' } })

    expect(screen.getByRole('alert')).toHaveTextContent('Este Mês atende o mês corrente')
    expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument()
  })

  it('Esta Semana com um dia ESPECÍFICO escolhido confirma com o scheduledDate exato daquele dia (achado de review #12)', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'task-1', title: 'Item', status: 'pending', subtasks: [] } })
    renderPicker()

    // today mockado = 2026-07-29 (quarta) → semana de 2026-07-27 (segunda) a
    // 2026-08-02 (domingo). Escolhe sexta-feira, 31/jul — um dia QUALQUER que
    // não seja "hoje" nem o primeiro da semana, para provar que o valor
    // enviado é o do dia clicado, não um default incidental.
    await screen.findByRole('radio', { name: 'Sexta, 31 de julho' })
    fireEvent.click(screen.getByRole('radio', { name: 'Sexta, 31 de julho' }))

    const confirmButton = screen.getByRole('button', { name: 'Mover para sexta, 31 de julho' })
    fireEvent.click(confirmButton)

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/brain-dump/items/item-1/process/', {
        destination: 'week',
        scheduledDate: '2026-07-31',
      }),
    )
  })

  it('Este Mês com um dia escolhido confirma com destination:month e o scheduledDate exato (achado de review #11)', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'task-1', title: 'Item', status: 'pending', subtasks: [] } })
    renderPicker()

    fireEvent.click(screen.getByRole('radio', { name: 'Este Mês' }))
    // today mockado = 2026-07-29 → mês corrente = julho/2026, densidade vazia
    // no mock ⇒ rótulo "sem tarefas".
    const day15 = await screen.findByRole('button', { name: '15 de julho, sem tarefas' })
    fireEvent.click(day15)

    const confirmButton = screen.getByRole('button', { name: 'Mover para 15 de julho' })
    fireEvent.click(confirmButton)

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/brain-dump/items/item-1/process/', {
        destination: 'month',
        scheduledDate: '2026-07-15',
      }),
    )
  })

  it('Futuro num mês à frente habilita o calendário de densidade e confirma com monthFirst', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'task-1', title: 'Item', status: 'pending', subtasks: [] } })
    renderPicker()

    fireEvent.click(screen.getByRole('radio', { name: /Futuro/ }))
    const monthInput = await screen.findByLabelText('Mês')
    fireEvent.change(monthInput, { target: { value: '2026-09' } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sem dia definido' }))
    const confirmButton = screen.getByRole('button', {
      name: /Mover sem dia definido \(setembro de 2026\)/i,
    })
    fireEvent.click(confirmButton)

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/brain-dump/items/item-1/process/', {
        destination: 'future',
        monthFirst: '2026-09-01',
        scheduledDate: null,
      }),
    )
  })

  it('mostra "Carregando…" no lugar do seletor de dia enquanto useTodayLogQuery está pendente (achado de review #9)', () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/bujo/logs/today/') return new Promise(() => {}) // nunca resolve
      if (url === '/api/bujo/task-density/') return Promise.resolve({ data: { density: [] } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    // `item.targetLog === 'week'` já pré-seleciona "Esta Semana" — o bloco de
    // loading aparece sem precisar clicar em nada.
    renderPicker()

    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    // Nunca "silencioso": nenhum seletor de dia nem confirmar aparecem sem
    // explicação enquanto a data de referência não chegou.
    expect(screen.queryByRole('radiogroup', { name: /^Dias de/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument()
  })

  it('mostra erro + "Tentar de novo" quando useTodayLogQuery falha, e refetch ao clicar (achado de review #9)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/bujo/logs/today/') return Promise.reject(new Error('falha de rede'))
      if (url === '/api/bujo/task-density/') return Promise.resolve({ data: { density: [] } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderPicker()

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível carregar as datas de referência.',
      ),
    )
    const callsBeforeRetry = mockGet.mock.calls.filter(
      ([url]) => url === '/api/bujo/logs/today/',
    ).length

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    await waitFor(() => {
      const callsAfterRetry = mockGet.mock.calls.filter(
        ([url]) => url === '/api/bujo/logs/today/',
      ).length
      expect(callsAfterRetry).toBeGreaterThan(callsBeforeRetry)
    })
  })

  it('Escape fecha sem confirmar', () => {
    const { onClose } = renderPicker()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('não aninha dois role="dialog" na faixa pointer (achado de review #2 — MUI Dialog já estampa o seu)', async () => {
    renderPicker()
    await waitFor(() => screen.getByRole('radio', { name: /Esta Semana/ }))

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Para onde mover este item?')
  })

  it('sem violações de acessibilidade', async () => {
    const { container } = renderPicker()
    await waitFor(() => screen.getByRole('radio', { name: /Esta Semana/ }))
    expect(await axe(container)).toHaveNoViolations()
  })

  it('faixa compact: renderiza como Drawer com um único role="dialog" nomeado e sem violações de acessibilidade (achado de review)', async () => {
    const { container } = renderPicker({ compact: true })
    await waitFor(() => screen.getByRole('radio', { name: /Esta Semana/ }))

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Para onde mover este item?')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('offline: destino e "Sem dia definido" ficam desabilitados, sem confirmar nenhum POST (I/O Matrix — achado de review)', async () => {
    renderPicker({ disabled: true })

    await waitFor(() => expect(screen.getByRole('radio', { name: /Esta Semana/ })).toBeDisabled())
    expect(screen.getByRole('radio', { name: /Hoje/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sem dia definido' })).toBeDisabled()

    // Elemento nativo desabilitado: o clique não dispara o handler (jsdom
    // respeita `disabled`), então o dia nunca fica armado e nenhum botão
    // "Mover…" nomeado aparece.
    fireEvent.click(screen.getByRole('button', { name: 'Sem dia definido' }))
    expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })
})
