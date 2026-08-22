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
 * Predicado ÚNICO de "destino ativo", consumido pelas TRÊS superfícies de
 * navegação (`ShellSidebar`, `ShellBottomNav`, `ShellNavigationSheet`) —
 * fechamento da **SHELL-DEBT-03**, que existia porque a sidebar usava match
 * EXATO e as outras duas usavam prefixo, em três cópias literais divergentes.
 *
 * Semântica: **prefixo do próprio destino** (path exato ou `path + '/'`), nunca
 * um prefixo mais largo. As rotas de histórico das collections
 * (`/habits/history`, `/health/metrics/history`, …) e as rotas parametrizadas de
 * arquivo (`/archive/weekly/:weekStart`) são reais: com match exato elas
 * deixavam a navegação SEM nenhum destino ativo. Já `/planner/future` compartilha
 * o segmento `/planner` com os atalhos sem ser rota de nenhum deles — e continua
 * não ativando ninguém.
 *
 * Recebe o `pathname` como argumento (função pura, sem hook): quem tem o
 * `useLocation` é a superfície.
 */
export function isDestinationActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * Rótulo humano de cada agrupador derivado do registro. **Limitação conhecida
 * (registrada no checklist de paridade):** `CollectionNav` só tem a chave do
 * grupo (`nav.group`), não um label — então o rótulo vive aqui, num mapa
 * NOMEADO, e não espalhado em literais pela derivação. Uma chave de grupo fora
 * deste mapa degrada para a própria chave em vez de renderizar `undefined`.
 */
const GROUP_LABELS: Readonly<Record<string, string>> = {
  saude: 'Saúde',
}

/**
 * Unidade de collection na ordenação canônica: uma collection avulsa OU um grupo
 * inteiro. `order` do grupo = o MENOR `nav.order` entre os filhos; `index` = a
 * primeira ocorrência no array do registro (tiebreak determinístico).
 */
type CollectionUnit =
  | { kind: 'standalone'; order: number; index: number; entry: CollectionManifestEntry }
  | { kind: 'group'; order: number; index: number; key: string; entries: CollectionManifestEntry[] }

/**
 * Estrutura canônica AGRUPADA da navegação (sidebar/sheet): núcleo hardcoded +
 * collections derivadas da lista FILTRADA. Não hardcodar as 4: o gateamento
 * futuro (Épico 10) vai FILTRAR o registro; zero/uma collection já são toleradas
 * por construção.
 *
 *   ▶ DERIVAÇÃO GENÉRICA (fecha a **SHELL-DEBT-04** e torna executável o DoD do
 *     AD-17 — "collection nova = pasta da feature + UMA entrada no registro"):
 *     ZERO `id` literal aqui. Antes os avulsos eram escolhidos por
 *     `find(c => c.id === 'habits' | 'gratitude')`, então uma collection avulsa
 *     nova não aparecia em NENHUMA superfície de navegação.
 *
 *   ▶ Regra de ordem: as **unidades** (cada avulsa + cada grupo) são ordenadas
 *     por `nav.order` e, em empate, pela primeira ocorrência no registro; dentro
 *     do grupo vale `nav.order`. É essa regra que preserva byte-a-byte a ordem
 *     canônica atual — `habits` (order 0) empata com `health-metrics` (order 0) e
 *     o tiebreak pelo índice é o que mantém Hábitos antes de Saúde.
 */
export function deriveShellNavItems(
  collections: readonly CollectionManifestEntry[] = registryCollections,
): ShellNavItem[] {
  const units: CollectionUnit[] = []
  const groupUnits = new Map<string, Extract<CollectionUnit, { kind: 'group' }>>()

  collections.forEach((entry, index) => {
    const groupKey = entry.nav.group
    if (!groupKey) {
      units.push({ kind: 'standalone', order: entry.nav.order, index, entry })
      return
    }
    const existing = groupUnits.get(groupKey)
    if (existing) {
      existing.entries.push(entry)
      existing.order = Math.min(existing.order, entry.nav.order)
      return
    }
    const unit: Extract<CollectionUnit, { kind: 'group' }> = {
      kind: 'group',
      order: entry.nav.order,
      index,
      key: groupKey,
      entries: [entry],
    }
    groupUnits.set(groupKey, unit)
    units.push(unit)
  })

  const collectionItems: ShellNavItem[] = [...units]
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((unit) =>
      unit.kind === 'standalone'
        ? { kind: 'destination', destination: toDestination(unit.entry) }
        : {
            kind: 'group',
            group: {
              key: unit.key as NavIconKey,
              label: GROUP_LABELS[unit.key] ?? unit.key,
              children: [...unit.entries]
                .sort((a, b) => a.nav.order - b.nav.order)
                .map(toDestination),
            },
          },
    )

  return [
    { kind: 'destination', destination: TODAY },
    { kind: 'group', group: { key: 'planner', label: 'Planner', children: PLANNER_CHILDREN } },
    ...collectionItems,
    { kind: 'destination', destination: BRAIN_DUMP },
    { kind: 'destination', destination: ARCHIVE },
    { kind: 'destination', destination: SETTINGS },
  ]
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
