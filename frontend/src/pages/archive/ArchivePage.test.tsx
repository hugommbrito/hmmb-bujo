import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { axe } from 'jest-axe'
import { ArchivePage } from './ArchivePage'

// Sonda de rota de destino: exibe o rótulo esperado pelos testes existentes
// (`getByText('Semana aberta')`/`'Mês aberto'`) MAIS o `location.state` recebido
// — só assim dá pra provar que o link do índice repassa `archiveReturnQuery`
// (achado da review: antes só `handleNavigateToSuccessor` fazia isso).
function DetailProbe({ label }: { label: string }) {
  const location = useLocation()
  return (
    <div>
      {label}
      <div data-testid="location-state">{JSON.stringify(location.state)}</div>
    </div>
  )
}

vi.mock('../../features/bujo', () => ({
  useArchiveQuery: vi.fn(),
}))

import { useArchiveQuery } from '../../features/bujo'

const mockUseArchiveQuery = useArchiveQuery as ReturnType<typeof vi.fn>

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

function renderArchivePage(initialEntry = '/archive') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/archive/weekly/:weekStart" element={<DetailProbe label="Semana aberta" />} />
        <Route path="/archive/monthly/:monthFirst" element={<DetailProbe label="Mês aberto" />} />
      </Routes>
    </MemoryRouter>,
  )
}

const ENTRIES = [
  { type: 'weekly', weekStart: '2026-07-13', monthFirst: null },
  { type: 'weekly', weekStart: '2026-07-06', monthFirst: null },
  { type: 'monthly', weekStart: null, monthFirst: '2026-07-01' },
]

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  sessionStorage.clear()
  setNavigatorOnLine(true)
  vi.restoreAllMocks()
})

