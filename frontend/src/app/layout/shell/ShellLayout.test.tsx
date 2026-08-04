import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { ShellLayout, SHELL_CONTENT_ID } from './ShellLayout'
import { appShell } from '../../../shared/design/tokens'

vi.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    sessionExpired: false,
    userId: 'user-1',
    login: vi.fn(),
    logout: vi.fn(),
  })),
}))

// BrainDumpBadge/BrainDumpCaptureSheet usam TanStack Query direto — mesmo mock
// do AppLayout.test.tsx. O registro do shell é dados puros: nenhum mock NOVO de
// Query é necessário por causa dele (AC 7).
//
// `compact`/`disabled`/`disabledReason` são surfaced no mock (mesmo padrão de
// `BrainDumpInboxCaptureForm` em `BrainDumpInboxPage.test.tsx:39-42`) para que
// os testes provem que o `ShellLayout` de fato CALCULA e REPASSA essas props
// (Story 15.2) — sem isso, um valor invertido ou solto (ex.: `disabled=
// {isOnline}`) passaria despercebido por qualquer teste existente.
vi.mock('../../../features/braindump', () => ({
  BrainDumpBadge: ({ children }: { children: React.ReactNode }) => children,
  BrainDumpCaptureSheet: ({
    open,
    compact,
    disabled,
    disabledReason,
  }: {
    open: boolean
    compact?: boolean
    disabled?: boolean
    disabledReason?: string
  }) =>
    open ? (
      <div>
        capture sheet aberto
        <span data-testid="capture-sheet-compact">{String(compact)}</span>
        <span data-testid="capture-sheet-disabled">{String(disabled)}</span>
        {disabled && <span>{disabledReason}</span>}
      </div>
    ) : null,
}))

