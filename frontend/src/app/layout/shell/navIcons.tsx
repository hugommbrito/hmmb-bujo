// ─────────────────────────────────────────────────────────────────────────────
// Catálogo Phosphor FECHADO do App Shell (DESIGN.md §Catálogo Phosphor).
//
//   ▶ Mapa por identidade estável → componente `@phosphor-icons/react`:
//     `id` da collection para as 4 collections; chave própria para o núcleo/
//     chrome e os controles. Cada destino/controle usa EXATAMENTE o ícone
//     canônico da tabela — nada de glyph inventado fora do catálogo.
//
//   ▶ Frontend-only: NÃO existe `iconKey` no `registry.ts`/backend. O campo
//     `icon` do manifest continua MUI (consumidor legado, `Sidebar.tsx`); a
//     curadoria Phosphor vive aqui, mapeada por `id`, e adicionar `iconKey` ao
//     manifest é decisão de arquitetura de uma story própria (decision-log 13.0).
//
//   ▶ Uso: `size=20`, `weight='regular'` (repouso) / `'fill'` (selecionado),
//     `currentColor` (a tinta vem do estado do item via `--ds-*`/herança).
//
// [Source: DESIGN.md §Catálogo Phosphor do App Shell; Story 13.2 Dev Notes]
// ─────────────────────────────────────────────────────────────────────────────
import {
  Archive,
  Brain,
  Calendar,
  CalendarDot,
  CalendarDots,
  CalendarPlus,
  ChartLine,
  CheckSquare,
  FirstAidKit,
  Gear,
  Heart,
  // Colisão de nome: o MUI exporta `List` (componente de lista) e o Phosphor
  // também (ícone `list`) — alias LOCAL no catálogo; consumidores usam só
  // `navIcons['menu']` (escopo 13.3).
  List as ListIcon,
  Notebook,
  NotePencil,
  Pill,
  Repeat,
  SidebarSimple,
  type Icon,
} from '@phosphor-icons/react'

/**
 * Chaves estáveis do catálogo. Núcleo/chrome e controles usam chave própria;
 * as 4 collections são keyadas pelo `id` do registro (`registry.ts`).
 */
export type NavIconKey =
  // Núcleo / chrome
  | 'today'
  | 'brain-dump'
  | 'archive'
  | 'settings'
  // Grupo Planner + filhos
  | 'planner'
  | 'planner-week'
  | 'planner-month'
  | 'planner-future'
  | 'planner-recurring'
  // Grupo Saúde (agrupador não navegável)
  | 'saude'
  // Controles
  | 'sidebar-toggle'
  | 'capture'
  | 'menu'
  // Collections (por `id` do registro)
  | 'habits'
  | 'health-metrics'
  | 'medications'
  | 'gratitude'

/** Tamanho canônico dos ícones de navegação (`{components.app-shell-nav-icon}`). */
export const NAV_ICON_SIZE = 20

export const navIcons: Record<NavIconKey, Icon> = {
  // Núcleo / chrome
  today: CalendarDot,
  'brain-dump': Brain, // renderizado DENTRO do BrainDumpBadge
  archive: Archive,
  settings: Gear,
  // Grupo Planner + filhos
  //
  // Questão Aberta 1: o catálogo fechado atribui ícone de agrupador APENAS a
  // Saúde (`first-aid-kit`); a seção "GRUPO Planner" cataloga só os filhos, sem
  // glyph para o cabeçalho. `Notebook` é a decisão INTERINA desta story (a
  // confirmar com UX) — não colide com nenhum destino/controle catalogado (em
  // especial com `Calendar` de "Este Mês") e lê como "agenda/planner". Se UX
  // definir outro glyph, é troca de uma linha aqui. (13-shell-parity-checklist.md)
  planner: Notebook,
  'planner-week': CalendarDots,
  'planner-month': Calendar,
  'planner-future': CalendarPlus,
  'planner-recurring': Repeat,
  // Grupo Saúde
  saude: FirstAidKit,
  // Controles
  'sidebar-toggle': SidebarSimple,
  capture: NotePencil,
  menu: ListIcon,
  // Collections (por `id`)
  habits: CheckSquare,
  'health-metrics': ChartLine,
  medications: Pill,
  gratitude: Heart,
}

/**
 * Renderiza o ícone canônico de uma chave do catálogo, TOLERANDO chave ausente.
 *
 * O catálogo é FECHADO por design, mas as chaves de destino e de **agrupador**
 * vêm do registro como string aberta (`entry.id`, `entry.nav.group`): uma
 * collection ou um grupo novo ainda não curado não pode derrubar o chrome
 * inteiro — degrada SEM ícone, com o label/nome acessível preservados
 * (FR-1.3/AR-23; AC2 da Story 13.4, que estendeu ao agrupador o guard que existia
 * só para o destino).
 *
 * Guard ÚNICO: era duplicado como `iconFor` na `ShellSidebar`, inline no
 * `ShellNavigationSheet`/`ShellBottomNav` e AUSENTE nos dois cabeçalhos de grupo.
 */
export function navIconFor(key: NavIconKey, weight: 'regular' | 'fill' = 'regular') {
  const IconComp: Icon | undefined = navIcons[key]
  if (!IconComp) return null
  return <IconComp size={NAV_ICON_SIZE} weight={weight} />
}
