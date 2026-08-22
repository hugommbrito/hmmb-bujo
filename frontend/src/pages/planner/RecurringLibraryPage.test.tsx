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
import { mediaQueries } from '../../shared/design/tokens'
import { RecurringLibraryPage } from './RecurringLibraryPage'
import type { RecurringTaskTemplate } from '../../features/bujo'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPatch = client.patch as ReturnType<typeof vi.fn>
const mockDelete = client.delete as ReturnType<typeof vi.fn>

function tpl(overrides: Partial<RecurringTaskTemplate> = {}): RecurringTaskTemplate {
  return {
    id: 'tpl-1',
    title: 'Revisar orçamento',
    description: null,
    eisenhower: null,
    category: null,
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda segunda de manhã',
    active: true,
    ...overrides,
  }
}

function mockList(templates: RecurringTaskTemplate[]) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/bujo/recurring-templates/') return Promise.resolve({ data: templates })
    return Promise.reject(new Error(`unhandled GET ${url}`))
  })
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

// `vi.resetAllMocks()` também limpa o mock GLOBAL de `window.matchMedia`
// (`test-setup.ts`) — sem reafirmar `tabletUp`, `useMediaQuery` recebe
// `undefined` e a página quebra ao montar. Faixa larga por padrão (não
// compact): os testes de compact específico não são o foco desta página.
function mockWideFaixa() {
  const tabletUp: string = mediaQueries.tabletUp
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === tabletUp,
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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>
        <MemoryRouter>
          <RecurringLibraryPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('RecurringLibraryPage — composição e landmark (AC1/AC9)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
    setOnline(true)
  })

  it('renderiza um único <main aria-label="Recorrentes">', async () => {
    mockList([])
    renderPage()
    await waitFor(() => expect(screen.getByRole('main', { name: 'Recorrentes' })).toBeInTheDocument())
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('cabeçalho mostra título, subtítulo canônico e a ação primária "Novo template"', async () => {
    mockList([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Recorrentes')).toBeInTheDocument())
    expect(
      screen.getByText('Modelos que você aloca manualmente ao planejar. Não geram tarefas sozinhos.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo template' })).toBeInTheDocument()
  })

  it('initial loading: mostra o skeleton e NÃO renderiza abas nem lista enquanto pendente', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status', { name: '' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})

describe('RecurringLibraryPage — abas, contagem e filtro (AC1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
    setOnline(true)
  })

  it('a contagem de cada aba reflete a MESMA lista filtrada renderizada; ligar "Mostrar inativos" muda os três números', async () => {
    mockList([
      tpl({ id: 'w1', recurrenceGroup: 'weekly', active: true }),
      tpl({ id: 'w2', title: 'Semanal inativo', recurrenceGroup: 'weekly', active: false }),
      tpl({ id: 'm1', title: 'Mensal', recurrenceGroup: 'monthly', active: true }),
    ])
    renderPage()
    await screen.findByRole('tablist', { name: 'Grupo de recorrência' })

    expect(screen.getByRole('tab', { name: 'Semanal (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mensal (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Anual (0)' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar inativos' }))

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Semanal (2)' })).toBeInTheDocument())
  })

  it('vazio por grupo: "Nenhum template neste grupo." + ação de criar', async () => {
    mockList([tpl({ id: 'm1', recurrenceGroup: 'monthly' })])
    renderPage()
    await screen.findByRole('tablist')
    expect(screen.getByText('Nenhum template neste grupo.')).toBeInTheDocument()
  })

  it('read error: mostra o motivo + retry, sem sair da tela e sem perder a aba/filtro', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/bujo/recurring-templates/') return Promise.reject(new Error('fail'))
      return Promise.reject(new Error(`unhandled GET ${url}`))
    })
    renderPage()
    await screen.findByRole('alert')
    expect(screen.getByText('Não foi possível carregar os templates.')).toBeInTheDocument()
    // As abas sobrevivem ao erro (AC6) — a faixa continua visível.
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})

describe('RecurringLibraryPage — criar e editar (AC3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
    setOnline(true)
  })

  it('"Novo template" abre o card em modo criação, com o Grupo herdando a aba ativa', async () => {
    mockList([])
    renderPage()
    await screen.findByRole('tablist')

    fireEvent.click(screen.getByRole('tab', { name: 'Mensal (0)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Novo template' }))

    expect(await screen.findByRole('heading', { name: 'Novo template' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Mensal' })).toHaveAttribute('aria-checked', 'true')
  })

  it('"Editar" na linha abre o card em modo edição, com Grupo readonly', async () => {
    mockList([tpl({ id: 'w1', title: 'Reunião semanal' })])
    renderPage()
    await screen.findByRole('tablist')

    fireEvent.click(screen.getByRole('button', { name: 'Editar Reunião semanal' }))

    expect(await screen.findByRole('heading', { name: 'Editar template' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Grupo de recorrência' })).toHaveAttribute(
      'aria-readonly',
      'true',
    )
  })

  it('criar chama POST e fecha o card ao salvar com sucesso', async () => {
    mockList([])
    mockPost.mockResolvedValueOnce({ data: tpl({ id: 'novo', title: 'Beber água' }) })
    renderPage()
    await screen.findByRole('tablist')

    fireEvent.click(screen.getByRole('button', { name: 'Novo template' }))
    await screen.findByRole('heading', { name: 'Novo template' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), {
      target: { value: 'Beber água' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Recorrência' }), {
      target: { value: 'todo dia' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/bujo/recurring-templates/',
        expect.objectContaining({ title: 'Beber água', recurrenceGroup: 'weekly', active: true }),
      ),
    )
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Novo template' })).not.toBeInTheDocument(),
    )
  })
})

describe('RecurringLibraryPage — Excluir = soft delete (AC4)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
    setOnline(true)
  })

  it('a lixeira só existe na edição, nunca na criação', async () => {
    mockList([])
    renderPage()
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('button', { name: 'Novo template' }))
    await screen.findByRole('heading', { name: 'Novo template' })
    expect(screen.queryByRole('button', { name: 'Excluir template' })).not.toBeInTheDocument()
  })

  it('Excluir abre um alertdialog nomeando o template, com Cancelar e Excluir', async () => {
    mockList([tpl({ id: 'w1', title: 'Reunião semanal' })])
    renderPage()
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Reunião semanal' }))
    await screen.findByRole('heading', { name: 'Editar template' })

    fireEvent.click(screen.getByRole('button', { name: 'Excluir template' }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar exclusão' })
    expect(within(dialog).getByText('Excluir template?')).toBeInTheDocument()
    expect(within(dialog).getByText(/«Reunião semanal» sai da biblioteca/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Excluir' })).toBeInTheDocument()
  })

  it('Cancelar fecha só o dialog — o card de edição continua aberto', async () => {
    mockList([tpl({ id: 'w1', title: 'Reunião semanal' })])
    renderPage()
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Reunião semanal' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir template' }))
    const dialog = await screen.findByRole('alertdialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Editar template' })).toBeInTheDocument()
  })

  it('confirmar chama DELETE e fecha dialog + card; o template some da biblioteca', async () => {
    mockList([tpl({ id: 'w1', title: 'Reunião semanal' })])
    mockDelete.mockResolvedValueOnce({ data: undefined })
    renderPage()
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Reunião semanal' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir template' }))
    const dialog = await screen.findByRole('alertdialog')

    // Após excluir, a próxima leitura da lista já não traz mais o template.
    mockList([])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith('/api/bujo/recurring-templates/w1/'),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Editar template' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Reunião semanal')).not.toBeInTheDocument())
  })

  it('falha do DELETE mantém card e dialog utilizáveis, com motivo e retry — nunca fecha em cima de erro', async () => {
    mockList([tpl({ id: 'w1', title: 'Reunião semanal' })])
    mockDelete.mockRejectedValueOnce(new Error('fail'))
    renderPage()
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Reunião semanal' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir template' }))
    const dialog = await screen.findByRole('alertdialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    await waitFor(() =>
      expect(within(dialog).getByText('Não foi possível excluir o template. Tente novamente.')).toBeInTheDocument(),
    )
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    // O card de edição continua MONTADO (nunca fecha em cima do erro) — o MUI
    // corretamente marca `aria-hidden` no card enquanto o alertdialog (o
    // modal do TOPO da pilha) está com o foco, então a busca precisa de
    // `{ hidden: true }` para enxergar através disso. É o mesmo racional de
    // qualquer conteúdo atrás de um modal: fica fora da árvore de
    // acessibilidade até o modal de cima fechar, não é destruído.
    expect(screen.getByRole('heading', { name: 'Editar template', hidden: true })).toBeInTheDocument()
  })

  it('Desativar/Ativar e Excluir no mesmo cenário — a distinção é operável e visível (AC4)', async () => {
    mockList([tpl({ id: 'w1', title: 'Reunião semanal', active: true })])
    mockPatch.mockResolvedValueOnce({
      data: tpl({ id: 'w1', title: 'Reunião semanal', active: false }),
    })
    renderPage()
    await screen.findByRole('tablist')

    // Desativar (reversível, prospectivo): a linha ganha o chip "inativo" e a
    // ação vira "Ativar" — sem sumir da biblioteca.
    //
    // `mockList` para o pós-PATCH é preparado ANTES do clique — não depois de
    // esperar o PATCH ser chamado — porque a invalidação dispara o refetch de
    // forma praticamente síncrona ao sucesso da mutação; preparar a resposta
    // só depois de `await waitFor(mockPatch chamado)` é uma corrida real: o
    // refetch pode consumir a implementação ANTIGA de `mockGet` antes de o
    // teste trocar para a nova, e nada dispara um refetch subsequente.
    mockList([tpl({ id: 'w1', title: 'Reunião semanal', active: false })])
    fireEvent.click(screen.getByRole('button', { name: 'Desativar Reunião semanal' }))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/bujo/recurring-templates/w1/', { active: false }),
    )
    // "Mostrar inativos" está DESLIGADO por padrão — o inativo "continua na
    // biblioteca COM O FILTRO" (AC4), não sem ele. Sem ligar o filtro aqui, o
    // template desativado simplesmente some do painel (comportamento
    // contratado, não bug) e não há "Ativar" para encontrar.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar inativos' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ativar Reunião semanal' })).toBeInTheDocument(),
    )
    expect(screen.getByText('inativo')).toBeInTheDocument()

    // Excluir (terminal, sem volta na UI): dialog + confirmação removem de vez.
    mockDelete.mockResolvedValueOnce({ data: undefined })
    fireEvent.click(screen.getByRole('button', { name: 'Editar Reunião semanal' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir template' }))
    const dialog = await screen.findByRole('alertdialog')
    mockList([])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith('/api/bujo/recurring-templates/w1/'),
    )
    await waitFor(() => expect(screen.queryByText('Reunião semanal')).not.toBeInTheDocument())
    // Sem caminho de volta na UI para o excluído (irmã de não-vacuidade: o
    // ativo continua tendo "Ativar"/"Desativar" — provado acima).
    expect(screen.queryByRole('button', { name: /Reunião semanal/ })).not.toBeInTheDocument()
  })
})