describe('ArchivePage — índice (Story 14.10)', () => {
  it('mostra skeleton enquanto carrega', () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: true, data: undefined })

    renderArchivePage()

    expect(screen.getByLabelText('Arquivo')).toBeInTheDocument()
  })

  it('erro de leitura mostra mensagem genérica com retry (online)', () => {
    mockUseArchiveQuery.mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    })

    renderArchivePage()

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o Arquivo.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('erro de leitura offline mostra mensagem distinta (sem retry que não funcionaria)', () => {
    setNavigatorOnLine(false)
    mockUseArchiveQuery.mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    })

    renderArchivePage()

    expect(screen.getByText('Sem conexão. Não é possível carregar o Arquivo agora.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  })

  it('estado vazio inicial (aba Semanal, sem ciclos do tipo)', () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: [] })

    renderArchivePage()

    expect(screen.getByText('Nenhuma semana finalizada ainda.')).toBeInTheDocument()
  })

  it('abas: Mensal só aparece depois de trocar de aba (não lista os dois tipos juntos)', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })
    const user = userEvent.setup()

    renderArchivePage()

    expect(screen.getByText('Semana de 2026-07-13')).toBeInTheDocument()
    expect(screen.queryByText('Julho 2026')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Mensal' }))

    expect(screen.getByText('Julho 2026')).toBeInTheDocument()
    expect(screen.queryByText('Semana de 2026-07-13')).not.toBeInTheDocument()
  })

  it('abas: ARIA completo — aria-selected, aria-controls, roving tabindex e navegação por setas/Home/End', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })
    const user = userEvent.setup()

    renderArchivePage()

    const weeklyTab = screen.getByRole('tab', { name: 'Semanal' })
    const monthlyTab = screen.getByRole('tab', { name: 'Mensal' })

    expect(weeklyTab).toHaveAttribute('aria-selected', 'true')
    expect(weeklyTab).toHaveAttribute('tabindex', '0')
    expect(monthlyTab).toHaveAttribute('aria-selected', 'false')
    expect(monthlyTab).toHaveAttribute('tabindex', '-1')
    expect(monthlyTab).toHaveAttribute('aria-controls', 'archive-panel-monthly')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'archive-tab-weekly')

    weeklyTab.focus()
    await user.keyboard('{ArrowRight}')
    expect(monthlyTab).toHaveAttribute('aria-selected', 'true')
    expect(monthlyTab).toHaveFocus()

    await user.keyboard('{Home}')
    expect(weeklyTab).toHaveAttribute('aria-selected', 'true')
    expect(weeklyTab).toHaveFocus()

    await user.keyboard('{End}')
    expect(monthlyTab).toHaveAttribute('aria-selected', 'true')
    expect(monthlyTab).toHaveFocus()
  })

  it('lista renderiza rótulo de semana e de mês formatados corretamente, mais recentes primeiro', () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })

    renderArchivePage()

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('Semana de 2026-07-13')
    expect(links[1]).toHaveTextContent('Semana de 2026-07-06')
  })

  it('clicar num item navega para a rota certa', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })
    const user = userEvent.setup()

    renderArchivePage()

    await user.click(screen.getByRole('link', { name: /Semana de 2026-07-13/ }))

    expect(screen.getByText('Semana aberta')).toBeInTheDocument()
  })

  it('link do item repassa a aba/intervalo atuais como archiveReturnQuery (achado da review — antes só a linhagem fazia isso)', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })
    const user = userEvent.setup()

    renderArchivePage('/archive?tab=weekly&from=2026-07-01&to=2026-07-31')

    await user.click(screen.getByRole('link', { name: /Semana de 2026-07-13/ }))

    const state = JSON.parse(screen.getByTestId('location-state').textContent ?? 'null')
    expect(state).toEqual({ archiveReturnQuery: '?tab=weekly&from=2026-07-01&to=2026-07-31' })
  })

  it('sem filtro/aba não-default aplicados, archiveReturnQuery viaja vazio', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })
    const user = userEvent.setup()

    renderArchivePage()

    await user.click(screen.getByRole('link', { name: /Semana de 2026-07-13/ }))

    const state = JSON.parse(screen.getByTestId('location-state').textContent ?? 'null')
    expect(state).toEqual({ archiveReturnQuery: '' })
  })

  it('filtro por período: aplica, mostra contagem e permite limpar', async () => {
    // `2026-07-06` (semana 07-06..07-12) SOBREPÕE o range 07-10..07-20 pelo
    // fim (07-12 >= 07-10) mesmo com início antes do range — regressão do bug
    // corrigido nesta review (entryPeriodEnd semanal era um ponto único,
    // igual ao que já havia sido corrigido só para mensal). `2026-06-22`
    // (semana 06-22..06-28) termina antes do range e continua excluída.
    const FILTER_ENTRIES = [
      { type: 'weekly', weekStart: '2026-07-13', monthFirst: null },
      { type: 'weekly', weekStart: '2026-07-06', monthFirst: null },
      { type: 'weekly', weekStart: '2026-06-22', monthFirst: null },
      { type: 'monthly', weekStart: null, monthFirst: '2026-07-01' },
    ]
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: FILTER_ENTRIES })
    const user = userEvent.setup()

    renderArchivePage()

    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('3 semanas finalizadas')

    await user.type(screen.getByLabelText('Data inicial'), '2026-07-10')
    await user.type(screen.getByLabelText('Data final'), '2026-07-20')
    await user.click(screen.getByRole('button', { name: 'Aplicar período' }))

    expect(screen.getByText('Semana de 2026-07-13')).toBeInTheDocument()
    expect(screen.getByText('Semana de 2026-07-06')).toBeInTheDocument()
    expect(screen.queryByText('Semana de 2026-06-22')).not.toBeInTheDocument()
    expect(screen.getByText('2 semanas finalizadas')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpar' }))

    expect(screen.getByText('Semana de 2026-06-22')).toBeInTheDocument()
  })

  it('filtro sem resultado mantém o intervalo visível e oferece "Limpar período"', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })
    const user = userEvent.setup()

    renderArchivePage()

    await user.type(screen.getByLabelText('Data inicial'), '2026-01-01')
    await user.type(screen.getByLabelText('Data final'), '2026-01-07')
    await user.click(screen.getByRole('button', { name: 'Aplicar período' }))

    expect(screen.getByText('Nenhuma semana finalizada nesse período.')).toBeInTheDocument()
    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-01-01')
    await user.click(screen.getByRole('button', { name: 'Limpar período' }))
    expect(screen.getByText('Semana de 2026-07-13')).toBeInTheDocument()
  })

  it('filtro na aba Mensal usa o intervalo do mês inteiro, não só o dia 1 (monthFirst)', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })
    const user = userEvent.setup()

    renderArchivePage()
    await user.click(screen.getByRole('tab', { name: 'Mensal' }))

    // `from` no MEIO do mês: comparar só contra `monthFirst` (dia 1) excluiria
    // "Julho 2026" inteiro, mesmo com a segunda metade do mês dentro do range.
    await user.type(screen.getByLabelText('Data inicial'), '2026-07-15')
    await user.type(screen.getByLabelText('Data final'), '2026-07-31')
    await user.click(screen.getByRole('button', { name: 'Aplicar período' }))

    expect(screen.getByText('Julho 2026')).toBeInTheDocument()
    expect(screen.getByText('1 mês finalizado')).toBeInTheDocument()
  })

  it('valida data inicial > data final com mensagem distinta do vazio', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })
    const user = userEvent.setup()

    renderArchivePage()

    await user.type(screen.getByLabelText('Data inicial'), '2026-07-20')
    await user.type(screen.getByLabelText('Data final'), '2026-07-01')
    await user.click(screen.getByRole('button', { name: 'Aplicar período' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A data inicial não pode ser depois da data final.',
    )
    expect(screen.queryByText('Nenhuma semana finalizada nesse período.')).not.toBeInTheDocument()
  })

  it('range inválido vindo direto da URL (link editado à mão) também mostra o erro, não só o formulário (achado da review)', () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })

    renderArchivePage('/archive?from=2026-07-20&to=2026-07-01')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A data inicial não pode ser depois da data final.',
    )
    expect(screen.queryByText('Semana de 2026-07-13')).not.toBeInTheDocument()
  })

  it('offline: banner persistente, dados em cache continuam legíveis', () => {
    setNavigatorOnLine(false)
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })

    renderArchivePage()

    expect(screen.getByText('Sem conexão. Mostrando ciclos disponíveis neste dispositivo.')).toBeInTheDocument()
    expect(screen.getByText('Semana de 2026-07-13')).toBeInTheDocument()
  })

  it('restaura destaque do último período visitado (retorno do detalhe)', () => {
    sessionStorage.setItem('bujo:archive-last-selected', 'weekly:2026-07-06')
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })

    renderArchivePage()

    const link = screen.getByRole('link', { name: /Semana de 2026-07-06/ })
    expect(link).toHaveAttribute('aria-current', 'true')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('não restaura (nem descarta) o destaque de uma entrada de outro tipo que não o da aba ativa (achado da review)', () => {
    // A aba ativa por padrão é Semanal; uma entrada Mensal salva não tem como
    // estar no DOM ainda — precisa sobreviver no sessionStorage até uma
    // montagem cuja aba já bata, em vez de ser descartada sem chance.
    sessionStorage.setItem('bujo:archive-last-selected', 'monthly:2026-07-01')
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })

    renderArchivePage()

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('bujo:archive-last-selected')).toBe('monthly:2026-07-01')
  })

  it('não confunde semana e mês com a mesma data ao gravar/restaurar o destaque', async () => {
    // Uma semana pode começar no dia 1 de um mês: `entryKey` sozinho ("2026-08-01"
    // para os dois) colidiria; a chave de destaque precisa do `type` (review).
    const COLLIDING_ENTRIES = [
      { type: 'weekly', weekStart: '2026-08-01', monthFirst: null },
      { type: 'monthly', weekStart: null, monthFirst: '2026-08-01' },
    ]
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: COLLIDING_ENTRIES })
    const user = userEvent.setup()

    renderArchivePage()
    await user.click(screen.getByRole('link', { name: /Semana de 2026-08-01/ }))

    expect(sessionStorage.getItem('bujo:archive-last-selected')).toBe('weekly:2026-08-01')
  })

  it('sem violações de acessibilidade (jest-axe) — com entradas e aba mensal', async () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: ENTRIES })
    const user = userEvent.setup()

    const { container } = renderArchivePage()
    await user.click(screen.getByRole('tab', { name: 'Mensal' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('ArchivePage — dentro de within (sanidade da fixture)', () => {
  it('main tem o heading "Arquivo"', () => {
    mockUseArchiveQuery.mockReturnValue({ isPending: false, data: [] })
    renderArchivePage()
    expect(within(screen.getByLabelText('Arquivo')).getByRole('heading', { name: 'Arquivo' })).toBeInTheDocument()
  })
})
