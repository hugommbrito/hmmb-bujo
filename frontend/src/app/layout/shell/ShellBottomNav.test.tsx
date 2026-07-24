import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { MemoryRouter, useLocation } from 'react-router-dom'
// `?raw` — greps de guarda (catálogo fechado + zero literais estruturais),
// padrão da Story 13.2.
import shellBottomNavSource from './ShellBottomNav.tsx?raw'
import shellNavigationSheetSource from './ShellNavigationSheet.tsx?raw'

// Padrão de chrome: o barrel `features/braindump` é mockado SEM Query — nenhum
// QueryClientProvider na árvore (AC1). O mock rico expõe as props em data-attrs
// para provar a integração `max`/`badgeSx` (aprendizado da review da 13.2).
vi.mock('../../../features/braindump', () => ({
  BrainDumpBadge: ({
    children,
    max,
    badgeSx,
  }: {
    children: React.ReactNode
    max?: number
    badgeSx?: Record<string, string>
  }) => (
    <span data-testid="brain-dump-badge" data-max={max} data-badge-sx={JSON.stringify(badgeSx)}>
      {children}
    </span>
  ),
  BrainDumpCaptureSheet: ({ open }: { open: boolean }) =>
    open ? <div>capture sheet aberto</div> : null,
}))

import { ShellBottomNav } from './ShellBottomNav'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{location.pathname}</div>
}

function renderBottomNav(
  props: { initialPath?: string; menuOpen?: boolean; onOpenMenu?: () => void } = {},
) {
  const { initialPath = '/today', menuOpen = false, onOpenMenu = vi.fn() } = props
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ShellBottomNav menuOpen={menuOpen} onOpenMenu={onOpenMenu} />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('ShellBottomNav — 3 atalhos derivados + Menu fixo (AC2)', () => {
  it('renderiza os 3 atalhos default (Hoje, Esta Semana, Este Mês) + Menu', () => {
    renderBottomNav()

    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.getByText('Esta Semana')).toBeInTheDocument()
    expect(screen.getByText('Este Mês')).toBeInTheDocument()
    expect(screen.getByText('Menu')).toBeInTheDocument()
    // Exatamente 4 itens: 3 atalhos + Menu (nada de módulos futuros/desabilitados).
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('landmark é "Atalhos de navegação" (troca contratada — AC4)', () => {
    renderBottomNav()
    expect(screen.getByRole('navigation', { name: 'Atalhos de navegação' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegação mobile' })).not.toBeInTheDocument()
  })

  it('navega ao clicar num atalho', async () => {
    const user = userEvent.setup()
    renderBottomNav({ initialPath: '/today' })

    await user.click(screen.getByRole('button', { name: 'Esta Semana' }))
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/planner/week')
  })
})

describe('ShellBottomNav — estado ativo (AC2)', () => {
  it('atalho ativo por rota exata tem aria-current="page"', () => {
    renderBottomNav({ initialPath: '/today' })

    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Esta Semana' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Menu' })).not.toHaveAttribute('aria-current')
  })

  it('atalho ativo por prefixo do próprio destino (path + "/")', () => {
    const nested = renderBottomNav({ initialPath: '/planner/week/2026-07-20' })
    expect(screen.getByRole('button', { name: 'Esta Semana' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    nested.unmount()

    // Prefixo do DESTINO, nunca prefixo mais largo: `/planner/future` compartilha
    // o segmento `/planner` com os atalhos, mas não é rota de nenhum deles — o
    // selecionado cai no Menu.
    renderBottomNav({ initialPath: '/planner/future' })
    expect(screen.getByRole('button', { name: 'Esta Semana' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Este Mês' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-current', 'page')
  })

  it('rota fora dos 3 atalhos ⇒ Menu aparece selecionado', () => {
    renderBottomNav({ initialPath: '/health/metrics' })

    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Hoje' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Esta Semana' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Este Mês' })).not.toHaveAttribute('aria-current')
  })
})

describe('ShellBottomNav — item Menu (AC3/AC4)', () => {
  it('Menu expõe aria-expanded ligado ao sheet e dispara onOpenMenu', async () => {
    const user = userEvent.setup()
    const onOpenMenu = vi.fn()
    const { unmount } = renderBottomNav({ menuOpen: false, onOpenMenu })

    const menu = screen.getByRole('button', { name: 'Menu' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')

    await user.click(menu)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
    unmount()

    renderBottomNav({ menuOpen: true })
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('ShellBottomNav — acessibilidade e guardas (AC1/AC7)', () => {
  it('sem violações de acessibilidade', async () => {
    const { container } = renderBottomNav()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('nenhum @mui/icons-material nos componentes novos (catálogo Phosphor fechado)', () => {
    expect(shellBottomNavSource).not.toMatch(/from\s+['"]@mui\/icons-material/)
    expect(shellNavigationSheetSource).not.toMatch(/from\s+['"]@mui\/icons-material/)
  })

  it('zero literais estruturais (56/64/240) — geometria só via tokens', () => {
    expect(shellBottomNavSource).not.toMatch(/\b(56|64|240)\b/)
    expect(shellNavigationSheetSource).not.toMatch(/\b(56|64|240)\b/)
    expect(shellBottomNavSource).toContain('var(--ds-bottom-nav-height)')
    expect(shellBottomNavSource).toContain('env(safe-area-inset-bottom, 0px)')
  })

  it('sem TanStack Query direto no chrome (contagem só pelo BrainDumpBadge)', () => {
    expect(shellBottomNavSource).not.toMatch(/@tanstack\/react-query/)
    expect(shellNavigationSheetSource).not.toMatch(/@tanstack\/react-query/)
  })
})
