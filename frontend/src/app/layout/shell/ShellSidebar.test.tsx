import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'
// `?raw` (suportado por vite/client) traz o código-fonte como string, sem
// precisar de tipos de node — grep de import do catálogo fechado (AC4).
import shellSidebarSource from './ShellSidebar.tsx?raw'
import navIconsSource from './navIcons.tsx?raw'

// Mesmo padrão dos testes de chrome: o barrel `features/braindump` é mockado
// SEM Query, então NÃO há QueryClientProvider na árvore e nenhum mock NOVO de
// Query é preciso (AC1). A contagem/oculto/`9+` do badge é coberta em
// BrainDumpBadge.test.tsx (com QueryClientProvider); aqui o mock expõe as props
// recebidas em data-attrs para provar que o SHELL passa `max={9}` + o estilo
// `app-shell-badge` (a integração não seria verificada por um passthrough puro).
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
}))

import { ShellSidebar } from './ShellSidebar'
import { collections as registry } from '../../collections/registry'
import type { CollectionManifestEntry } from '../../collections/registry'

function renderSidebar(
  props: {
    collapsed?: boolean
    onToggle?: () => void
    initialPath?: string
    collections?: CollectionManifestEntry[]
  } = {},
) {
  const { collapsed = false, onToggle = vi.fn(), initialPath = '/today', collections } = props
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ShellSidebar
        collapsed={collapsed}
        onToggle={onToggle}
        {...(collections ? { collections } : {})}
      />
    </MemoryRouter>,
  )
}

