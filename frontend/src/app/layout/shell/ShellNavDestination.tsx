import { ListItemButton, ListItemIcon, ListItemText } from '@mui/material'
import type { Ref } from 'react'

import { BrainDumpBadge } from '../../../features/braindump'

import { navIconFor } from './navIcons'
import { SHELL_BADGE_SX, type ShellDestination } from './shellDestinations'

/**
 * LINHA DE DESTINO compartilhada pela `ShellSidebar` e pelo
 * `ShellNavigationSheet` — a fonte única do markup, dos nomes acessíveis e dos
 * canais de "ativo" de um item navegável do chrome.
 *
 * Existia em DUAS cópias quase idênticas (`ShellSidebar.renderDestination` e
 * `ShellNavigationSheet.renderDestination`, ~35 linhas cada), e a divergência
 * entre elas já produziu um defeito real: o predicado de ativo (match exato na
 * sidebar × prefixo no sheet — SHELL-DEBT-03). Duplicação registrada na review
 * da Story 13.3 e resolvida aqui (Story 13.4 AC3).
 *
 *   ▶ Um destino ativo combina 4+ canais (WCAG 1.4.1): indicador lateral de 3px
 *     + fundo `--ds-primary-soft` + label em peso 700 + ícone `fill` +
 *     `aria-current="page"`. Nenhum deles é a cor isolada.
 *
 *   ▶ SEM TanStack Query: a contagem do Brain Dump entra EXCLUSIVAMENTE
 *     encapsulada no `BrainDumpBadge` do barrel `features/braindump` (o mesmo
 *     contrato das duas superfícies — `max={9}` + `SHELL_BADGE_SX`). Um filho com
 *     Query aqui obrigaria mock de Query nos testes compartilhados do chrome.
 *
 *   ▶ Zero literais estruturais: geometria e tinta vêm de `var(--ds-*)`.
 *
 * Parametriza SÓ o que legitimamente difere entre as duas superfícies; o
 * cabeçalho de **grupo** permanece duplicado de propósito (divergência de
 * composição registrada no checklist de paridade — o agrupador da sidebar tem
 * rail, `aria-describedby` de "Contém a página atual", peso condicional e chevron
 * oculto no rail; o do sheet não tem nenhum dos quatro).
 *
 * [Source: Story 13.4 AC3; DESIGN.md §App Shell; 13-shell-parity-checklist.md
 *  SB-11/SB-14, BD-01/BD-04]
 */
interface ShellNavDestinationProps {
  destination: ShellDestination
  /** A rota atual casa este destino? (`isDestinationActive` — predicado único.) */
  active: boolean
  /**
   * Rail de 64px da sidebar colapsada: oculta o label de texto e move o nome
   * acessível para `aria-label`. O sheet nunca colapsa.
   */
  collapsed?: boolean
  /** Ação da linha: navegar (sidebar) ou navegar + fechar o sheet. */
  onActivate: () => void
  /**
   * Alvo do foco inicial. Só o sheet usa: ao abrir, o foco vai ao destino ativo
   * (nunca ao Fechar — rejeitado na 13.0).
   */
  itemRef?: Ref<HTMLDivElement>
  /**
   * A superfície tem estado `:hover`? A sidebar (ponteiro) sim; o sheet é
   * superfície de toque do compact e nunca teve hover.
   */
  withHover?: boolean
}

export function ShellNavDestination({
  destination,
  active,
  collapsed = false,
  onActivate,
  itemRef,
  withHover = false,
}: ShellNavDestinationProps) {
  const icon = navIconFor(destination.key, active ? 'fill' : 'regular')

  return (
    <ListItemButton
      onClick={onActivate}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? destination.label : undefined}
      ref={itemRef}
      sx={{
        borderLeft: '3px solid',
        borderLeftColor: active ? 'var(--ds-primary)' : 'transparent',
        backgroundColor: active ? 'var(--ds-primary-soft)' : 'transparent',
        color: active ? 'var(--ds-ink)' : 'var(--ds-ink-muted)',
        justifyContent: collapsed ? 'center' : 'flex-start',
        minHeight: 'var(--ds-touch-target-min)',
        px: collapsed ? 0 : 'var(--ds-space-2)',
        ...(withHover ? { '&:hover': { backgroundColor: 'var(--ds-surface-subtle)' } } : {}),
      }}
    >
      <ListItemIcon
        sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center', color: 'inherit' }}
      >
        {destination.badge ? (
          <BrainDumpBadge badgeSx={SHELL_BADGE_SX} max={9}>
            {icon}
          </BrainDumpBadge>
        ) : (
          icon
        )}
      </ListItemIcon>
      {!collapsed && (
        <ListItemText
          primary={destination.label}
          slotProps={{ primary: { fontWeight: active ? 700 : 500 } }}
        />
      )}
    </ListItemButton>
  )
}
