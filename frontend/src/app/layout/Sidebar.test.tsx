import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

function renderSidebar(
  props: { collapsed?: boolean; onToggle?: () => void; initialPath?: string } = {},
) {
  const { collapsed = false, onToggle = vi.fn(), initialPath = '/today' } = props
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
    </MemoryRouter>,
  )
}

describe('Sidebar', () => {
  it('test_item_ativo_tem_borda_primary', () => {
    renderSidebar({ initialPath: '/today' })
    const hojeBtns = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-current') === 'page',
    )
    expect(hojeBtns.length).toBeGreaterThan(0)
  })

  it('test_item_inativo_sem_borda', () => {
    renderSidebar({ initialPath: '/today' })
    // "Hábitos" não está na rota /today → não deve ter aria-current=page
    const buttons = screen.getAllByRole('button')
    const habitosBtn = buttons.find((btn) => btn.textContent?.includes('Hábitos'))
    expect(habitosBtn?.getAttribute('aria-current')).toBeNull()
  })

  it('test_grupo_planner_expande_ao_clicar', async () => {
    const user = userEvent.setup()
    renderSidebar({ initialPath: '/today' })

    // Planner inicia expandido — subitens visíveis
    expect(screen.getByText('Esta Semana')).toBeInTheDocument()

    // Clicar no grupo Planner para fechar
    await user.click(screen.getByText('Planner'))
    expect(screen.queryByText('Esta Semana')).not.toBeInTheDocument()

    // Clicar novamente para expandir
    await user.click(screen.getByText('Planner'))
    expect(screen.getByText('Esta Semana')).toBeInTheDocument()
  })

  it('test_collapsed_oculta_textos_de_labels', () => {
    renderSidebar({ collapsed: true })
    // Quando collapsed, os ListItemText não são renderizados
    expect(screen.queryByText('Hoje')).not.toBeInTheDocument()
    expect(screen.queryByText('Hábitos')).not.toBeInTheDocument()
    expect(screen.queryByText('Planner')).not.toBeInTheDocument()
  })

  it('test_botao_toggle_chama_onToggle', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    renderSidebar({ collapsed: false, onToggle })

    // Botão com aria-label "Colapsar sidebar" (estado expandido)
    await user.click(screen.getByRole('button', { name: /colapsar sidebar/i }))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('test_grupo_saude_expande_ao_clicar', async () => {
    const user = userEvent.setup()
    renderSidebar({ initialPath: '/today' })

    // Grupo Saúde inicia expandido — subitens visíveis
    expect(screen.getByText('Métricas')).toBeInTheDocument()

    // Clicar no grupo Saúde para fechar
    await user.click(screen.getByText('Saúde'))
    expect(screen.queryByText('Métricas')).not.toBeInTheDocument()

    // Clicar novamente para expandir
    await user.click(screen.getByText('Saúde'))
    expect(screen.getByText('Métricas')).toBeInTheDocument()
  })

  it('test_grupos_fecham_quando_sidebar_colapsa', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/today']}>
        <Sidebar collapsed={false} onToggle={vi.fn()} />
      </MemoryRouter>,
    )

    // Expandida: subitens de Planner visíveis
    expect(screen.getByText('Esta Semana')).toBeInTheDocument()

    // Colapsar sidebar
    rerender(
      <MemoryRouter initialEntries={['/today']}>
        <Sidebar collapsed={true} onToggle={vi.fn()} />
      </MemoryRouter>,
    )

    // Collapsed: subitens ocultos (Collapse fechado + textos removidos)
    expect(screen.queryByText('Esta Semana')).not.toBeInTheDocument()
  })
})
