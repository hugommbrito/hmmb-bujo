import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { MemoryRouter, useLocation } from 'react-router-dom'

// Padrão de chrome: barrel `features/braindump` mockado SEM Query (AC1); o mock
// rico expõe as props em data-attrs (integração `max`/`badgeSx`, padrão 13.2).
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

import { ShellNavigationSheet } from './ShellNavigationSheet'
import { collections as registry } from '../../collections/registry'
import type { CollectionManifestEntry } from '../../collections/registry'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{location.pathname}</div>
}

/** Harness com acionador real: prova a restauração de foco do Modal. */
function SheetHarness({
  startOpen = false,
  collections,
}: {
  startOpen?: boolean
  collections?: CollectionManifestEntry[]
}) {
  const [open, setOpen] = useState(startOpen)
  return (
    <>
      <button onClick={() => setOpen(true)}>Menu</button>
      <ShellNavigationSheet
        open={open}
        onClose={() => setOpen(false)}
        {...(collections ? { collections } : {})}
      />
      <LocationProbe />
    </>
  )
}

function renderSheet(
  props: { initialPath?: string; startOpen?: boolean; collections?: CollectionManifestEntry[] } = {},
) {
  const { initialPath = '/today', ...harness } = props
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SheetHarness {...harness} />
    </MemoryRouter>,
  )
}

/** a aparece ANTES de b no DOM? */
function precedes(a: Element, b: Element) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

const CANONICAL_ORDER = [
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
]

