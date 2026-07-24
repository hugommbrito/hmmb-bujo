// ─────────────────────────────────────────────────────────────────────────────
// Derivação canônica dos destinos de navegação do App Shell — fonte ÚNICA
// consumida pela `ShellSidebar` (13.2), pela `ShellBottomNav` e pelo
// `ShellNavigationSheet` (13.3). Três cópias divergentes da ordem canônica é o
// anti-padrão que o manifest de collections existe para evitar (AD-17/FR-1.3).
//
//   ▶ DADOS PUROS / FUNÇÕES PURAS: sem React, sem hooks, sem TanStack Query,
//     sem env — mesmo espírito de `shellRouting.ts`. Server state no chrome
//     obrigaria mocks de Query nos testes compartilhados do chrome.
//
//   ▶ Ordem canônica (EXPERIENCE §Information Architecture — os spines vencem
//     o markup do mockup): Hoje → Planner[Esta Semana → Este Mês → Futuro →
//     Recorrentes] → Hábitos → Saúde[Métricas → Medicamentos] → Gratidão →
//     Brain Dump → Arquivo → Configurações.
//
//   ▶ Só destinos implementados: as collections entram pela lista FILTRADA do
//     registro (zero/uma collection são estados reais com o default all-off de
//     convidados do Épico 10) — módulos futuros nunca aparecem desabilitados.
//
// [Source: Story 13.3 AC2/AC3; EXPERIENCE.md §App Shell, aparência e atalhos]
// ─────────────────────────────────────────────────────────────────────────────
import { collections as registryCollections } from '../../collections/registry'
import type { CollectionManifestEntry } from '../../collections/registry'
import { appShell } from '../../../shared/design/tokens'
import type { NavIconKey } from './navIcons'

/** Um destino navegável da navegação do shell. */
export interface ShellDestination {
  key: NavIconKey
  label: string
  path: string
  /** Destino portador do badge de contagem do Brain Dump. */
  badge?: boolean
}

/** Agrupador colapsável (Planner/Saúde) — nunca navegável por si. */
export interface ShellDestinationGroup {
  key: NavIconKey
  label: string
  children: ShellDestination[]
}

/** Item da estrutura canônica agrupada (para sidebar e sheet). */
export type ShellNavItem =
  | { kind: 'destination'; destination: ShellDestination }
  | { kind: 'group'; group: ShellDestinationGroup }

// ─── Núcleo / chrome (fora do registro — AD-17) ──────────────────────────────
const TODAY: ShellDestination = { key: 'today', label: 'Hoje', path: '/today' }
const PLANNER_CHILDREN: ShellDestination[] = [
  { key: 'planner-week', label: 'Esta Semana', path: '/planner/week' },
  { key: 'planner-month', label: 'Este Mês', path: '/planner/month' },
  { key: 'planner-future', label: 'Futuro', path: '/planner/future' },
  { key: 'planner-recurring', label: 'Recorrentes', path: '/planner/recurring' },
]
const BRAIN_DUMP: ShellDestination = {
  key: 'brain-dump',
  label: 'Brain Dump',
  path: '/brain-dump',
  badge: true,
}
const ARCHIVE: ShellDestination = { key: 'archive', label: 'Arquivo', path: '/archive' }
const SETTINGS: ShellDestination = { key: 'settings', label: 'Configurações', path: '/settings' }

/**
 * Estilo do `.MuiBadge-badge` do App Shell (`{components.app-shell-badge}`).
 * Compartilhado pelo chrome novo (sidebar, bottom nav, FAB, âncora de captura)
 * via `badgeSx` — o uso legado (`Sidebar`/`BottomNav`) permanece com
 * `color="primary"`, sem regressão visual.
 */
export const SHELL_BADGE_SX = {
  backgroundColor: 'var(--ds-primary)',
  color: 'var(--ds-on-primary)',
  minHeight: 'var(--ds-badge-min-height)',
  borderRadius: 'var(--ds-radius-full)',
}

/** Deriva o `ShellDestination` de uma entrada do registro (map puro). */
function toDestination(entry: CollectionManifestEntry): ShellDestination {
  return {
    key: entry.id as NavIconKey,
    label: entry.nav.label,
    path: `/${entry.routes[0].path}`,
  }
}

/**
 * Estrutura canônica AGRUPADA da navegação (sidebar/sheet): núcleo hardcoded +
 * collections derivadas da lista FILTRADA (avulsas + grupo `saude` por
 * `nav.order`). Não hardcodar as 4: o gateamento futuro (Épico 10) vai FILTRAR
 * o registro; zero/uma collection já são toleradas por construção.
 */
export function deriveShellNavItems(
  collections: readonly CollectionManifestEntry[] = registryCollections,
): ShellNavItem[] {
  const standalone = collections.filter((c) => !c.nav.group)
  const habits = standalone.find((c) => c.id === 'habits')
  const gratitude = standalone.find((c) => c.id === 'gratitude')
  const healthChildren = collections
    .filter((c) => c.nav.group === 'saude')
    .sort((a, b) => a.nav.order - b.nav.order)
    .map(toDestination)

  const items: ShellNavItem[] = [
    { kind: 'destination', destination: TODAY },
    { kind: 'group', group: { key: 'planner', label: 'Planner', children: PLANNER_CHILDREN } },
  ]
  if (habits) items.push({ kind: 'destination', destination: toDestination(habits) })
  if (healthChildren.length > 0) {
    items.push({ kind: 'group', group: { key: 'saude', label: 'Saúde', children: healthChildren } })
  }
  if (gratitude) items.push({ kind: 'destination', destination: toDestination(gratitude) })
  items.push(
    { kind: 'destination', destination: BRAIN_DUMP },
    { kind: 'destination', destination: ARCHIVE },
    { kind: 'destination', destination: SETTINGS },
  )
  return items
}

/**
 * Lista ACHATADA de destinos navegáveis na ordem canônica (agrupadores não
 * entram — não são navegáveis). É a fonte dos atalhos da bottom nav.
 */
export function flattenDestinations(items: readonly ShellNavItem[]): ShellDestination[] {
  return items.flatMap((item) =>
    item.kind === 'destination' ? [item.destination] : item.group.children,
  )
}

/**
 * Os atalhos default da bottom nav: sem preferência salva (a UI de
 * Configurações → Navegação mobile é a Story 18.1), valem os
 * `{components.app-shell.bottom-nav-configurable-items}` primeiros destinos
 * disponíveis na ordem canônica, sem duplicatas (EXPERIENCE §App Shell,
 * aparência e atalhos) — hoje: Hoje, Esta Semana, Este Mês.
 *
 * @param preferredPaths Reservado para a preferência por conta da Story 18.1.
 *   A assinatura já recebe o parâmetro; a implementação é da 18.1.
 */
export function deriveBottomNavShortcuts(
  destinations: readonly ShellDestination[],
  preferredPaths?: readonly string[],
): ShellDestination[] {
  if (preferredPaths !== undefined) {
    throw new Error(
      'Preferência de atalhos da bottom nav ainda não implementada (Story 18.1) — use o default derivado.',
    )
  }
  const seen = new Set<string>()
  const unique = destinations.filter((dest) => {
    if (seen.has(dest.path)) return false
    seen.add(dest.path)
    return true
  })
  return unique.slice(0, appShell.bottomNavConfigurableItems)
}