describe('RecurringLibraryPage — ausência de Alocar na biblioteca (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
    setOnline(true)
  })

  it('a biblioteca não oferece Alocar nem "Definir placement" em lugar nenhum', async () => {
    mockList([tpl({ id: 'w1', title: 'Reunião semanal' })])
    renderPage()
    await screen.findByRole('tablist')
    expect(screen.queryByRole('button', { name: 'Alocar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Definir placement' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Reunião semanal' }))
    await screen.findByRole('heading', { name: 'Editar template' })
    expect(screen.queryByRole('button', { name: 'Alocar' })).not.toBeInTheDocument()
  })
})

describe('RecurringLibraryPage — offline (AC6)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
  })

  it('offline: mostra o motivo e desabilita criar/editar/ativar/excluir', async () => {
    setOnline(false)
    mockList([tpl({ id: 'w1', title: 'Reunião semanal' })])
    renderPage()
    await screen.findByRole('tablist')

    expect(
      screen.getByText(
        'Você está offline. Consulta disponível; criar e editar templates ficam indisponíveis até reconectar.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo template' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Editar Reunião semanal' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desativar Reunião semanal' })).toBeDisabled()
  })
})

describe('RecurringLibraryPage — jest-axe (AC6)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
    setOnline(true)
  })

  it('sem violações de acessibilidade na lista', async () => {
    mockList([tpl({ id: 'w1', title: 'Reunião semanal' })])
    const { container } = renderPage()
    await screen.findByRole('tablist')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações de acessibilidade com o card de detalhe aberto', async () => {
    mockList([tpl({ id: 'w1', title: 'Reunião semanal' })])
    const { container } = renderPage()
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Reunião semanal' }))
    await screen.findByRole('heading', { name: 'Editar template' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações de acessibilidade com o dialog de confirmação aberto', async () => {
    mockList([tpl({ id: 'w1', title: 'Reunião semanal' })])
    const { container } = renderPage()
    await screen.findByRole('tablist')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Reunião semanal' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir template' }))
    await screen.findByRole('alertdialog')
    expect(await axe(container)).toHaveNoViolations()
  })
})