/** a aparece ANTES de b no DOM? */
function precedes(a: Element, b: Element) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('ShellSidebar — derivação (AC2)', () => {
  it('renderiza núcleo + collections do registro na ordem do inventário SB-01…SB-10', () => {
    renderSidebar({ initialPath: '/today' })

    // Núcleo/chrome e collections presentes.
    for (const label of [
      'Hoje',
      'Planner',
      'Esta Semana',
      'Este Mês',
      'Futuro',
      'Recorrentes',
      'Hábitos',
      'Saúde',
      'Métricas',
      'Medicamentos',
      'Gratidão',
      'Brain Dump',
      'Arquivo',
      'Configurações',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }

    // Ordem canônica (idêntica à Sidebar legada).
    expect(precedes(screen.getByText('Hoje'), screen.getByText('Planner'))).toBe(true)
    expect(precedes(screen.getByText('Planner'), screen.getByText('Esta Semana'))).toBe(true)
    expect(precedes(screen.getByText('Esta Semana'), screen.getByText('Hábitos'))).toBe(true)
    expect(precedes(screen.getByText('Hábitos'), screen.getByText('Saúde'))).toBe(true)
    expect(precedes(screen.getByText('Saúde'), screen.getByText('Métricas'))).toBe(true)
    expect(precedes(screen.getByText('Métricas'), screen.getByText('Medicamentos'))).toBe(true)
    expect(precedes(screen.getByText('Medicamentos'), screen.getByText('Gratidão'))).toBe(true)
    expect(precedes(screen.getByText('Gratidão'), screen.getByText('Brain Dump'))).toBe(true)
    expect(precedes(screen.getByText('Brain Dump'), screen.getByText('Arquivo'))).toBe(true)
    expect(precedes(screen.getByText('Arquivo'), screen.getByText('Configurações'))).toBe(true)
  })

  it('deriva label/grupo/ordem do registro (Métricas antes de Medicamentos por nav.order)', () => {
    renderSidebar({ initialPath: '/today' })
    // health-metrics (order 0) antes de medications (order 1), ambos no grupo Saúde.
    expect(precedes(screen.getByText('Métricas'), screen.getByText('Medicamentos'))).toBe(true)
  })

  it('collection nova sem ícone no catálogo fechado degrada sem crash (label preservado)', () => {
    // O `id` do registro é string aberta; o catálogo Phosphor é FECHADO por
    // design. Uma collection futura ainda não curada não pode derrubar o shell:
    // renderiza sem ícone, com o label navegável (FR-1.3/AR-23).
    const gratitude = registry.find((c) => c.id === 'gratitude')!
    const nova: CollectionManifestEntry = {
      ...gratitude,
      id: 'nova-collection',
      name: 'Nova Collection',
      nav: { label: 'Nova', group: 'saude', order: 9 },
    }
    renderSidebar({ initialPath: '/today', collections: [...registry, nova] })
    expect(screen.getByText('Nova')).toBeInTheDocument()
  })
})

describe('ShellSidebar — nav mínima (AC3)', () => {
  it('zero collections: núcleo + Planner completo, sem Saúde/avulsas e sem heading "Collections"', () => {
    renderSidebar({ initialPath: '/today', collections: [] })

    // Planner sempre completo.
    for (const label of ['Hoje', 'Planner', 'Esta Semana', 'Este Mês', 'Futuro', 'Recorrentes', 'Brain Dump', 'Arquivo', 'Configurações']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Sem collections nem grupo Saúde vazio.
    expect(screen.queryByText('Saúde')).not.toBeInTheDocument()
    expect(screen.queryByText('Hábitos')).not.toBeInTheDocument()
    expect(screen.queryByText('Gratidão')).not.toBeInTheDocument()
    expect(screen.queryByText('Métricas')).not.toBeInTheDocument()
    // Nunca há heading "Collections".
    expect(screen.queryByText('Collections')).not.toBeInTheDocument()
  })

  it('uma collection avulsa: só ela aparece, sem grupo Saúde', () => {
    const onlyHabits = registry.filter((c) => c.id === 'habits')
    renderSidebar({ initialPath: '/today', collections: onlyHabits })

    expect(screen.getByText('Hábitos')).toBeInTheDocument()
    expect(screen.queryByText('Gratidão')).not.toBeInTheDocument()
    expect(screen.queryByText('Saúde')).not.toBeInTheDocument()
    expect(screen.queryByText('Métricas')).not.toBeInTheDocument()
  })

  it('grupo Saúde permanece com um único filho e some por completo sem filhos', () => {
    // Com um único filho do grupo: Saúde aparece só com Métricas.
    const onlyMetrics = registry.filter((c) => c.id === 'health-metrics')
    const { unmount } = renderSidebar({ initialPath: '/today', collections: onlyMetrics })
    expect(screen.getByText('Saúde')).toBeInTheDocument()
    expect(screen.getByText('Métricas')).toBeInTheDocument()
    expect(screen.queryByText('Medicamentos')).not.toBeInTheDocument()
    unmount()

    // Sem nenhum filho do grupo: Saúde desaparece.
    const noHealth = registry.filter((c) => c.nav.group !== 'saude')
    renderSidebar({ initialPath: '/today', collections: noHealth })
    expect(screen.queryByText('Saúde')).not.toBeInTheDocument()
  })
})

describe('ShellSidebar — estado ativo e agrupadores (AC5)', () => {
  it('destino ativo tem aria-current="page" e label em peso forte (canal além da cor)', () => {
    renderSidebar({ initialPath: '/today' })

    const hoje = screen.getByRole('button', { name: /hoje/i })
    expect(hoje).toHaveAttribute('aria-current', 'page')
    // AC1/AC5: cor nunca é o único canal — label ativo também fica em peso forte.
    expect(screen.getByText('Hoje')).toHaveStyle({ fontWeight: '700' })
    expect(screen.getByText('Hábitos')).toHaveStyle({ fontWeight: '500' })
  })

  it('destino inativo não tem aria-current', () => {
    renderSidebar({ initialPath: '/today' })
    const habitos = screen.getByRole('button', { name: /hábitos/i })
    expect(habitos).not.toHaveAttribute('aria-current')
  })

  it('agrupador expõe aria-expanded e NUNCA aria-current', () => {
    renderSidebar({ initialPath: '/today' })
    const planner = screen.getByRole('button', { name: /planner/i })
    expect(planner).toHaveAttribute('aria-expanded', 'true')
    expect(planner).not.toHaveAttribute('aria-current')
  })

  it('agrupador recolhido contendo a rota ativa mostra .contains + descrição acessível, sem aria-current', () => {
    // Rail (recolhido) com a rota ativa dentro do Planner.
    renderSidebar({ collapsed: true, initialPath: '/planner/week' })

    const planner = screen.getByRole('button', { name: 'Planner' })
    expect(planner).not.toHaveAttribute('aria-current')
    expect(planner).toHaveAttribute('aria-expanded', 'false')

    const describedBy = planner.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'Contém a página atual: Esta Semana.',
    )
  })
})

describe('ShellSidebar — rail 64px e toggle (AC6)', () => {
  it('rail oculta labels e chevrons mas preserva o nome acessível (aria-label)', () => {
    renderSidebar({ collapsed: true, initialPath: '/today' })

    // Labels de texto ocultos.
    expect(screen.queryByText('Hoje')).not.toBeInTheDocument()
    expect(screen.queryByText('Planner')).not.toBeInTheDocument()
    expect(screen.queryByText('Hábitos')).not.toBeInTheDocument()
    // Chevron (glyph) oculto no rail.
    expect(screen.queryByText('⌄')).not.toBeInTheDocument()
    expect(screen.queryByText('⌃')).not.toBeInTheDocument()
    // Nome acessível preservado via aria-label.
    expect(screen.getByRole('button', { name: 'Hoje' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Planner' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hábitos' })).toBeInTheDocument()
  })

  it('toggle usa aria-label alternando e dispara onToggle', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const { unmount } = renderSidebar({ collapsed: false, onToggle })

    const collapseBtn = screen.getByRole('button', { name: 'Colapsar sidebar' })
    await user.click(collapseBtn)
    expect(onToggle).toHaveBeenCalledTimes(1)
    unmount()

    renderSidebar({ collapsed: true, onToggle: vi.fn() })
    expect(screen.getByRole('button', { name: 'Expandir sidebar' })).toBeInTheDocument()
  })

  it('grupos fecham ao colapsar (subitens somem)', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/today']}>
        <ShellSidebar collapsed={false} onToggle={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Esta Semana')).toBeInTheDocument()

    rerender(
      <MemoryRouter initialEntries={['/today']}>
        <ShellSidebar collapsed={true} onToggle={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.queryByText('Esta Semana')).not.toBeInTheDocument()
  })
})

describe('ShellSidebar — Brain Dump (AC7)', () => {
  it('destino Brain Dump tem nome acessível no expandido e no rail', () => {
    const { unmount } = renderSidebar({ initialPath: '/today' })
    expect(screen.getByRole('button', { name: /brain dump/i })).toBeInTheDocument()
    unmount()

    renderSidebar({ collapsed: true, initialPath: '/today' })
    expect(screen.getByRole('button', { name: 'Brain Dump' })).toBeInTheDocument()
  })

  it('passa o cap max={9} e o estilo app-shell-badge ao BrainDumpBadge (integração do shell)', () => {
    renderSidebar({ initialPath: '/today' })

    const badge = screen.getByTestId('brain-dump-badge')
    expect(badge).toHaveAttribute('data-max', '9')
    // Os 4 tokens do `{components.app-shell-badge}` entram pelo `badgeSx`
    // (o comportamento visual `9+`/oculto fica em BrainDumpBadge.test.tsx).
    expect(JSON.parse(badge.getAttribute('data-badge-sx') as string)).toEqual({
      backgroundColor: 'var(--ds-primary)',
      color: 'var(--ds-on-primary)',
      minHeight: 'var(--ds-badge-min-height)',
      borderRadius: 'var(--ds-radius-full)',
    })
  })
})

describe('ShellSidebar — acessibilidade (AC4/AC5)', () => {
  it('sem violações de acessibilidade (expandido)', async () => {
    const { container } = renderSidebar({ initialPath: '/today' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações de acessibilidade (rail)', async () => {
    const { container } = renderSidebar({ collapsed: true, initialPath: '/today' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('não importa nenhum ícone @mui/icons-material (catálogo Phosphor fechado)', () => {
    // Checa o IMPORT (não menções em comentário).
    expect(shellSidebarSource).not.toMatch(/from\s+['"]@mui\/icons-material/)
    expect(navIconsSource).not.toMatch(/from\s+['"]@mui\/icons-material/)
    // Os ícones vêm do catálogo Phosphor.
    expect(navIconsSource).toMatch(/from\s+['"]@phosphor-icons\/react['"]/)
  })

  it('larguras vêm dos tokens (AC6: zero literais estruturais 56/240)', () => {
    // As larguras usam exclusivamente os tokens do rail (240/64), nunca literais.
    expect(shellSidebarSource).toContain('var(--ds-sidebar-expanded)')
    expect(shellSidebarSource).toContain('var(--ds-sidebar-collapsed)')
    // Sem os literais do legado (DIV-1: 56→64).
    expect(shellSidebarSource).not.toContain('COLLAPSED_WIDTH')
    expect(shellSidebarSource).not.toContain('DRAWER_WIDTH')
  })
})
