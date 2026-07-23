// ─────────────────────────────────────────────────────────────────────────────
// Manifest estático de collections — fatia 1 do modelo núcleo + collections.
//
//   ▶ DoD estrutural: collection nova = pasta da feature + UMA entrada neste
//     registro. (Story 12.3 / AD-17)
//
// Este registro é DADOS PUROS: sem hooks, sem TanStack Query, sem side effects no
// eval do módulo (nenhuma chamada de função no top-level além de `React.lazy`, que
// só embrulha o `import()` sem executá-lo). Seus consumidores são o chrome
// (`router.tsx`, `Sidebar.tsx`, `BottomNav.tsx`), que derivam navegação e rotas
// por map puro.
//
// NÃO existe flag de ativação nesta fatia: todas as collections ficam
// implicitamente ativas. A ativação/gateamento futuro será uma consulta separada
// que *filtra* este registro, deferida ao Épico 10 (AD-17 item 6).
//
// [Source: architecture.md#AD-17; epics.md#Epic-12 / Story-12.3; FR-1.1/1.2/1.3]
// ─────────────────────────────────────────────────────────────────────────────
import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import type { SvgIconComponent } from '@mui/icons-material'

import RepeatIcon from '@mui/icons-material/Repeat'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import MedicationIcon from '@mui/icons-material/Medication'
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt'

/**
 * Taxonomia de archetypes de collection (FR-1.2 / AD-17) — union de string
 * literals, não enum (o registro é dados puros).
 */
export type CollectionArchetype =
  | 'coded_fixed'
  | 'coded_user_fields'
  | 'coded_integration'
  | 'custom_container'

/** Dados de navegação de uma collection (Sidebar / BottomNav). */
export interface CollectionNav {
  /** Rótulo curto exibido na navegação (pode diferir de `name`). */
  label: string
  /** Chave do grupo colapsável (ex.: `'saude'`) ou ausente (item avulso). */
  group?: string
  /** Índice para ordenação estável dentro do grupo/avulsos. */
  order: number
}

/** Uma rota própria da collection (principal ou histórico). */
export interface CollectionRoute {
  /** Path relativo ao root do router (ex.: `'habits'`, `'health/metrics'`). */
  path: string
  /** Componente da rota como referência lazy (`React.lazy`). */
  component: LazyExoticComponent<ComponentType>
  /** Título da superfície, lido por `handle.title` (RouteAnnouncer). */
  title: string
}

/**
 * Reservado (AD-17 item 2) — campo tipado SEM consumidores nesta fatia. A forma
 * real será definida pelo consumidor futuro (home/dashboard da Onda 2b).
 */
export type CollectionDashboardCard = Record<string, never>

/**
 * Reservado (AD-17 item 2) — campo tipado SEM consumidores nesta fatia. A forma
 * real será definida pelo consumidor futuro (configuração por-collection).
 */
export type CollectionSettingsSchema = Record<string, never>

/** Forma canônica de uma entrada do registro (AD-17 item 2). */
export interface CollectionManifestEntry {
  /** Slug estável da collection. */
  id: string
  /** Nome canônico da collection (= título da rota principal). */
  name: string
  /** Ícone MUI da collection (exatamente o usado hoje na Sidebar). */
  icon: SvgIconComponent
  /** Rotas próprias (principal + histórico), como referências lazy. */
  routes: CollectionRoute[]
  /** Dados de navegação. */
  nav: CollectionNav
  /** Archetype na taxonomia FR-1.2. */
  archetype: CollectionArchetype
  /** Reservado, sem consumidores nesta fatia. */
  dashboardCard?: CollectionDashboardCard
  /** Reservado, sem consumidores nesta fatia. */
  settingsSchema?: CollectionSettingsSchema
}

// Nota: `MedicationsPage`/`MedicationHistoryPage` vivem em `pages/health/`
// (não `pages/medications/`), embora a feature seja `features/medications/`.
// As Pages exportam nomes (não `default`), então o `lazy` mapeia o export
// nomeado para `default` — sem alterar as Pages (AC4).
export const collections: CollectionManifestEntry[] = [
  {
    id: 'habits',
    name: 'Hábitos',
    icon: RepeatIcon,
    archetype: 'coded_fixed',
    nav: { label: 'Hábitos', order: 0 },
    routes: [
      {
        path: 'habits',
        title: 'Hábitos',
        component: lazy(() =>
          import('../../pages/habits/HabitsPage').then((m) => ({ default: m.HabitsPage })),
        ),
      },
      {
        path: 'habits/history',
        title: 'Hábitos — Histórico',
        component: lazy(() =>
          import('../../pages/habits/HabitHistoryPage').then((m) => ({
            default: m.HabitHistoryPage,
          })),
        ),
      },
    ],
  },
  {
    id: 'health-metrics',
    name: 'Métricas de Saúde',
    icon: ShowChartIcon,
    archetype: 'coded_user_fields',
    nav: { label: 'Métricas', group: 'saude', order: 0 },
    routes: [
      {
        path: 'health/metrics',
        title: 'Métricas de Saúde',
        component: lazy(() =>
          import('../../pages/health/HealthMetricsPage').then((m) => ({
            default: m.HealthMetricsPage,
          })),
        ),
      },
      {
        path: 'health/metrics/history',
        title: 'Métricas de Saúde — Histórico',
        component: lazy(() =>
          import('../../pages/health/HealthHistoryPage').then((m) => ({
            default: m.HealthHistoryPage,
          })),
        ),
      },
    ],
  },
  {
    id: 'medications',
    name: 'Medicamentos',
    icon: MedicationIcon,
    archetype: 'coded_fixed',
    nav: { label: 'Medicamentos', group: 'saude', order: 1 },
    routes: [
      {
        path: 'health/medications',
        title: 'Medicamentos',
        component: lazy(() =>
          import('../../pages/health/MedicationsPage').then((m) => ({
            default: m.MedicationsPage,
          })),
        ),
      },
      {
        path: 'health/medications/history',
        title: 'Medicamentos — Histórico',
        component: lazy(() =>
          import('../../pages/health/MedicationHistoryPage').then((m) => ({
            default: m.MedicationHistoryPage,
          })),
        ),
      },
    ],
  },
  {
    id: 'gratitude',
    name: 'Diário de Gratidão',
    icon: SentimentSatisfiedAltIcon,
    archetype: 'coded_fixed',
    nav: { label: 'Gratidão', order: 1 },
    routes: [
      {
        path: 'gratitude',
        title: 'Diário de Gratidão',
        component: lazy(() =>
          import('../../pages/gratitude/GratitudePage').then((m) => ({
            default: m.GratitudePage,
          })),
        ),
      },
      {
        path: 'gratitude/history',
        title: 'Histórico de Gratidão',
        component: lazy(() =>
          import('../../pages/gratitude/GratitudeHistoryPage').then((m) => ({
            default: m.GratitudeHistoryPage,
          })),
        ),
      },
    ],
  },
]
