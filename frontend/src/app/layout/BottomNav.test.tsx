import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../features/braindump', () => ({
  BrainDumpBadge: ({ children }: { children: React.ReactNode }) => children,
  BrainDumpCaptureSheet: ({ open }: { open: boolean }) =>
    open ? <div>capture sheet aberto</div> : null,
}))

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

import { BottomNav } from './BottomNav'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...original,
    useNavigate: () => mockNavigate,
  }
})

function renderBottomNav(initialPath = '/today') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>,
  )
}

describe('BottomNav', () => {
  afterEach(() => {
    // Restaura o default de jsdom (online) — o hook useOnlineStatus lê
    // navigator.onLine na montagem, e um teste offline não pode vazar.
    setNavigatorOnLine(true)
  })

  it('test_quatro_abas_presentes', () => {
    renderBottomNav()
    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.getByText('Planner')).toBeInTheDocument()
    expect(screen.getByText('Hábitos')).toBeInTheDocument()
    expect(screen.getByText('Saúde')).toBeInTheDocument()
  })

  it('test_fab_presente_e_habilitado_por_padrao', () => {
    setNavigatorOnLine(true)
    renderBottomNav()
    const fab = screen.getByRole('button', { name: 'Captura rápida' })
    expect(fab).toBeInTheDocument()
    expect(fab).not.toBeDisabled()
  })

  it('test_fab_desabilitado_offline_com_tooltip', () => {
    setNavigatorOnLine(false)
    renderBottomNav()
    const fab = screen.getByRole('button', { name: 'Captura rápida (sem conexão)' })
    expect(fab).toBeInTheDocument()
    expect(fab).toBeDisabled()
  })

  it('test_tooltip_sem_conexao_aparece_no_hover_offline', async () => {
    // AC #3 exige o tooltip "Sem conexão", não só o aria-label. O Tooltip
    // escuta hover no <span> wrapper (Fab disabled não dispara eventos de
    // mouse/foco — recipe oficial do MUI para o wrapper).
    setNavigatorOnLine(false)
    const user = userEvent.setup()
    renderBottomNav()

    const fab = screen.getByRole('button', { name: 'Captura rápida (sem conexão)' })
    await user.hover(fab.parentElement as HTMLElement)

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Sem conexão')
  })

  it('test_clicar_fab_abre_capture_sheet', async () => {
    setNavigatorOnLine(true)
    const user = userEvent.setup()
    renderBottomNav()

    expect(screen.queryByText('capture sheet aberto')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Captura rápida' }))
    expect(screen.getByText('capture sheet aberto')).toBeInTheDocument()
  })

  it('test_aba_ativa_por_rota', () => {
    renderBottomNav('/habits')
    // MUI BottomNavigationAction usa CSS class Mui-selected para indicar item ativo
    const habitosBtn = screen.getByText('Hábitos').closest('button')
    expect(habitosBtn).toHaveClass('Mui-selected')
  })

  it('test_rota_sem_aba_correspondente_nao_destaca_nenhuma_aba', () => {
    renderBottomNav('/settings')
    // Rotas fora das 4 abas (ex.: /settings, /gratitude, /archive) não devem
    // marcar "Hoje" (ou qualquer outra aba) como selecionada por padrão
    const buttons = ['Hoje', 'Planner', 'Hábitos', 'Saúde'].map(
      (label) => screen.getByText(label).closest('button'),
    )
    buttons.forEach((btn) => expect(btn).not.toHaveClass('Mui-selected'))
  })

  it('test_navegacao_ao_clicar_aba', async () => {
    const user = userEvent.setup()
    renderBottomNav('/today')

    await user.click(screen.getByText('Planner'))

    expect(mockNavigate).toHaveBeenCalledWith('/planner/week')
  })

  it('test_sem_violacoes_de_acessibilidade', async () => {
    const { container } = renderBottomNav()

    expect(await axe(container)).toHaveNoViolations()
  })
})