describe('ShellNavigationSheet — conteúdo canônico (AC3)', () => {
  it('lista TODOS os destinos (inclusive os 3 atalhos) na ordem canônica da sidebar', () => {
    renderSheet({ startOpen: true })

    for (const label of CANONICAL_ORDER) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    for (let i = 0; i < CANONICAL_ORDER.length - 1; i += 1) {
      expect(
        precedes(screen.getByText(CANONICAL_ORDER[i]), screen.getByText(CANONICAL_ORDER[i + 1])),
      ).toBe(true)
    }
  })

  it('landmark é a nav "Navegação completa", com header e botão Fechar', () => {
    renderSheet({ startOpen: true })

    const nav = screen.getByRole('navigation', { name: 'Navegação completa' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByText('Navegação')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
  })

  it('nav mínima via seam: zero collections sem grupos/headings vazios', () => {
    renderSheet({ startOpen: true, collections: [] })

    for (const label of ['Hoje', 'Planner', 'Esta Semana', 'Brain Dump', 'Arquivo', 'Configurações']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByText('Saúde')).not.toBeInTheDocument()
    expect(screen.queryByText('Hábitos')).not.toBeInTheDocument()
    expect(screen.queryByText('Gratidão')).not.toBeInTheDocument()
    expect(screen.queryByText('Collections')).not.toBeInTheDocument()
  })

  it('nav mínima via seam: uma única collection aparece sem o resto', () => {
    const onlyHabits = registry.filter((c) => c.id === 'habits')
    renderSheet({ startOpen: true, collections: onlyHabits })

    expect(screen.getByText('Hábitos')).toBeInTheDocument()
    expect(screen.queryByText('Saúde')).not.toBeInTheDocument()
    expect(screen.queryByText('Gratidão')).not.toBeInTheDocument()
  })

  it('Brain Dump carrega o badge com o contrato do shell (max 9 + badgeSx)', () => {
    renderSheet({ startOpen: true })

    const badge = screen.getByTestId('brain-dump-badge')
    expect(badge).toHaveAttribute('data-max', '9')
    expect(JSON.parse(badge.getAttribute('data-badge-sx') as string)).toEqual({
      backgroundColor: 'var(--ds-primary)',
      color: 'var(--ds-on-primary)',
      minHeight: 'var(--ds-badge-min-height)',
      borderRadius: 'var(--ds-radius-full)',
    })
  })
})

describe('ShellNavigationSheet — estado ativo e agrupadores (AC3)', () => {
  it('destino ativo tem aria-current="page"; agrupadores expõem aria-expanded, nunca aria-current', () => {
    renderSheet({ startOpen: true, initialPath: '/today' })

    expect(screen.getByRole('button', { name: /hoje/i })).toHaveAttribute('aria-current', 'page')
    const planner = screen.getByRole('button', { name: /planner/i })
    expect(planner).toHaveAttribute('aria-expanded', 'true')
    expect(planner).not.toHaveAttribute('aria-current')
  })

  it('rota de histórico marca o destino pai como ativo (prefixo, igual à bottom nav)', () => {
    // `/health/metrics/history` é rota REAL da collection: com match exato o
    // sheet ficaria sem nenhum destino ativo (AC3/AC4).
    renderSheet({ startOpen: true, initialPath: '/health/metrics/history' })

    expect(screen.getByRole('button', { name: /Métricas/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // Exatamente UM destino ativo na navegação completa — o agrupador Saúde
    // continua só com aria-expanded.
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Saúde/ })).not.toHaveAttribute('aria-current')
  })

  it('agrupador alterna aria-expanded e recolhe os filhos (estado só na sessão)', async () => {
    const user = userEvent.setup()
    renderSheet({ startOpen: true })

    const planner = screen.getByRole('button', { name: /planner/i })
    await user.click(planner)
    expect(planner).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => {
      expect(screen.queryByText('Esta Semana')).not.toBeInTheDocument()
    })
  })
})

describe('ShellNavigationSheet — foco e fechamento (AC4)', () => {
  it('foco inicial vai ao destino ativo (nunca ao Fechar)', async () => {
    const user = userEvent.setup()
    renderSheet({ initialPath: '/today' })

    await user.click(screen.getByRole('button', { name: 'Menu' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hoje/i })).toHaveFocus()
    })
    expect(screen.getByRole('button', { name: 'Fechar' })).not.toHaveFocus()
  })

  it('rota fora da lista: foco inicial no primeiro destino', async () => {
    const user = userEvent.setup()
    renderSheet({ initialPath: '/rota-desconhecida' })

    await user.click(screen.getByRole('button', { name: 'Menu' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hoje/i })).toHaveFocus()
    })
  })

  it('grupo da rota ativa recolhido: foco inicial cai no primeiro destino VISÍVEL', async () => {
    const user = userEvent.setup()
    renderSheet({ initialPath: '/planner/week' })

    // Abre, recolhe o Planner (onde vive a rota ativa) e fecha sem navegar.
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Esta Semana' })).toHaveFocus()
    })
    await user.click(screen.getByRole('button', { name: /planner/i }))
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('navigation', { name: 'Navegação completa' }),
      ).not.toBeInTheDocument()
    })

    // Reabrir: o destino ativo NÃO está renderizado (`Collapse unmountOnExit`),
    // então o foco inicial não pode ficar órfão — vai ao primeiro item visível.
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hoje/i })).toHaveFocus()
    })
  })

  it('reexpandir um agrupador NÃO rouba o foco do próprio agrupador', async () => {
    const user = userEvent.setup()
    renderSheet({ initialPath: '/planner/week' })

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    // Espera o foco inicial assentar antes de mexer nos grupos.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Esta Semana' })).toHaveFocus()
    })

    const planner = screen.getByRole('button', { name: /planner/i })
    await user.click(planner)
    await user.click(planner)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Esta Semana' })).toBeInTheDocument()
    })

    // Acionar um controle não move o foco para outro lugar (WCAG 3.2.1): o
    // remount dos filhos pelo `Collapse` não reaplica o foco inicial.
    expect(planner).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Esta Semana' })).not.toHaveFocus()
  })

  it('navegar fecha o sheet', async () => {
    const user = userEvent.setup()
    renderSheet({ startOpen: true, initialPath: '/today' })

    await user.click(screen.getByRole('button', { name: /arquivo/i }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/archive')
    await waitFor(() => {
      expect(
        screen.queryByRole('navigation', { name: 'Navegação completa' }),
      ).not.toBeInTheDocument()
    })
  })

  it('fechar sem navegar devolve o foco ao acionador (restauração do Modal)', async () => {
    const user = userEvent.setup()
    renderSheet({ initialPath: '/today' })

    const trigger = screen.getByRole('button', { name: 'Menu' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    await waitFor(() => {
      expect(
        screen.queryByRole('navigation', { name: 'Navegação completa' }),
      ).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(trigger).toHaveFocus()
    })
  })

  it('Escape fecha o sheet', async () => {
    const user = userEvent.setup()
    renderSheet({ initialPath: '/today' })

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('navigation', { name: 'Navegação completa' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(
        screen.queryByRole('navigation', { name: 'Navegação completa' }),
      ).not.toBeInTheDocument()
    })
  })
})

describe('ShellNavigationSheet — acessibilidade (AC4)', () => {
  it('sem violações de acessibilidade no conteúdo do sheet', async () => {
    renderSheet({ startOpen: true })

    // O Drawer renderiza num portal fora do container do render — o gate roda
    // no próprio landmark do sheet (o gate de página completa é o axe real do
    // Playwright em shell-a11y.spec.ts).
    const nav = screen.getByRole('navigation', { name: 'Navegação completa' })
    expect(await axe(nav)).toHaveNoViolations()
  })
})
