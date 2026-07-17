import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../features/braindump', () => ({
  BrainDumpBadge: ({ children }: { children: React.ReactNode }) => children,
}))

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
  it('test_quatro_abas_presentes', () => {
    renderBottomNav()
    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.getByText('Planner')).toBeInTheDocument()
    expect(screen.getByText('Hábitos')).toBeInTheDocument()
    expect(screen.getByText('Saúde')).toBeInTheDocument()
  })

  it('test_fab_presente_e_desabilitado', () => {
    renderBottomNav()
    const fab = screen.getByRole('button', { name: /captura rápida/i })
    expect(fab).toBeInTheDocument()
    expect(fab).toBeDisabled()
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
