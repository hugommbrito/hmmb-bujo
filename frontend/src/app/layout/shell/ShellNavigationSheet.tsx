import { useCallback, useRef, useState } from 'react'
import {
  Box,
  ButtonBase,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  SwipeableDrawer,
  useTheme,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

import { BrainDumpBadge } from '../../../features/braindump'
import { shellCssVariables } from '../../../shared/design/tokens'
import type { CollectionManifestEntry } from '../../collections/registry'
import type { Icon } from '@phosphor-icons/react'

import { navIcons, NAV_ICON_SIZE, type NavIconKey } from './navIcons'
import {
  deriveShellNavItems,
  SHELL_BADGE_SX,
  type ShellDestination,
  type ShellDestinationGroup,
} from './shellDestinations'

/**
 * Sheet de navegação completa do compact (`{components.mobile-navigation-sheet}`:
 * high-sheet, `surface`, backdrop `overlay`, radius-top `{rounded.lg}` — o token
 * vence os 12px do markup do mockup). Aberto pelo item fixo **Menu** da
 * `ShellBottomNav`.
 *
 *   ▶ NÃO é overflow: lista TODOS os destinos disponíveis — inclusive os 3
 *     atalhos — na ordem e agrupamentos canônicos de `shellDestinations.ts`
 *     (a mesma fonte da `ShellSidebar`; a ordem do markup do mockup não é
 *     canônica — os spines vencem).
 *
 *   ▶ `SwipeableDrawer` fornece backdrop, `Escape`, swipe-down e focus trap do
 *     Modal (conteúdo inferior inerte) — os 4 modos de fechamento do contrato
 *     sem lib nova. Fechar sem navegar devolve o foco ao acionador (restauração
 *     default do Modal); o foco inicial vai ao destino ativo (nunca ao Fechar —
 *     rejeitado na 13.0).
 *
 *   ▶ O Drawer renderiza num PORTAL fora da raiz do shell, então as custom
 *     properties `--ds-*` aplicadas pelo `ShellLayout` não alcançam o paper —
 *     o sheet reaplica `shellCssVariables()` no root do Modal (mesma técnica da
 *     raiz do shell; backdrop e paper leem dali).
 *
 * [Source: Story 13.3 AC3/AC4; EXPERIENCE §State Patterns / §Interaction
 * Primitives; mockup key-app-shell-13-0.html frame E]
 */
interface ShellNavigationSheetProps {
  open: boolean
  onClose: () => void
  /**
   * Seam de teste (padrão da 13.2): lista de collections a derivar. PRODUÇÃO
   * NUNCA passa isto — a derivação usa o registro puro.
   */
  collections?: CollectionManifestEntry[]
}

export function ShellNavigationSheet({ open, onClose, collections }: ShellNavigationSheetProps) {
  const theme = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  // Estado de expansão por agrupador — só na sessão, nada persistido; grupos
  // iniciam expandidos (mesma decisão da ShellSidebar).
  const [closedGroups, setClosedGroups] = useState<Partial<Record<NavIconKey, boolean>>>({})
  // `ListItemButton` renderiza `div` por default — o ref é do elemento raiz.
  const initialFocusRef = useRef<HTMLDivElement | null>(null)

  const navItems = deriveShellNavItems(collections)

  // Ativo por PREFIXO do próprio destino (path exato ou `path + '/'`) — o mesmo
  // `containsRoute` da `ShellBottomNav`. As rotas de histórico das collections
  // (`/habits/history`, `/health/metrics/history`, `/gratitude/history`) são
  // reais: com match exato o sheet ficaria SEM nenhum destino ativo justamente
  // onde a barra já marca o seu estado, e o foco inicial do AC4 pousaria num
  // item sem `aria-current`.
  const containsRoute = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  const isActive = containsRoute

  // Destinos EFETIVAMENTE renderizados: um agrupador recolhido DESMONTA os
  // filhos (`Collapse unmountOnExit`), então o alvo do foco inicial tem de sair
  // desta lista — senão reabrir o sheet com o grupo da rota ativa recolhido
  // deixaria o sheet sem foco inicial nenhum (AC4).
  const visibleDestinations = navItems.flatMap((item) =>
    item.kind === 'destination'
      ? [item.destination]
      : closedGroups[item.group.key]
        ? []
        : item.group.children,
  )
  // Foco inicial no destino ativo; se nenhum destino visível casa a rota, no
  // primeiro item visível (AC4).
  const focusPath = (
    visibleDestinations.find((dest) => containsRoute(dest.path)) ?? visibleDestinations[0]
  )?.path

  // Dois mecanismos complementares (padrão do BrainDumpCaptureSheet, aprendizado
  // da retro do Epic 5): o `ref` foca na montagem do item (o que jsdom exercita
  // no unit) e `onEntered` refoca ao fim da transição — o FocusTrap do Modal
  // rouba o foco durante a animação no browser real.
  //
  // O gate `focusArmed` é o que separa "sheet abrindo" de "item remontando": o
  // `Collapse` remonta os filhos a CADA reexpansão de agrupador, e focar ali
  // arrancaria o foco do próprio agrupador que o usuário acabou de acionar
  // (WCAG 2.2 `3.2.1 On Focus`). Armado quando `open` vira true, consumido pelo
  // primeiro foco.
  const focusArmed = useRef(false)
  const previousOpen = useRef(open)
  if (open !== previousOpen.current) {
    previousOpen.current = open
    focusArmed.current = open
  }
  const attachInitialFocus = useCallback((node: HTMLDivElement | null) => {
    initialFocusRef.current = node
    if (node && focusArmed.current) {
      focusArmed.current = false
      node.focus()
    }
  }, [])

  const cssVariables = shellCssVariables(theme.palette.mode === 'dark' ? 'dark' : 'light')

  const renderDestination = (dest: ShellDestination) => {
    const active = isActive(dest.path)
    const IconComp: Icon | undefined = navIcons[dest.key]
    const icon = IconComp ? (
      <IconComp size={NAV_ICON_SIZE} weight={active ? 'fill' : 'regular'} />
    ) : null
    const isInitialFocus = dest.path === focusPath
    return (
      <ListItemButton
        key={dest.path}
        onClick={() => {
          navigate(dest.path)
          onClose()
        }}
        aria-current={active ? 'page' : undefined}
        ref={isInitialFocus ? attachInitialFocus : undefined}
        sx={{
          borderLeft: '3px solid',
          borderLeftColor: active ? 'var(--ds-primary)' : 'transparent',
          backgroundColor: active ? 'var(--ds-primary-soft)' : 'transparent',
          color: active ? 'var(--ds-ink)' : 'var(--ds-ink-muted)',
          minHeight: 'var(--ds-touch-target-min)',
          px: 'var(--ds-space-2)',
        }}
      >
        <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center', color: 'inherit' }}>
          {dest.badge ? (
            <BrainDumpBadge badgeSx={SHELL_BADGE_SX} max={9}>
              {icon}
            </BrainDumpBadge>
          ) : (
            icon
          )}
        </ListItemIcon>
        <ListItemText
          primary={dest.label}
          slotProps={{ primary: { fontWeight: active ? 700 : 500 } }}
        />
      </ListItemButton>
    )
  }

  // Agrupadores expõem aria-expanded (nunca aria-current — AC3).
  const renderGroup = (group: ShellDestinationGroup) => {
    const groupOpen = !closedGroups[group.key]
    const GroupIcon = navIcons[group.key]
    return (
      <Box key={group.key}>
        <ListItemButton
          onClick={() => setClosedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
          aria-expanded={groupOpen}
          sx={{
            color: 'var(--ds-ink)',
            minHeight: 'var(--ds-touch-target-min)',
            px: 'var(--ds-space-2)',
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center', color: 'inherit' }}>
            <GroupIcon size={NAV_ICON_SIZE} weight="regular" />
          </ListItemIcon>
          <ListItemText primary={group.label} slotProps={{ primary: { fontWeight: 600 } }} />
          {/* Chevron: glyph unicode decorativo (catálogo fechado sem chevron). */}
          <Box component="span" aria-hidden sx={{ color: 'var(--ds-ink-muted)', fontSize: 14, lineHeight: 1 }}>
            {groupOpen ? '⌃' : '⌄'}
          </Box>
        </ListItemButton>
        <Collapse in={groupOpen} timeout="auto" unmountOnExit>
          <List disablePadding component="div" sx={{ pl: 'var(--ds-space-2)' }}>
            {group.children.map((child) => renderDestination(child))}
          </List>
        </Collapse>
      </Box>
    )
  }

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      // Sem swipe-to-open não há razão para manter o conteúdo montado fechado
      // (default do SwipeableDrawer): desmontar evita destinos ocultos
      // duplicados no DOM (queries de teste/AT) e garante que o foco inicial
      // (autoFocus + onEntered) dispare a CADA abertura.
      ModalProps={{ keepMounted: false }}
      slotProps={{
        // Os tokens `--ds-*` são reaplicados via `style` DIRETO em cada slot do
        // portal (backdrop e paper) — no root do Modal eles não chegam de forma
        // confiável através do SwipeableDrawer, e um var() não resolvido
        // invalida `bottom`/`max-height` no browser real.
        backdrop: { style: cssVariables, sx: { backgroundColor: 'var(--ds-overlay)' } },
        transition: { onEntered: () => initialFocusRef.current?.focus() },
        paper: {
          style: cssVariables,
          sx: {
            backgroundColor: 'var(--ds-surface)',
            color: 'var(--ds-ink)',
            borderTopLeftRadius: 'var(--ds-radius-lg)',
            borderTopRightRadius: 'var(--ds-radius-lg)',
            // High-sheet que TERMINA acima da bottom nav/safe-area (mockup
            // frame E: o sheet assenta sobre a barra, nunca a cobre).
            bottom: 'calc(var(--ds-bottom-nav-height) + env(safe-area-inset-bottom, 0px))',
            maxHeight:
              'calc(100dvh - var(--ds-topbar-height) - var(--ds-bottom-nav-height) - env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <Box
        component="nav"
        aria-label="Navegação completa"
        sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        {/* Alça (grab) decorativa do sheet. */}
        <Box
          aria-hidden
          sx={{
            width: 'var(--ds-space-10)',
            height: 'var(--ds-space-1)',
            borderRadius: 'var(--ds-radius-full)',
            backgroundColor: 'var(--ds-border-strong)',
            mx: 'auto',
            mt: 'var(--ds-space-2)',
          }}
        />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 'var(--ds-space-4)',
            py: 'var(--ds-space-2)',
          }}
        >
          <Box component="span" sx={{ fontWeight: 600, fontSize: 16 }}>
            Navegação
          </Box>
          <ButtonBase
            onClick={onClose}
            sx={{
              minHeight: 'var(--ds-touch-target-min)',
              minWidth: 'var(--ds-touch-target-min)',
              px: 'var(--ds-space-3)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-md)',
              fontFamily: 'inherit',
              fontSize: 14,
              color: 'var(--ds-ink)',
            }}
          >
            Fechar
          </ButtonBase>
        </Box>

        {/* Rolagem interna do sheet — o header e a alça ficam fixos. */}
        <Box sx={{ overflowY: 'auto', minHeight: 0 }}>
          <List disablePadding component="div">
            {navItems.map((item) =>
              item.kind === 'group' ? renderGroup(item.group) : renderDestination(item.destination),
            )}
          </List>
        </Box>
      </Box>
    </SwipeableDrawer>
  )
}
