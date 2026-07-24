import { useState } from 'react'
import {
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

import { BrainDumpBadge } from '../../../features/braindump'
import { collections as registryCollections } from '../../collections/registry'
import type { CollectionManifestEntry } from '../../collections/registry'
import type { Icon } from '@phosphor-icons/react'

import { navIcons, NAV_ICON_SIZE, type NavIconKey } from './navIcons'

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
 *     `QueryClientProvider`. Nenhum hook de Query nem `BrainDumpCaptureSheet`
 *     aqui (a captura persistente é a Story 13.3).
 *
 *   ▶ Zero literais estruturais (AC6): larguras/espaços vêm de `var(--ds-*)`
 *     (`shared/design/tokens.ts`, aplicados na raiz do shell pelo `ShellLayout`).
 *
 *   ▶ Catálogo Phosphor FECHADO (AC4): ícones vêm só de `navIcons` — nenhum
 *     `@mui/icons-material`. O chevron do grupo é um glyph unicode decorativo
 *     (o catálogo fechado não define chevron; o mockup usa `&#8964;`), não um
 *     ícone de nenhuma das bibliotecas.
 *
 * [Source: Story 13.2; DESIGN.md §App Shell / §Catálogo Phosphor; mockup
 * key-app-shell-13-0.html; 13-shell-parity-checklist.md SB-01…SB-15]
 */
interface ShellSidebarProps {
  collapsed: boolean
  onToggle: () => void
  /**
   * Seam de teste (Testing Requirements da 13.2): lista de collections a
   * derivar. PRODUÇÃO NUNCA passa isto — o `ShellLayout` chama só
   * `{ collapsed, onToggle }` e a derivação usa o registro puro. Existe apenas
   * para provar a "nav mínima" (zero/uma collection são estados reais com o
   * default all-off de convidados do Épico 10) por injeção, sem mock de módulo.
   */
  collections?: CollectionManifestEntry[]
}

interface NavDestination {
  key: NavIconKey
  label: string
  path: string
}

interface NavGroup {
  key: NavIconKey
  label: string
  children: NavDestination[]
}

// ─── Núcleo / chrome (fora do registro — AD-17) ──────────────────────────────
const TODAY: NavDestination = { key: 'today', label: 'Hoje', path: '/today' }
const PLANNER_CHILDREN: NavDestination[] = [
  { key: 'planner-week', label: 'Esta Semana', path: '/planner/week' },
  { key: 'planner-month', label: 'Este Mês', path: '/planner/month' },
  { key: 'planner-future', label: 'Futuro', path: '/planner/future' },
  { key: 'planner-recurring', label: 'Recorrentes', path: '/planner/recurring' },
]
const BRAIN_DUMP: NavDestination = { key: 'brain-dump', label: 'Brain Dump', path: '/brain-dump' }
const ARCHIVE: NavDestination = { key: 'archive', label: 'Arquivo', path: '/archive' }
const SETTINGS: NavDestination = { key: 'settings', label: 'Configurações', path: '/settings' }

/**
 * Estilo do `.MuiBadge-badge` do App Shell (`{components.app-shell-badge}`).
 * Aplicado SÓ pelo shell via `badgeSx` — o uso legado (`Sidebar`/`BottomNav`)
 * permanece com `color="primary"`, sem regressão visual.
 */
const SHELL_BADGE_SX = {
  backgroundColor: 'var(--ds-primary)',
  color: 'var(--ds-on-primary)',
  minHeight: 'var(--ds-badge-min-height)',
  borderRadius: 'var(--ds-radius-full)',
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

/** Deriva o `NavDestination` de uma entrada do registro (map puro). */
function toDestination(entry: CollectionManifestEntry): NavDestination {
  return {
    key: entry.id as NavIconKey,
    label: entry.nav.label,
    path: `/${entry.routes[0].path}`,
  }
}

export function ShellSidebar({
  collapsed,
  onToggle,
  collections = registryCollections,
}: ShellSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [plannerOpen, setPlannerOpen] = useState(true)
  const [healthOpen, setHealthOpen] = useState(true)

  // ── Derivação das collections a partir da lista FILTRADA (nav mínima) ───────
  // Não hardcodar as 4: filtra a lista derivada. O gateamento futuro (Épico 10)
  // vai FILTRAR o registro; zero/uma collection já são toleradas por construção.
  const standalone = collections.filter((c) => !c.nav.group)
  const habits = standalone.find((c) => c.id === 'habits')
  const gratitude = standalone.find((c) => c.id === 'gratitude')
  const healthChildren = collections
    .filter((c) => c.nav.group === 'saude')
    .sort((a, b) => a.nav.order - b.nav.order)
    .map(toDestination)

  const isActive = (path: string) => location.pathname === path
  const containsRoute = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

  // Collection nova ainda sem entrada no catálogo fechado degrada SEM ícone (o
  // destino segue navegável pelo label/aria-label) em vez de derrubar o shell —
  // o `id` vem do registro como string aberta e o catálogo é fechado por design.
  const iconFor = (key: NavIconKey, active: boolean) => {
    const IconComp: Icon | undefined = navIcons[key]
    if (!IconComp) return null
    return <IconComp size={NAV_ICON_SIZE} weight={active ? 'fill' : 'regular'} />
  }

  const iconSx = { minWidth: collapsed ? 0 : 40, justifyContent: 'center', color: 'inherit' }

  const destinationSx = (active: boolean) => ({
    borderLeft: '3px solid',
    borderLeftColor: active ? 'var(--ds-primary)' : 'transparent',
    backgroundColor: active ? 'var(--ds-primary-soft)' : 'transparent',
    color: active ? 'var(--ds-ink)' : 'var(--ds-ink-muted)',
    justifyContent: collapsed ? 'center' : 'flex-start',
    minHeight: 'var(--ds-touch-target-min)',
    px: collapsed ? 0 : 'var(--ds-space-2)',
    '&:hover': { backgroundColor: 'var(--ds-surface-subtle)' },
  })

  // Um destino ativo combina 4+ canais (WCAG 1.4.1): indicador lateral 3px +
  // fundo primary-soft + label em peso forte + ícone `fill` + aria-current.
  const renderDestination = (dest: NavDestination, opts: { badge?: boolean } = {}) => {
    const active = isActive(dest.path)
    const icon = iconFor(dest.key, active)
    return (
      <ListItemButton
        key={dest.path}
        onClick={() => navigate(dest.path)}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? dest.label : undefined}
        sx={destinationSx(active)}
      >
        <ListItemIcon sx={iconSx}>
          {opts.badge ? (
            <BrainDumpBadge badgeSx={SHELL_BADGE_SX} max={9}>
              {icon}
            </BrainDumpBadge>
          ) : (
            icon
          )}
        </ListItemIcon>
        {!collapsed && (
          <ListItemText
            primary={dest.label}
            slotProps={{ primary: { fontWeight: active ? 700 : 500 } }}
          />
        )}
      </ListItemButton>
    )
  }

  // Agrupador (Planner/Saúde): expõe aria-expanded, NUNCA aria-current. Quando
  // recolhido contendo a rota ativa, indica por indicador lateral + fundo sutil
  // (`.contains`) + descrição acessível — sem aria-current no agrupador (AC5).
  const renderGroup = (group: NavGroup, open: boolean, onToggleGroup: () => void) => {
    const groupVisuallyOpen = open && !collapsed
    const activeChild = group.children.find((c) => containsRoute(c.path))
    const showContains = Boolean(activeChild) && !groupVisuallyOpen
    const describedById = `${group.key}-active-destination`
    const GroupIcon = navIcons[group.key]

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
          <ListItemIcon sx={iconSx}>
            <GroupIcon size={NAV_ICON_SIZE} weight="regular" />
          </ListItemIcon>
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
      <Box component="nav" aria-label="Navegação principal">
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
          {renderDestination(TODAY)}

          {renderGroup(
            { key: 'planner', label: 'Planner', children: PLANNER_CHILDREN },
            plannerOpen,
            () => setPlannerOpen((p) => !p),
          )}

          {habits && renderDestination(toDestination(habits))}

          {healthChildren.length > 0 &&
            renderGroup(
              { key: 'saude', label: 'Saúde', children: healthChildren },
              healthOpen,
              () => setHealthOpen((h) => !h),
            )}

          {gratitude && renderDestination(toDestination(gratitude))}

          {renderDestination(BRAIN_DUMP, { badge: true })}
          {renderDestination(ARCHIVE)}

          <Divider sx={{ my: 'var(--ds-space-1)', borderColor: 'var(--ds-border)' }} />

          {renderDestination(SETTINGS)}
        </List>
      </Box>
    </Drawer>
  )
}
