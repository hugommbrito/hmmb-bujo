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

import { shellCssVariables } from '../../../shared/design/tokens'
import type { CollectionManifestEntry } from '../../collections/registry'

import { navIconFor, type NavIconKey } from './navIcons'
import { ShellNavDestination } from './ShellNavDestination'
import {
  deriveShellNavItems,
  isDestinationActive,
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

  // Ativo pelo predicado ÚNICO das três superfícies (`isDestinationActive`,
  // prefixo do próprio destino) — a cópia local do `containsRoute` saiu daqui na
  // Story 13.4 (SHELL-DEBT-03). As rotas de histórico das collections
  // (`/habits/history`, `/health/metrics/history`, `/gratitude/history`) são
  // reais: com match exato o sheet ficaria SEM nenhum destino ativo justamente
  // onde a barra já marca o seu estado, e o foco inicial do AC4 pousaria num
  // item sem `aria-current`.
  //
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
    visibleDestinations.find((dest) => isDestinationActive(location.pathname, dest.path)) ??
    visibleDestinations[0]
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

  // Linha de destino COMPARTILHADA com a `ShellSidebar` (`ShellNavDestination` —
  // Story 13.4 AC3): o markup, os nomes acessíveis, os canais de "ativo" e o
  // contrato do badge são os mesmos nas duas superfícies. Aqui só difere o que é
  // legitimamente do sheet: navegar TAMBÉM fecha, e o destino do foco inicial
  // recebe o `ref`.
  const renderDestination = (dest: ShellDestination) => (
    <ShellNavDestination
      key={dest.path}
      destination={dest}
      active={isDestinationActive(location.pathname, dest.path)}
      onActivate={() => {
        navigate(dest.path)
        onClose()
      }}
      itemRef={dest.path === focusPath ? attachInitialFocus : undefined}
    />
  )

  // Agrupadores expõem aria-expanded (nunca aria-current — AC3). O cabeçalho de
  // grupo permanece DUPLICADO em relação à sidebar de propósito: unificá-lo
  // exigiria uma prop condicional para cada divergência real do agrupador da
  // sidebar (rail, `aria-describedby` de "Contém a página atual", peso condicional,
  // chevron oculto no rail) — divergência de composição registrada com
  // justificativa no checklist de paridade (Story 13.4 AC3).
  const renderGroup = (group: ShellDestinationGroup) => {
    const groupOpen = !closedGroups[group.key]
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
          {/* Guard de catálogo também no CABEÇALHO do grupo (AC2 da 13.4): um
              `nav.group` novo no registro degrada sem ícone em vez de derrubar
              o chrome inteiro — antes `navIcons[group.key]` era lido sem guard. */}
          <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center', color: 'inherit' }}>
            {navIconFor(group.key)}
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
            // ANEL DE FOCO reaplicado DENTRO do portal, pela mesma razão dos
            // tokens acima: a regra `'& :focus-visible'` do `ShellLayout` é
            // descendente do `shell-root`, e o paper deste sheet vive em
            // `document.body`. Sem isto, todo controle do sheet (Fechar,
            // agrupadores e os 14 destinos) fica SEM outline — o `ButtonBase` do
            // MUI zera até o anel default do browser (`outline: 0`), então a única
            // pista de foco seria a tinta de `.Mui-focusVisible`. Achado do passo
            // de QA da Story 13.4 (A11Y-06 / WCAG 2.4.7 no chrome do compact).
            '& :focus-visible': {
              outline: 'var(--ds-focus-ring-width) solid var(--ds-focus)',
              outlineOffset: 'var(--ds-focus-ring-offset)',
            },
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
