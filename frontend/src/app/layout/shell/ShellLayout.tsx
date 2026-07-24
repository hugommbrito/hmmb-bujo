import { useEffect, useState } from 'react'
import { Box, useMediaQuery, useTheme } from '@mui/material'
import { Outlet, useNavigate } from 'react-router-dom'

import { Sidebar } from '../Sidebar'
import { BottomNav } from '../BottomNav'
import { RouteAnnouncer } from '../RouteAnnouncer'
import { ShellTopbar } from './ShellTopbar'
import { SkipLink } from './SkipLink'
import { LegacySeamNotice } from './LegacySeamNotice'
import { mediaQueries, shellCssVariables } from '../../../shared/design/tokens'

/**
 * `id` do wrapper de conteúdo do shell — alvo do skip link.
 *
 * **Decisão deliberada:** o shell NÃO renderiza `<main>`. As páginas já
 * renderizam o seu (`<main aria-label="…">`) e há testes de regressão
 * explícitos contra um segundo `main` (`router.test.tsx`,
 * `RouteAnnouncer.test.tsx`). O wrapper focável (`tabIndex={-1}`) preserva
 * "um único `main` por rota" e ainda entrega o pulo de foco.
 */
export const SHELL_CONTENT_ID = 'conteudo-da-superficie'

interface ShellLayoutProps {
  /**
   * A superfície interna desta rota já foi migrada? Vem do registro puro
   * `shellRouting.ts`, resolvido pelo `ProtectedLayout`. `false` ⇒ seam visível.
   */
  surfaceMigrated?: boolean
}

/**
 * Casca nova do app: topbar de 56px, canvas contínuo e workspace de até 1440px.
 *
 * Composição wide/medium/tablet: `[coluna de navegação][shellbody]`, com
 * `shellbody` em `grid-template-rows: <topbar> minmax(0, 1fr)`. A topbar
 * **não** atravessa a coluna da navegação — o paper do `Drawer` permanente é
 * `position: fixed`, então uma topbar full-width cobriria o botão de colapso
 * (mockup `key-app-shell-13-0.html`, `.browser`/`.shellbody`).
 *
 * `AppLayout.tsx` permanece intocado como casca de rollback; `Sidebar` e
 * `BottomNav` são renderizados **sem alteração** (a sidebar derivada do
 * manifest é a Story 13.2; a bottom nav de 3 atalhos + Menu é a 13.3).
 *
 * Zero literais estruturais: toda a geometria vem de `--ds-*`
 * (`shared/design/tokens.ts`), aplicadas inline na raiz do shell. CSS custom
 * properties só afetam quem as lê — o conteúdo legado dentro do shell não é
 * repintado, que é exatamente o que o seam promete.
 */
export function ShellLayout({ surfaceMigrated = false }: ShellLayoutProps) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(mediaQueries.desktop)
  const isTablet = useMediaQuery(mediaQueries.tablet)
  const isCompact = useMediaQuery(mediaQueries.compact)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const navigate = useNavigate()

  // Tablet: sidebar começa colapsada (paridade com o AppLayout legado).
  useEffect(() => {
    if (isTablet) {
      setSidebarCollapsed(true)
    }
  }, [isTablet])

  // Atalho [ para toggle da sidebar / B para o Brain Dump — ambos globais,
  // só no desktop. Guards idênticos aos do AppLayout legado: sem o guard de
  // ctrlKey/metaKey/altKey, Cmd+B/Ctrl+B (atalhos nativos do navegador/OS em
  // algumas plataformas) seriam sequestrados.
  useEffect(() => {
    if (!isDesktop) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if (isEditable) return

      if (event.key === '[') {
        setSidebarCollapsed((prev) => !prev)
      } else if (event.key === 'b' || event.key === 'B') {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        navigate('/brain-dump')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDesktop, navigate])

  const cssVariables = shellCssVariables(theme.palette.mode === 'dark' ? 'dark' : 'light')

  // Nenhum controle focado pode ficar encoberto por chrome fixo/sticky
  // (WCAG 2.2 `2.4.11 Focus Not Obscured`): o scroll padding reserva topbar
  // (+ banner de DEV) no topo e, no compact, bottom nav + FAB + safe-area.
  const workspaceInlineStyle: React.CSSProperties = {
    scrollPaddingTop: 'calc(var(--ds-topbar-height) + var(--dev-banner-height))',
    ...(isCompact
      ? {
          // Paridade com AppLayout.tsx:55 — a última linha de conteúdo não pode
          // ficar sob a bottom nav.
          paddingBottom:
            'calc(var(--ds-bottom-nav-height) + env(safe-area-inset-bottom, 0px) + var(--ds-space-2))',
          scrollPaddingBottom:
            'calc(var(--ds-bottom-nav-height) + var(--ds-capture-fab-size) + env(safe-area-inset-bottom, 0px) + var(--ds-space-4))',
        }
      : {}),
  }

  return (
    <Box
      data-testid="shell-root"
      style={cssVariables}
      sx={{
        display: 'flex',
        // O banner de DEV empurra o documento em `--dev-banner-height`
        // (index.css). Descontar aqui mantém o scroll interno do workspace
        // exato em DEV e em PROD (onde a var vale 0px).
        height: 'calc(100svh - var(--dev-banner-height))',
        background: 'var(--ds-canvas)',
        color: 'var(--ds-ink)',
        '& :focus-visible': {
          outline: 'var(--ds-focus-ring-width) solid var(--ds-focus)',
          outlineOffset: 'var(--ds-focus-ring-offset)',
        },
      }}
    >
      <SkipLink targetId={SHELL_CONTENT_ID} />
      <RouteAnnouncer />

      {/* A `nav` "Navegação principal" já existe na Sidebar — não duplicar. */}
      {!isCompact && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateRows: 'var(--ds-topbar-height) minmax(0, 1fr)',
          flexGrow: 1,
          minWidth: 0,
        }}
      >
        <ShellTopbar />

        <Box
          data-testid="shell-workspace"
          style={workspaceInlineStyle}
          sx={{
            overflow: 'auto',
            background: 'var(--ds-canvas)',
            px: 'var(--ds-gutter-compact)',
            py: 'var(--ds-gutter-compact)',
            [`@media ${mediaQueries.tabletUp}`]: {
              px: 'var(--ds-gutter-medium)',
              py: 'var(--ds-gutter-medium)',
            },
            [`@media ${mediaQueries.wideUp}`]: {
              px: 'var(--ds-gutter-wide)',
              py: 'var(--ds-gutter-wide)',
            },
          }}
        >
          <Box
            id={SHELL_CONTENT_ID}
            tabIndex={-1}
            sx={{
              maxWidth: 'var(--ds-workspace-max-width)',
              marginInline: 'auto',
              minWidth: 0,
              // Alvo programático do skip link: o anel de foco pertence aos
              // controles, não ao wrapper.
              outline: 'none',
            }}
          >
            {!surfaceMigrated && <LegacySeamNotice />}
            <Outlet />
          </Box>
        </Box>
      </Box>

      {isCompact && <BottomNav />}
    </Box>
  )
}
