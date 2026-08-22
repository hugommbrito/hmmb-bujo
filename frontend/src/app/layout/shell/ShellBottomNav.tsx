import { Box, ButtonBase } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

import { BrainDumpBadge } from '../../../features/braindump'

import { navIconFor } from './navIcons'
import {
  deriveBottomNavShortcuts,
  deriveShellNavItems,
  flattenDestinations,
  isDestinationActive,
  SHELL_BADGE_SX,
} from './shellDestinations'

/**
 * Bottom nav do shell novo (compact <768px): 3 atalhos derivados + item fixo
 * **Menu** (`{components.app-shell.bottom-nav-configurable-items}` = 3 + Menu;
 * DIV-2 do checklist). Substitui a `BottomNav` legada só dentro do
 * `ShellLayout`; a legada permanece intocada como rota de rollback.
 *
 *   ▶ SEM TanStack Query direto (AC1): a contagem entra só pelo
 *     `BrainDumpBadge` do barrel `features/braindump`.
 *
 *   ▶ Atalhos: derivação pura de `shellDestinations.ts` — sem preferência
 *     salva (a UI de Configurações → Navegação mobile é a 18.1), valem os três
 *     primeiros destinos disponíveis na ordem canônica (hoje: Hoje, Esta
 *     Semana, Este Mês).
 *
 *   ▶ Zero literais estruturais (AC7): altura via `var(--ds-bottom-nav-height)`
 *     + safe-area; contraste do label não-selecionado ≥4.5:1 com
 *     `var(--ds-ink-muted)` sobre `var(--ds-surface)` (fix da SHELL-DEBT-01 —
 *     a barra nova entra no gate axe compact).
 *
 * [Source: Story 13.3 AC1/AC2/AC4/AC7; EXPERIENCE §App Shell, aparência e
 * atalhos; mockup key-app-shell-13-0.html frame D]
 */
interface ShellBottomNavProps {
  /** O sheet de navegação completa está aberto? (`aria-expanded` do Menu) */
  menuOpen: boolean
  /** Abre o `ShellNavigationSheet` (item fixo Menu). */
  onOpenMenu: () => void
}

export function ShellBottomNav({ menuOpen, onOpenMenu }: ShellBottomNavProps) {
  const location = useLocation()
  const navigate = useNavigate()

  // Derivação POR RENDER (não no load do módulo): é a mesma fonte da
  // `ShellSidebar`/`ShellNavigationSheet`, e os dois consumidores futuros da
  // lista — o gateamento que FILTRA o registro (Épico 10) e a preferência por
  // conta (`deriveBottomNavShortcuts(…, preferredPaths)`, Story 18.1) — mudam em
  // runtime. Uma constante de módulo congelaria os atalhos no primeiro import e
  // deixaria de acompanhá-los silenciosamente. O registro é estático (AD-17),
  // então o custo é um punhado de filtros sobre 4 entradas.
  const shortcuts = deriveBottomNavShortcuts(flattenDestinations(deriveShellNavItems()))

  // Ativo pelo predicado ÚNICO das três superfícies (`isDestinationActive`:
  // prefixo do próprio destino, nunca um prefixo mais largo) — a cópia local do
  // `containsRoute` saiu daqui na Story 13.4 (SHELL-DEBT-03).
  const activeShortcut = shortcuts.find((dest) =>
    isDestinationActive(location.pathname, dest.path),
  )
  // Rota atual fora dos 3 atalhos ⇒ Menu aparece selecionado (EXPERIENCE §App
  // Shell). `aria-current` no botão Menu segue o mockup aprovado — decisão
  // interina registrada no checklist (Questão Aberta 1) para o passe da 13.4.
  const menuSelected = !activeShortcut

  // Itens frequentes da bottom nav ≥48px de alvo: a altura da barra
  // (`--ds-bottom-nav-height`) cobre o requisito — cada item ocupa a coluna
  // inteira da grade.
  const itemSx = (selected: boolean) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--ds-space-1)',
    minWidth: 'var(--ds-touch-target-min)',
    fontFamily: 'inherit',
    fontSize: 11,
    fontWeight: selected ? 700 : 500,
    color: selected ? 'var(--ds-primary)' : 'var(--ds-ink-muted)',
    backgroundColor: selected ? 'var(--ds-primary-soft)' : 'transparent',
  })

  return (
    <Box
      component="nav"
      aria-label="Atalhos de navegação"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 'appBar',
        boxSizing: 'border-box',
        height: 'calc(var(--ds-bottom-nav-height) + env(safe-area-inset-bottom, 0px))',
        pb: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: 'var(--ds-surface)',
        borderTop: '1px solid var(--ds-border)',
        display: 'grid',
        gridTemplateColumns: `repeat(${shortcuts.length + 1}, 1fr)`,
      }}
    >
      {shortcuts.map((dest) => {
        const selected = isDestinationActive(location.pathname, dest.path)
        const icon = navIconFor(dest.key, selected ? 'fill' : 'regular')
        return (
          <ButtonBase
            key={dest.path}
            onClick={() => navigate(dest.path)}
            aria-current={selected ? 'page' : undefined}
            sx={itemSx(selected)}
          >
            {/* Atalho portador do badge (ex.: Brain Dump numa configuração
                futura da 18.1): cápsula ligada ao ícone, sem cobrir o pictograma. */}
            {dest.badge ? (
              <BrainDumpBadge badgeSx={SHELL_BADGE_SX} max={9}>
                {icon}
              </BrainDumpBadge>
            ) : (
              icon
            )}
            <span>{dest.label}</span>
          </ButtonBase>
        )
      })}

      <ButtonBase
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-current={menuSelected ? 'page' : undefined}
        sx={itemSx(menuSelected)}
      >
        {navIconFor('menu', menuSelected ? 'fill' : 'regular')}
        <span>Menu</span>
      </ButtonBase>
    </Box>
  )
}
