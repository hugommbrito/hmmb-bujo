import { useEffect, useState } from 'react'
import { Box, ButtonBase, Tooltip, useMediaQuery, useTheme } from '@mui/material'
import { Outlet, useNavigate } from 'react-router-dom'

import { ShellSidebar } from './ShellSidebar'
import { ShellBottomNav } from './ShellBottomNav'
import { ShellNavigationSheet } from './ShellNavigationSheet'
import { RouteAnnouncer } from '../RouteAnnouncer'
import { ShellTopbar } from './ShellTopbar'
import { SkipLink } from './SkipLink'
import { LegacySeamNotice } from './LegacySeamNotice'
import { BrainDumpBadge, BrainDumpCaptureSheet } from '../../../features/braindump'
import { useOnlineStatus } from '../../../shared/hooks/useOnlineStatus'
import { mediaQueries, shellCssVariables } from '../../../shared/design/tokens'
import { navIcons } from './navIcons'
import { SHELL_BADGE_SX } from './shellDestinations'

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

/** Mesmo texto de `BrainDumpInboxPage.tsx:35` — replicado aqui porque o
 * Capture Sheet do shell é um consumidor independente daquela página. */
const OFFLINE_REASON = 'Sem conexão. Esta ação exige rede.'

/**
 * Ícone do FAB de captura maior que o `NAV_ICON_SIZE` (20px) dos itens de nav:
 * o mockup usa ~24px no FAB para presença visual na área de 52px
 * (`--ds-capture-fab-size`). Decisão interina da Questão Aberta 2 da story,
 * registrada no checklist de paridade — constante nomeada, nunca literal solto.
 */
const CAPTURE_FAB_ICON_SIZE = 24
const CaptureFabIcon = navIcons['capture']

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
 * `AppLayout.tsx` permanece intocado como casca de rollback (segue renderizando
 * a `Sidebar` e a `BottomNav` legadas). O shell novo renderiza a `ShellSidebar`
 * derivada do manifest (Story 13.2) e, no compact, a `ShellBottomNav` (3
 * atalhos + Menu), o sheet de navegação completa e o FAB de captura (13.3). A
 * captura persistente usa UMA instância do `BrainDumpCaptureSheet` (superfície
 * legada até a Onda 4 — Épico 15) para todos os breakpoints: FAB no compact,
 * âncora na navegação em desktop/tablet.
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
  // Captura persistente (13.3): UMA instância do BrainDumpCaptureSheet para
  // todos os breakpoints, aberta pelo FAB (compact) ou pela âncora da sidebar.
  const [captureOpen, setCaptureOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isOnline = useOnlineStatus()
  const navigate = useNavigate()

  // Tablet: sidebar começa colapsada (paridade com o AppLayout legado).
  useEffect(() => {
    if (isTablet) {
      setSidebarCollapsed(true)
    }
  }, [isTablet])

  // O sheet de navegação é chrome EXCLUSIVO do compact: sair da faixa o
  // desmonta, e sem este reset `menuOpen` continuaria true — ao voltar para o
  // compact (girar o dispositivo, redimensionar a janela) o sheet reapareceria
  // sozinho, sem ação do usuário, com o foco preso no Modal.
  useEffect(() => {
    if (!isCompact) {
      setMenuOpen(false)
    }
  }, [isCompact])

  // Atalho [ para toggle da sidebar / B para o Brain Dump — ambos globais,
  // só no desktop.
  //
  // Guards de AMBOS os atalhos (AC5 da Story 13.4: "ambos ignorados em
  // INPUT/TEXTAREA/contentEditable e com guard de ctrl/meta/alt"): sem o guard de
  // modificador, `Cmd+B`/`Ctrl+B` e `Cmd+[`/`Ctrl+[` — atalhos NATIVOS do
  // navegador/OS em algumas plataformas (`Cmd+[` é "voltar" no macOS) — seriam
  // sequestrados. O `AppLayout` legado guarda só o `B`; a review da 13.4 fechou a
  // assimetria no shell novo, onde a sidebar/rail de fato responde ao `[`.
  useEffect(() => {
    if (!isDesktop) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if (isEditable) return
      if (event.ctrlKey || event.metaKey || event.altKey) return

      if (event.key === '[') {
        setSidebarCollapsed((prev) => !prev)
      } else if (event.key === 'b' || event.key === 'B') {
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

      {/* A `nav` "Navegação principal" já existe na ShellSidebar — não duplicar. */}
      {!isCompact && (
        <ShellSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
          onOpenCapture={() => setCaptureOpen(true)}
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

      {isCompact && (
        <>
          <ShellBottomNav menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />

          {/* FAB de captura (`{components.capture-action}`): circular, FORA da
              bottom nav (mockup), acima dela e da safe-area (paridade FAB-01,
              via tokens). Offline: aria-disabled + guard no click — divergência
              contratada vs `disabled` nativo do legado FAB-03 (foco e
              identidade preservados, motivo acessível — AC6). */}
          <Tooltip title={isOnline ? '' : 'Sem conexão'}>
            <ButtonBase
              aria-label={isOnline ? 'Abrir captura rápida' : 'Abrir captura rápida (sem conexão)'}
              aria-disabled={isOnline ? undefined : true}
              onClick={() => {
                if (!isOnline) return
                setCaptureOpen(true)
              }}
              sx={{
                position: 'fixed',
                right: 'var(--ds-space-4)',
                bottom:
                  'calc(var(--ds-bottom-nav-height) + env(safe-area-inset-bottom, 0px) + var(--ds-space-4))',
                width: 'var(--ds-capture-fab-size)',
                height: 'var(--ds-capture-fab-size)',
                borderRadius: 'var(--ds-radius-full)',
                zIndex: 'appBar',
                boxShadow: 4,
                ...(isOnline
                  ? {
                      backgroundColor: 'var(--ds-primary)',
                      color: 'var(--ds-on-primary)',
                    }
                  : {
                      backgroundColor: 'var(--ds-surface-subtle)',
                      color: 'var(--ds-ink-disabled)',
                    }),
              }}
            >
              <BrainDumpBadge badgeSx={SHELL_BADGE_SX} max={9}>
                <CaptureFabIcon size={CAPTURE_FAB_ICON_SIZE} weight="regular" />
              </BrainDumpBadge>
            </ButtonBase>
          </Tooltip>

          <ShellNavigationSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
        </>
      )}

      {/* ÚNICA instância do sheet de captura no shell (FAB-05 sobe do BottomNav
          legado para cá): compartilhada por FAB (compact) e âncora da sidebar.
          `compact`/`disabled`/`disabledReason` são as únicas props novas
          (Story 15.2) — `ShellLayout` é o único chamador que alterna entre
          Dialog (ponteiro) e Drawer (compact). */}
      <BrainDumpCaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        compact={isCompact}
        disabled={!isOnline}
        disabledReason={OFFLINE_REASON}
      />
    </Box>
  )
}
