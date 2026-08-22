import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockMigrateMutate = vi.fn()
let unifiedQueueResult: { isPending: boolean; isError: boolean; isSuccess: boolean; data?: unknown; refetch: () => void }

vi.mock('../features/bujo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/bujo')>()
  return {
    ...actual,
    useUnifiedMigrationQueueQuery: () => unifiedQueueResult,
    useMigrateTaskMutation: () => ({ mutate: mockMigrateMutate }),
    useTodayLogQuery: () => ({ isPending: false, data: { id: 'log-1', logDate: '2026-07-21', tasks: [] } }),
    useWeeklyLogQuery: () => ({ isPending: false, data: { weekStart: '2026-07-20' } }),
    useMonthlyLogQuery: () => ({ isPending: false, data: { monthFirst: '2026-07-01' } }),
  }
})

import { MigrationRitualPage } from './MigrationRitualPage'

const TASK = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  title: 'Enviar documentos ao contador',
  status: 'pending',
  eisenhower: null,
  category: null,
  subtasks: [],
  ...overrides,
})

function queueWith(sections: { sourceId: string; periodStart: string; items: ReturnType<typeof TASK>[] }[]) {
  return {
    totalCount: sections.reduce((sum, s) => sum + s.items.length, 0),
    sections: ['month', 'week', 'day'].map((sourceId) => {
      const match = sections.find((s) => s.sourceId === sourceId)
      return {
        sourceId,
        count: match?.items.length ?? 0,
        groups: match ? [{ periodStart: match.periodStart, items: match.items }] : [],
      }
    }),
  }
}

/** Molde padrão de um resultado "carregado com sucesso" de
 * `useUnifiedMigrationQueueQuery` — `isSuccess: true` por default porque é o
 * sinal que `MigrationRitualPage` usa (achado de code review) para disparar
 * o `useLayoutEffect` de foco inicial na fonte com pendência; sobrescreva
 * pelos overrides quando o teste precisar de outro estado (loading/erro). */
