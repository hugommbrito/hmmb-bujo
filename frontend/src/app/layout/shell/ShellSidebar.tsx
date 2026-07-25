import { useState } from 'react'
import {
  Box,
  ButtonBase,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

import { BrainDumpBadge } from '../../../features/braindump'
import { useOnlineStatus } from '../../../shared/hooks/useOnlineStatus'
import type { CollectionManifestEntry } from '../../collections/registry'

import { navIcons, navIconFor, NAV_ICON_SIZE, type NavIconKey } from './navIcons'
import { ShellNavDestination } from './ShellNavDestination'
import {
  deriveShellNavItems,
  isDestinationActive,
  SHELL_BADGE_SX,
  type ShellDestination,
  type ShellDestinationGroup,
} from './shellDestinations'

/**
 * Sidebar do shell novo (240px expandida / 64px rail) derivada do registro de
 * collections (Story 12.3) + núcleo/chrome hardcoded. Substitui a `Sidebar`
 * legada (que permanece intocada como rota de rollback) só dentro do
 * `ShellLayout` (13.1).
 *
 *   ▶ SEM TanStack Query direto (AC1): a contagem do Brain Dump entra
 *     EXCLUSIVAMENTE encapsulada no `BrainDumpBadge` do barrel
 *     `features/braindump` — já mockado como passthrough nos 3 testes de chrome
 *     (`AppLayout`/`router`/`RouteAnnouncer`), que montam a árvore SEM
 *     `QueryClientProvider`. Nenhum hook de Query aqui; a captura abre pelo
 *     `BrainDumpCaptureSheet` único do `ShellLayout` via `onOpenCapture` (13.3).
 *
 *   ▶ Zero literais estruturais (AC6): larguras/espaços vêm de `var(--ds-*)`
 *     (`shared/design/tokens.ts`, aplicados na raiz do shell pelo `ShellLayout`).
 *
 *   ▶ Catálogo Phosphor FECHADO (AC4): ícones vêm só de `navIcons` — nenhum
 *     `@mui/icons-material`. O chevron do grupo é um glyph unicode decorativo
 *     (o catálogo fechado não define chevron; o mockup usa `&#8964;`), não um
 *     ícone de nenhuma das bibliotecas.
 *
 *   ▶ A ordem/estrutura canônica vem de `shellDestinations.ts` (Story 13.3) —
 *     a MESMA fonte da `ShellBottomNav` e do `ShellNavigationSheet`.
 *
 * [Source: Story 13.2; Story 13.3 AC5/AC6; DESIGN.md §App Shell / §Catálogo
 * Phosphor; mockup key-app-shell-13-0.html; 13-shell-parity-checklist.md]
 */
interface ShellSidebarProps {
  collapsed: boolean
  onToggle: () => void
  /**
   * Abre o `BrainDumpCaptureSheet` único do `ShellLayout` (âncora de captura —
   * `{components.capture-action}`, `desktop-anchor: navigation`).
   */
  onOpenCapture?: () => void
  /**
   * Seam de teste (Testing Requirements da 13.2): lista de collections a
   * derivar. PRODUÇÃO NUNCA passa isto — o `ShellLayout` chama só
   * `{ collapsed, onToggle, onOpenCapture }` e a derivação usa o registro puro.
   * Existe apenas para provar a "nav mínima" (zero/uma collection são estados
   * reais com o default all-off de convidados do Épico 10) por injeção, sem
   * mock de módulo.
   */
  collections?: CollectionManifestEntry[]
}

/** Mantém o nome/descrição no accessibility tree sem ocupar espaço no rail. */
const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const

export function ShellSidebar({
  collapsed,
  onToggle,
  onOpenCapture,
  collections,
}: ShellSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  // Estado de expansão por agrupador — só na sessão, nada persistido. Todo
  // grupo inicia aberto (paridade 13.2: `plannerOpen`/`healthOpen` = true).
  const [closedGroups, setClosedGroups] = useState<Partial<Record<NavIconKey, boolean>>>({})

  // ── Estrutura canônica (núcleo + collections filtradas — nav mínima) ────────
  const navItems = deriveShellNavItems(collections)

  const iconSx = { minWidth: collapsed ? 0 : 40, justifyContent: 'center', color: 'inherit' }

  // Um destino ativo combina 4+ canais (WCAG 1.4.1): indicador lateral 3px +
  // fundo primary-soft + label em peso forte + ícone `fill` + aria-current. O
  // markup vive na linha COMPARTILHADA com o `ShellNavigationSheet`
  // (`ShellNavDestination` — Story 13.4 AC3), e o "ativo" vem do predicado ÚNICO
  // das três superfícies (`isDestinationActive`, prefixo do próprio destino):
  // é a mudança de comportamento INTENCIONAL desta story (SHELL-DEBT-03), que
  // passa a marcar o destino pai nas rotas de histórico/parametrizadas.
  const renderDestination = (dest: ShellDestination) => (
    <ShellNavDestination
      key={dest.path}
      destination={dest}
      active={isDestinationActive(location.pathname, dest.path)}
      collapsed={collapsed}
      onActivate={() => navigate(dest.path)}
      withHover
    />
  )

  // Agrupador (Planner/Saúde): expõe aria-expanded, NUNCA aria-current. Quando
  // recolhido contendo a rota ativa, indica por indicador lateral + fundo sutil
  // (`.contains`) + descrição acessível — sem aria-current no agrupador (AC5).
  const renderGroup = (group: ShellDestinationGroup) => {
    const open = !closedGroups[group.key]
    const onToggleGroup = () =>
      setClosedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
    const groupVisuallyOpen = open && !collapsed
    const activeChild = group.children.find((c) =>
      isDestinationActive(location.pathname, c.path),
    )
    const showContains = Boolean(activeChild) && !groupVisuallyOpen
    const describedById = `${group.key}-active-destination`

    return (
      <Box key={group.key}>
        <ListItemButton
          onClick={() => {
            if (!collapsed) onToggleGroup()
          }}
          aria-expanded={groupVisuallyOpen}
          aria-label={collapsed ? group.label : undefined}
          aria-describedby={showContains ? describedById : undefined}
          sx={{
            borderLeft: '3px solid',
            borderLeftColor: showContains ? 'var(--ds-primary)' : 'transparent',
            backgroundColor: showContains ? 'var(--ds-surface-subtle)' : 'transparent',
            color: 'var(--ds-ink)',
            justifyContent: collapsed ? 'center' : 'flex-start',
            minHeight: 'var(--ds-touch-target-min)',
            px: collapsed ? 0 : 'var(--ds-space-2)',
            cursor: collapsed ? 'default' : 'pointer',
            '&:hover': { backgroundColor: 'var(--ds-surface-subtle)' },
          }}
        >
          {/* Guard de catálogo também no CABEÇALHO do grupo (AC2 da 13.4): um
              `nav.group` novo no registro degrada sem ícone em vez de derrubar
              o chrome inteiro — antes `navIcons[group.key]` era lido sem guard. */}
          <ListItemIcon sx={iconSx}>{navIconFor(group.key)}</ListItemIcon>
          {!collapsed && (
            <>
              <ListItemText
                primary={group.label}
                slotProps={{ primary: { fontWeight: activeChild ? 700 : 600 } }}
              />
              {/* Chevron: glyph unicode decorativo (fora do catálogo Phosphor e
                  sem @mui/icons-material). O botão já expõe aria-expanded. */}
              <Box component="span" aria-hidden sx={{ color: 'var(--ds-ink-muted)', fontSize: 14, lineHeight: 1 }}>
                {groupVisuallyOpen ? '⌃' : '⌄'}
              </Box>
            </>
          )}
        </ListItemButton>

        {showContains && (
          <Box
            component="p"
            id={describedById}
            sx={
              collapsed
                ? VISUALLY_HIDDEN
                : { m: 0, px: 'var(--ds-space-4)', color: 'var(--ds-ink-muted)', fontSize: 11 }
            }
          >
            Contém a página atual: {activeChild!.label}.
          </Box>
        )}

        <Collapse in={groupVisuallyOpen} timeout="auto" unmountOnExit>
          <List disablePadding component="div" sx={{ pl: 'var(--ds-space-2)' }}>
            {group.children.map((child) => renderDestination(child))}
          </List>
        </Collapse>
      </Box>
    )
  }

  const ToggleIcon = navIcons['sidebar-toggle']
  const CaptureIcon = navIcons['capture']
  const captureLabel = isOnline ? 'Abrir captura rápida' : 'Abrir captura rápida (sem conexão)'

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? 'var(--ds-sidebar-collapsed)' : 'var(--ds-sidebar-expanded)',
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? 'var(--ds-sidebar-collapsed)' : 'var(--ds-sidebar-expanded)',
          overflowX: 'hidden',
          transition: 'width 0.2s',
          boxSizing: 'border-box',
          backgroundColor: 'var(--ds-surface)',
          borderRight: '1px solid var(--ds-border)',
          color: 'var(--ds-ink)',
        },
      }}
    >
      <Box
        component="nav"
        aria-label="Navegação principal"
        sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-end',
            px: 'var(--ds-space-1)',
            py: 'var(--ds-space-1)',
            minHeight: 'var(--ds-space-12)',
          }}
        >
          <IconButton
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            size="small"
            sx={{ color: 'var(--ds-ink-muted)' }}
          >
            <ToggleIcon size={NAV_ICON_SIZE} weight="regular" />
          </IconButton>
        </Box>

        <List disablePadding component="div">
          {navItems.map((item) => {
            if (item.kind === 'group') return renderGroup(item.group)
            // Divisor de chrome antes de Configurações (paridade com a Sidebar
            // legada) — chrome da sidebar, não dado da derivação canônica.
            if (item.destination.key === 'settings') {
              return (
                <Box key={item.destination.path}>
                  <Divider sx={{ my: 'var(--ds-space-1)', borderColor: 'var(--ds-border)' }} />
                  {renderDestination(item.destination)}
                </Box>
              )
            }
            return renderDestination(item.destination)
          })}
        </List>

        {/* Âncora de captura ao fim da navegação (`{components.capture-action}`,
            decisão Captura A da 13.0): spacer + botão com borda
            `{components.interactive-control}`. Offline: aria-disabled + guard no
            click (nunca `disabled` nativo — AC6: foco e identidade preservados),
            com motivo acessível no nome e no Tooltip. */}
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ px: collapsed ? 'var(--ds-space-1)' : 'var(--ds-space-2)', pb: 'var(--ds-space-2)' }}>
          <Tooltip title={isOnline ? '' : 'Sem conexão'}>
            <ButtonBase
              onClick={() => {
                if (!isOnline) return
                onOpenCapture?.()
              }}
              aria-disabled={isOnline ? undefined : true}
              aria-label={captureLabel}
              sx={{
                width: '100%',
                minHeight: 'var(--ds-touch-target-min)',
                border: '1px solid var(--ds-control-border)',
                borderRadius: 'var(--ds-radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--ds-space-2)',
                px: collapsed ? 0 : 'var(--ds-space-2)',
                fontFamily: 'inherit',
                fontSize: 14,
                ...(isOnline
                  ? {
                      color: 'var(--ds-ink)',
                      backgroundColor: 'transparent',
                      '&:hover': { backgroundColor: 'var(--ds-surface-subtle)' },
                    }
                  : {
                      color: 'var(--ds-ink-disabled)',
                      backgroundColor: 'var(--ds-surface-subtle)',
                    }),
              }}
            >
              <BrainDumpBadge badgeSx={SHELL_BADGE_SX} max={9}>
                <CaptureIcon size={NAV_ICON_SIZE} weight="regular" />
              </BrainDumpBadge>
              {!collapsed && <span>Abrir captura rápida</span>}
            </ButtonBase>
          </Tooltip>
        </Box>
      </Box>
    </Drawer>
  )
}