function mockMatchMedia(desktop: boolean, compact: boolean, tablet = false) {
  ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
    matches: (() => {
      if (query === '(min-width: 1024px)') return desktop
      if (query === '(max-width: 767px)') return compact
      if (query === '(min-width: 768px) and (max-width: 1023px)') return tablet
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

function renderShell(options: { surfaceMigrated?: boolean; initialEntry?: string } = {}) {
  const { surfaceMigrated = false, initialEntry = '/today' } = options
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <ThemeProvider theme={createBujoTheme('light')}>
            <ShellLayout surfaceMigrated={surfaceMigrated} />
          </ThemeProvider>
        ),
        children: [
          { index: true, element: <main aria-label="Início">conteúdo</main> },
          {
            path: 'today',
            element: <main aria-label="Hoje">conteúdo hoje</main>,
            handle: { title: 'Hoje' },
          },
          {
            path: 'brain-dump',
            element: <main aria-label="Brain Dump">conteúdo brain dump</main>,
            handle: { title: 'Brain Dump' },
          },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  )
  return render(<RouterProvider router={router} />)
}

describe('ShellLayout — topbar e workspace', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('test_topbar_e_header_e_mostra_o_nome_da_superficie_atual', () => {
    mockMatchMedia(true, false)
    renderShell()

    const header = screen.getByRole('banner')
    expect(header).toHaveTextContent('Hoje')
  })

  it('test_topbar_nao_e_live_region_o_anuncio_segue_exclusivo_do_route_announcer', () => {
    mockMatchMedia(true, false)
    renderShell()

    // Uma única live region na casca: a do RouteAnnouncer.
    const liveRegions = screen.getAllByRole('status')
    expect(liveRegions).toHaveLength(1)
    expect(liveRegions[0]).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('banner')).not.toHaveAttribute('aria-live')
  })

  it('test_shell_nao_introduz_um_segundo_main', () => {
    mockMatchMedia(true, false)
    renderShell()

    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('main')).toHaveAccessibleName('Hoje')
  })

  it('test_workspace_aplica_os_tokens_ds_no_elemento_raiz_do_shell', () => {
    mockMatchMedia(true, false)
    renderShell()

    const root = screen.getByTestId('shell-root')
    expect(root.style.getPropertyValue('--ds-topbar-height')).toBe(appShell.topbarHeight)
    expect(root.style.getPropertyValue('--ds-workspace-max-width')).toBe(
      appShell.workspaceMaxWidth,
    )
    expect(root.style.getPropertyValue('--ds-gutter-wide')).toBe(appShell.gutterWide)
    expect(root.style.getPropertyValue('--ds-canvas')).toBe('#F5F2EA')
  })

  it('test_desktop_mostra_sidebar_e_oculta_bottom_nav', () => {
    mockMatchMedia(true, false)
    renderShell()

    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
    // Landmark da ShellBottomNav nova (13.3) — "Navegação mobile" era a legada.
    expect(screen.queryByRole('navigation', { name: 'Atalhos de navegação' })).not.toBeInTheDocument()
  })

  it('test_compact_tem_topbar_e_bottom_nav_e_nao_tem_sidebar', () => {
    mockMatchMedia(false, true)
    renderShell()

    // Regressão de contrato: o mobile do AppLayout legado NÃO tinha topbar.
    // Troca contratada de landmark (AC4 da 13.3): a bottom nav nova é
    // "Atalhos de navegação" ("Navegação mobile" era a BottomNav legada).
    expect(screen.getByRole('banner')).toHaveTextContent('Hoje')
    expect(screen.getByRole('navigation', { name: 'Atalhos de navegação' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegação mobile' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument()
  })

  it('test_compact_tem_fab_de_captura_que_abre_o_capture_sheet_unico', async () => {
    mockMatchMedia(false, true)
    const user = userEvent.setup()
    renderShell()

    const fab = screen.getByRole('button', { name: 'Abrir captura rápida' })
    expect(fab).toBeInTheDocument()
    expect(screen.queryByText('capture sheet aberto')).not.toBeInTheDocument()

    await user.click(fab)
    expect(screen.getByText('capture sheet aberto')).toBeInTheDocument()
    // `ShellLayout` repassa `compact={isCompact}` — no compact, `true`.
    expect(screen.getByTestId('capture-sheet-compact')).toHaveTextContent('true')
  })

  it('test_desktop_nao_tem_fab_mas_a_ancora_da_sidebar_abre_o_mesmo_sheet', async () => {
    mockMatchMedia(true, false)
    const user = userEvent.setup()
    renderShell()

    // FAB e âncora da sidebar compartilham o MESMO nome acessível
    // ("Abrir captura rápida", paridade corrigida na Story 15.2) — no
    // desktop só a âncora existe (o bloco do FAB nem renderiza fora do
    // compact), então a prova de "sem FAB duplicado" é exatamente um
    // elemento com esse nome, não zero.
    expect(screen.getAllByRole('button', { name: 'Abrir captura rápida' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Abrir captura rápida' }))
    expect(screen.getByText('capture sheet aberto')).toBeInTheDocument()
    // `ShellLayout` repassa `compact={isCompact}` — fora do compact, `false`.
    expect(screen.getByTestId('capture-sheet-compact')).toHaveTextContent('false')
  })

  it('test_capture_sheet_recebe_disabled_e_disabledReason_ao_ficar_offline_com_o_sheet_aberto', async () => {
    mockMatchMedia(true, false)
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: 'Abrir captura rápida' }))
    // Online (default de jsdom): `disabled` chega `false`, sem motivo.
    expect(screen.getByTestId('capture-sheet-disabled')).toHaveTextContent('false')
    expect(screen.queryByText('Sem conexão. Esta ação exige rede.')).not.toBeInTheDocument()

    // Perde conexão com o sheet JÁ aberto (I/O Matrix) — mesmo evento nativo
    // que `useOnlineStatus.test.ts` usa para simular a transição pós-mount
    // (`navigator.onLine` só cobre o estado NA MONTAGEM).
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByTestId('capture-sheet-disabled')).toHaveTextContent('true')
    expect(screen.getByText('Sem conexão. Esta ação exige rede.')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.getByTestId('capture-sheet-disabled')).toHaveTextContent('false')
  })

  it('test_compact_reserva_padding_bottom_para_bottom_nav_e_safe_area', () => {
    mockMatchMedia(false, true)
    renderShell()

    const workspace = screen.getByTestId('shell-workspace')
    // Paridade de FÓRMULA com AppLayout.tsx:55 — calc(bottom-nav + safe-area +
    // 8px), aqui via tokens: bottom-nav-height (64px desde a 13.3) + safe-area
    // + space-2 (8px).
    const paddingBottom = workspace.style.paddingBottom
    expect(paddingBottom).toContain('var(--ds-bottom-nav-height)')
    expect(paddingBottom).toContain('env(safe-area-inset-bottom, 0px)')
    expect(paddingBottom).toContain('var(--ds-space-2)')
  })

  it('test_workspace_reserva_scroll_padding_para_o_chrome_fixo', () => {
    mockMatchMedia(false, true)
    renderShell()

    const workspace = screen.getByTestId('shell-workspace')
    expect(workspace.style.scrollPaddingTop).toContain('--ds-topbar-height')
    expect(workspace.style.scrollPaddingBottom).toContain('--ds-bottom-nav-height')
    expect(workspace.style.scrollPaddingBottom).toContain('--ds-capture-fab-size')
  })

  it('test_sair_do_compact_fecha_o_sheet_e_voltar_nao_o_reabre_sozinho', async () => {
    // O mock padrão do arquivo devolve um objeto novo (com `matches` congelado)
    // a cada chamada; `useMediaQuery` captura UM MediaQueryList por query, então
    // simular a troca de faixa exige `matches` como getter + o listener de
    // `change` guardado para ser disparado.
    const listeners: Array<() => void> = []
    let compact = true
    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      get matches() {
        return query === '(max-width: 767px)' ? compact : false
      },
      media: query,
      onchange: null,
      addListener: (cb: () => void) => listeners.push(cb),
      removeListener: vi.fn(),
      addEventListener: (_event: string, cb: () => void) => listeners.push(cb),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const changeBreakpoint = (toCompact: boolean) => {
      compact = toCompact
      act(() => {
        listeners.forEach((notify) => notify())
      })
    }

    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('navigation', { name: 'Navegação completa' })).toBeInTheDocument()

    // Sair do compact desmonta o chrome mobile inteiro (barra + sheet).
    changeBreakpoint(false)
    await waitFor(() => {
      expect(
        screen.queryByRole('navigation', { name: 'Navegação completa' }),
      ).not.toBeInTheDocument()
    })

    // Voltar ao compact traz a barra de volta — mas NÃO o sheet: reabrir um
    // Modal sem ação do usuário prenderia o foco sem aviso.
    changeBreakpoint(true)
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Atalhos de navegação' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('navigation', { name: 'Navegação completa' })).not.toBeInTheDocument()
  })

  it('test_tablet_inicia_com_a_sidebar_colapsada', async () => {
    mockMatchMedia(false, false, true)
    renderShell()

    await waitFor(() => {
      expect(screen.queryByText('Planner')).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('navigation', { name: 'Atalhos de navegação' })).not.toBeInTheDocument()
  })
})

describe('ShellLayout — contrato acessível', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('test_skip_link_e_o_primeiro_elemento_focavel', async () => {
    mockMatchMedia(true, false)
    const user = userEvent.setup()
    renderShell()

    await user.tab()

    expect(document.activeElement).toHaveTextContent('Pular para o conteúdo')
  })

  it('test_skip_link_move_o_foco_para_o_wrapper_de_conteudo', async () => {
    mockMatchMedia(true, false)
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('link', { name: 'Pular para o conteúdo' }))

    expect(document.activeElement).toBe(document.getElementById(SHELL_CONTENT_ID))
    expect(document.activeElement).toHaveAttribute('tabindex', '-1')
  })

  it('test_alvo_do_skip_link_envolve_o_outlet_sem_ser_um_main', () => {
    mockMatchMedia(true, false)
    renderShell()

    const target = document.getElementById(SHELL_CONTENT_ID)
    expect(target).not.toBeNull()
    expect(target?.tagName.toLowerCase()).not.toBe('main')
    expect(target).toContainElement(screen.getByRole('main'))
  })

  it('test_sem_violacoes_de_acessibilidade (wide)', async () => {
    mockMatchMedia(true, false)
    const { container } = renderShell()

    expect(await axe(container)).toHaveNoViolations()
  })

  it('test_sem_violacoes_de_acessibilidade (compact)', async () => {
    mockMatchMedia(false, true)
    const { container } = renderShell()

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('ShellLayout — atalhos preservados do AppLayout legado', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('test_atalho_colchete_faz_toggle_da_sidebar_no_desktop', () => {
    mockMatchMedia(true, false)
    renderShell()

    expect(screen.getByText('Planner')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: '[' })
    expect(screen.queryByText('Planner')).not.toBeInTheDocument()
  })

  it('test_atalho_colchete_ignorado_em_campo_editavel', () => {
    mockMatchMedia(true, false)
    renderShell()

    const inputEl = document.createElement('input')
    document.body.appendChild(inputEl)
    inputEl.focus()

    fireEvent.keyDown(inputEl, { key: '[' })

    expect(screen.getByText('Planner')).toBeInTheDocument()
    document.body.removeChild(inputEl)
  })

  it('test_atalho_b_navega_para_brain_dump_no_desktop', () => {
    mockMatchMedia(true, false)
    renderShell()

    fireEvent.keyDown(window, { key: 'b' })

    expect(screen.getByText('conteúdo brain dump')).toBeInTheDocument()
  })

  it('test_atalho_b_ignorado_com_ctrl_meta_ou_alt', () => {
    mockMatchMedia(true, false)
    renderShell()

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'b', metaKey: true })
    fireEvent.keyDown(window, { key: 'B', altKey: true })

    // Sem o guard, Cmd+B/Ctrl+B do navegador seriam sequestrados.
    expect(screen.queryByText('conteúdo brain dump')).not.toBeInTheDocument()
  })

  it('test_atalho_b_ignorado_em_campo_editavel', () => {
    mockMatchMedia(true, false)
    renderShell()

    const inputEl = document.createElement('input')
    document.body.appendChild(inputEl)
    inputEl.focus()

    fireEvent.keyDown(inputEl, { key: 'b' })

    expect(screen.queryByText('conteúdo brain dump')).not.toBeInTheDocument()
    document.body.removeChild(inputEl)
  })

  it('test_atalhos_ignorados_fora_do_desktop', () => {
    mockMatchMedia(false, true)
    renderShell()

    fireEvent.keyDown(window, { key: 'b' })

    expect(screen.queryByText('conteúdo brain dump')).not.toBeInTheDocument()
  })
})

describe('ShellLayout — seam legado por superfície', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('test_superficie_legada_mostra_o_seam_no_inicio_do_conteudo', () => {
    mockMatchMedia(true, false)
    renderShell({ surfaceMigrated: false })

    const seam = screen.getByText(/Esta área ainda usa a versão anterior/)
    const target = document.getElementById(SHELL_CONTENT_ID)
    expect(target).toContainElement(seam)
    // "no início do conteúdo": antes do <main> da página.
    expect(seam.compareDocumentPosition(screen.getByRole('main'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('test_superficie_migrada_nao_mostra_o_seam', () => {
    mockMatchMedia(true, false)
    renderShell({ surfaceMigrated: true })

    expect(screen.queryByText(/Esta área ainda usa a versão anterior/)).not.toBeInTheDocument()
  })
})
