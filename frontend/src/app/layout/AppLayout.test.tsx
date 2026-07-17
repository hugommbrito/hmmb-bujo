import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from './AppLayout'

vi.mock('../../shared/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    sessionExpired: false,
    userId: 'user-1',
    login: vi.fn(),
    logout: vi.fn(),
  })),
}))

vi.mock('../../features/braindump', () => ({
  BrainDumpBadge: ({ children }: { children: React.ReactNode }) => children,
}))

function mockMatchMedia(desktopMatch: boolean, mobileMatch: boolean, tabletMatch = false) {
  ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
    matches: (() => {
      if (query === '(min-width: 1024px)') return desktopMatch
      if (query === '(max-width: 767px)') return mobileMatch
      if (query === '(min-width: 768px) and (max-width: 1023px)') return tabletMatch
      return false
    })(),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

function renderAppLayout() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <div>conteúdo</div> },
          { path: 'today', element: <div>conteúdo hoje</div> },
          { path: 'brain-dump', element: <div>conteúdo brain dump</div> },
        ],
      },
    ],
    { initialEntries: ['/today'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('test_desktop_mostra_sidebar_oculta_bottom_nav', () => {
    mockMatchMedia(true, false)
    renderAppLayout()

    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegação mobile' })).not.toBeInTheDocument()
  })

  it('test_mobile_mostra_bottom_nav_oculta_sidebar', () => {
    mockMatchMedia(false, true)
    renderAppLayout()

    expect(screen.getByRole('navigation', { name: 'Navegação mobile' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument()
  })

  it('test_atalho_colchete_faz_toggle_sidebar_no_desktop', () => {
    mockMatchMedia(true, false)
    renderAppLayout()

    // Sidebar expandida inicialmente — textos visíveis
    expect(screen.getByText('Hoje')).toBeInTheDocument()

    // Pressionar [ para colapsar
    fireEvent.keyDown(window, { key: '[' })

    // Após colapso, ListItemText é removido do DOM (collapsed === true)
    expect(screen.queryByText('Planner')).not.toBeInTheDocument()
  })

  it('test_tablet_sidebar_inicia_colapsada', async () => {
    // Tablet: (min-width: 768px) and (max-width: 1023px) = true; desktop e mobile = false
    mockMatchMedia(false, false, true)
    renderAppLayout()

    // AppLayout renderiza o branch de sidebar (não mobile), mas o useEffect
    // define sidebarCollapsed=true para tablet → textos da sidebar ocultos
    await waitFor(() => {
      expect(screen.queryByText('Hoje')).not.toBeInTheDocument()
    })
    // Bottom-nav não aparece no modo tablet
    expect(screen.queryByRole('navigation', { name: 'Navegação mobile' })).not.toBeInTheDocument()
  })

  it('test_atalho_colchete_ignorado_em_input', () => {
    mockMatchMedia(true, false)
    renderAppLayout()

    const inputEl = document.createElement('input')
    document.body.appendChild(inputEl)
    inputEl.focus()

    fireEvent.keyDown(inputEl, { key: '[' })

    // Sidebar ainda expandida — textos ainda visíveis
    expect(screen.getByText('Hoje')).toBeInTheDocument()
    document.body.removeChild(inputEl)
  })

  it('test_atalho_b_navega_para_brain_dump_no_desktop', () => {
    mockMatchMedia(true, false)
    renderAppLayout()

    fireEvent.keyDown(window, { key: 'b' })

    expect(screen.getByText('conteúdo brain dump')).toBeInTheDocument()
  })

  it('test_atalho_b_ignorado_em_input', () => {
    mockMatchMedia(true, false)
    renderAppLayout()

    const inputEl = document.createElement('input')
    document.body.appendChild(inputEl)
    inputEl.focus()

    fireEvent.keyDown(inputEl, { key: 'b' })

    expect(screen.queryByText('conteúdo brain dump')).not.toBeInTheDocument()
    document.body.removeChild(inputEl)
  })

  it('test_atalho_b_ignorado_no_mobile', () => {
    mockMatchMedia(false, true)
    renderAppLayout()

    fireEvent.keyDown(window, { key: 'b' })

    expect(screen.queryByText('conteúdo brain dump')).not.toBeInTheDocument()
  })

  it('test_sem_violacoes_de_acessibilidade (desktop)', async () => {
    mockMatchMedia(true, false)
    const { container } = renderAppLayout()

    expect(await axe(container)).toHaveNoViolations()
  })

  it('test_sem_violacoes_de_acessibilidade (mobile)', async () => {
    mockMatchMedia(false, true)
    const { container } = renderAppLayout()

    expect(await axe(container)).toHaveNoViolations()
  })
})