function queueResult(overrides: Partial<NonNullable<typeof unifiedQueueResult>> = {}) {
  return { isPending: false, isError: false, isSuccess: true, data: undefined, refetch: vi.fn(), ...overrides }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/migration']}>
      <Routes>
        <Route path="/migration" element={<MigrationRitualPage />} />
        <Route path="/today" element={<div>Hoje</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function rerenderPage(rerender: ReturnType<typeof render>['rerender']) {
  rerender(
    <MemoryRouter initialEntries={['/migration']}>
      <Routes>
        <Route path="/migration" element={<MigrationRitualPage />} />
        <Route path="/today" element={<div>Hoje</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MigrationRitualPage (Story 14.9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    unifiedQueueResult = queueResult({ data: undefined })
  })

  afterEach(() => {
    // O teste "offline" espiona `navigator.onLine` — restaurar aqui, e não só
    // no fim daquele teste, evita vazar o stub para os demais se a asserção
    // falhar antes da linha de restauração.
    vi.restoreAllMocks()
  })

  it('loading: mostra o esqueleto', () => {
    unifiedQueueResult = queueResult({ isPending: true, isSuccess: false, data: undefined })
    renderPage()
    expect(screen.getByRole('main', { name: 'Migração' })).toBeInTheDocument()
  })

  it('read-error: mostra motivo + retry', () => {
    const refetch = vi.fn()
    unifiedQueueResult = queueResult({ isError: true, isSuccess: false, data: undefined, refetch })
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a migração.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('vazio: sem tally nesta sessão mostra "Nada para migrar"', () => {
    unifiedQueueResult = queueResult({ data: queueWith([]) })
    renderPage()
    expect(screen.getByText('Nada para migrar.')).toBeInTheDocument()
  })

  it('mostra rail de fontes, lista de decisão e rail de contexto — nunca Dialog', () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    renderPage()

    expect(screen.getByRole('navigation', { name: 'Fontes da migração' })).toBeInTheDocument()
    expect(screen.getByText('Enviar documentos ao contador')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Contexto da migração' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('foca por padrão na fonte com pendência quando "month" está vazia (achado real do e2e em review)', () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'day', periodStart: '2026-07-27', items: [TASK({ id: 't-day' })] }]),
    })
    renderPage()

    // Sem navegar manualmente: o item de "Dias" já aparece de cara, e o rail
    // mostra "Dias" como fonte ativa — antes desta correção, o ritual sempre
    // abria em "Meses" mesmo com "Meses" vazia.
    expect(screen.getByText('Enviar documentos ao contador')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Fontes da migração' }).querySelector('[aria-current="true"]')).toHaveTextContent('Dias')
  })

  it('foco automático não pula a fonte ativa numa refetch subsequente (achado de code review): decidir "month" não revela "week" sem navegação manual', async () => {
    unifiedQueueResult = queueResult({
      data: queueWith([
        { sourceId: 'month', periodStart: '2026-06-01', items: [TASK({ id: 'm1', title: 'Tarefa do mês' })] },
        { sourceId: 'week', periodStart: '2026-07-20', items: [TASK({ id: 'w1', title: 'Tarefa da semana' })] },
      ]),
    })
    mockMigrateMutate.mockImplementation((_vars, { onSuccess }) => {
      // Refetch em background: "month" esvaziou, "week" continua pendente.
      // O latch do efeito de foco inicial já foi consumido no 1º load — sem
      // o fix (guarda por `!queue.data` em vez de `queue.isSuccess`, e
      // `useEffect` em vez de `useLayoutEffect`), o efeito não reagiria de
      // qualquer forma a essa 2ª leitura, então este teste passaria mesmo
      // com o bug; o que importa é que ele CONTINUE passando: o ritual
      // nunca deve saltar de fonte por conta própria após uma decisão.
      unifiedQueueResult = queueResult({
        data: queueWith([{ sourceId: 'week', periodStart: '2026-07-20', items: [TASK({ id: 'w1', title: 'Tarefa da semana' })] }]),
      })
      onSuccess()
    })
    const { rerender } = renderPage()

    expect(screen.getByText('Tarefa do mês')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    rerenderPage(rerender)

    // A fonte ativa permanece "month" (agora vazia) — "Tarefa da semana" só
    // fica visível se o usuário navegar manualmente para "Semanas".
    expect(screen.queryByText('Tarefa da semana')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Fontes da migração' }).querySelector('[aria-current="true"]')).toHaveTextContent('Meses')
  })

  it('"Migrar para hoje" chama a mutação com destination "today"', () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 't1', destination: 'today' },
      expect.anything(),
    )
  })

  it('"Cancelar" chama a mutação com destination "cancel"', () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 't1', destination: 'cancel' },
      expect.anything(),
    )
  })

  it('"Escolher destino…" abre o seletor compartilhado com as 3 abas', () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    const { container } = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    // ESTRUTURAL (DW-30): o seletor é um `Dialog` PORTALIZADO para fora do
    // container da página. Só a presença de `role="dialog"` ficaria verde com o
    // `if (!compact) return content` de volta — o defeito em que o seletor
    // entrava no fluxo do DOM depois da grade do ritual e abria fora da tela.
    const seletor = screen.getByRole('dialog', { name: 'Escolher destino' })
    expect(seletor.closest('.MuiDialog-root')).not.toBeNull()
    expect(seletor).toHaveAttribute('aria-modal', 'true')
    expect(container).not.toContainElement(seletor)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Esta semana',
      'Dia no mês',
      'Outro mês',
    ])
  })

  it('confirmar destino "Esta semana" chama a mutação com destination "week"', () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    const dialog = screen.getByRole('dialog', { name: 'Escolher destino' })
    expect(dialog.closest('.MuiDialog-root')).not.toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /Quarta/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Migrar para/ }))

    expect(mockMigrateMutate).toHaveBeenCalledWith(
      { taskId: 't1', destination: 'week', scheduledDate: '2026-07-22' },
      expect.anything(),
    )
  })

  it('"Pausar" navega para /today sem perder decisões', () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(screen.getByText('Hoje')).toBeInTheDocument()
  })

  it('erro de escrita: motivo inline + retry no item, sem perder a decisão', () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    mockMigrateMutate.mockImplementation((_vars, { onError }) => onError())
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar a decisão.')
    expect(screen.getByText('Enviar documentos ao contador')).toBeInTheDocument()
  })

  it('offline: banner de motivo aparece e ações ficam guardadas', () => {
    const onLineSpy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    renderPage()

    expect(screen.getByText(/Sem conexão\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    expect(mockMigrateMutate).not.toHaveBeenCalled()
    onLineSpy.mockRestore()
  })

  it('última decisão zera a fila e mostra o resumo factual antes de voltar ao Hoje', async () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    mockMigrateMutate.mockImplementation((_vars, { onSuccess }) => {
      unifiedQueueResult = queueResult({ data: queueWith([]) })
      onSuccess()
    })
    const { rerender } = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    rerenderPage(rerender)

    expect(await screen.findByText('Migração concluída')).toBeInTheDocument()
    expect(screen.getByText('1 tarefa decidida. Nada ficou sem lugar.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao Hoje' }))
    await waitFor(() => expect(screen.getByText('Hoje')).toBeInTheDocument())
  })

  it('jest-axe: sem violações com o resumo aberto (lição das 14.6/14.7: nunca medir estrutura ARIA fechada)', async () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    mockMigrateMutate.mockImplementation((_vars, { onSuccess }) => {
      unifiedQueueResult = queueResult({ data: queueWith([]) })
      onSuccess()
    })
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    await screen.findByText('Migração concluída')
    expect(await axe(container)).toHaveNoViolations()
  })

  // `axe(document.body)` e não `axe(container)`: com o seletor portalizado
  // (DW-30) o container do RTL não contém mais o diálogo — e ainda recebe
  // `aria-hidden` do Modal —, então medi-lo pararia de medir o que o nome deste
  // teste promete. Precedente verde em `DestinationDialog.test.tsx:611-620`.
  it('jest-axe: sem violações com a lista e o seletor de destino abertos', async () => {
    unifiedQueueResult = queueResult({
      data: queueWith([{ sourceId: 'month', periodStart: '2026-06-01', items: [TASK()] }]),
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher destino…' }))
    // ESTRUTURAL, não de presença: o que este teste precisa garantir antes de
    // medir é que o seletor está aberto COMO overlay portalizado — é o que faz
    // `document.body` ser o alvo certo do axe.
    expect(
      screen.getByRole('dialog', { name: 'Escolher destino' }).closest('.MuiDialog-root'),
    ).not.toBeNull()
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
