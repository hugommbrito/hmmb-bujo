import { describe, it, expect } from 'vitest'

import { collections } from '../../collections/registry'
import { routeDefinitions } from '../../router'
import {
  DEFAULT_SHELL_ROUTE,
  resolveShellRoute,
  shellRoutes,
  type ShellRouteEntry,
} from './shellRouting'
// `?raw` (suportado por vite/client) traz o código-fonte como string, sem
// precisar de tipos de node — o teste de dados puros inspeciona o texto.
import shellRoutingSource from './shellRouting.ts?raw'

/** Paths autenticados declarados no router (filhos de `/`), exceto o catch-all. */
function authenticatedRoutePaths(): string[] {
  const root = routeDefinitions.find((route) => route.path === '/')
  if (!root?.children) throw new Error('rota raiz autenticada ausente em routeDefinitions')
  return root.children
    .map((child) => child.path)
    .filter((path): path is string => Boolean(path) && path !== '*')
}

describe('shellRouting — registro por rota', () => {
  it('test_toda_rota_autenticada_do_router_tem_entrada_no_registro', () => {
    const registered = new Set(shellRoutes.map((entry) => entry.routeId))
    for (const path of authenticatedRoutePaths()) {
      expect(registered.has(path)).toBe(true)
    }
  })

  it('test_toda_rota_de_collection_do_registro_tem_entrada', () => {
    const registered = new Set(shellRoutes.map((entry) => entry.routeId))
    for (const collection of collections) {
      for (const route of collection.routes) {
        expect(registered.has(route.path)).toBe(true)
      }
    }
  })

  it('test_registro_nao_tem_entradas_orfas_nem_duplicadas', () => {
    const routerPaths = new Set(authenticatedRoutePaths())
    const ids = shellRoutes.map((entry) => entry.routeId)

    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(routerPaths.has(id)).toBe(true)
    }
  })

  it('test_forma_de_cada_entrada', () => {
    for (const entry of shellRoutes) {
      const shape: ShellRouteEntry = entry
      expect(typeof shape.routeId).toBe('string')
      expect(['new', 'legacy']).toContain(shape.shell)
      expect(typeof shape.surfaceMigrated).toBe('boolean')
      expect(Object.keys(shape).sort()).toEqual(['routeId', 'shell', 'surfaceMigrated'])
    }
  })

  // A partir da Story 14.5, `planner/week` é a PRIMEIRA superfície migrada —
  // o nome do teste original ("nenhuma superfície migrada") descrevia o
  // estado inicial da Story 13.1 e deixou de ser verdade por construção.
  // Story 14.6 acrescenta a segunda superfície (`planner/month`).
  const MIGRATED_ROUTE_IDS = new Set([
    'planner/week',
    'planner/week/planning',
    'planner/month',
    'planner/month/planning',
    // Story 14.7 (M08) — Future Log no sistema novo.
    'planner/future',
    // Story 14.8 (M09) — biblioteca de Recorrentes no sistema novo.
    'planner/recurring',
    // Story 14.9 (M10) — ritual de migração/catch-up no sistema novo.
    'migration',
    // Story 14.10 — Arquivo no sistema novo (índice + as 2 rotas de detalhe).
    'archive',
    'archive/weekly/:weekStart',
    'archive/monthly/:monthFirst',
    // Story 15.1 (M11) — Brain Dump/Inbox no sistema novo.
    'brain-dump',
    // Story 16.1 (M12) — Hábitos no sistema novo (superfície única + os dois
    // deep links antigos, que agora redirecionam para as abas).
    'habits',
    'habits/history',
    'settings/habits',
  ])

  it('test_shell_e_novo_em_tudo_e_apenas_as_rotas_migradas_tem_surfaceMigrated_true', () => {
    for (const entry of shellRoutes) {
      expect(entry.shell).toBe('new')
      expect(entry.surfaceMigrated).toBe(MIGRATED_ROUTE_IDS.has(entry.routeId))
    }
  })

  it('test_planner_week_e_a_primeira_rota_migrada_desta_story', () => {
    const entry = shellRoutes.find((route) => route.routeId === 'planner/week')
    expect(entry?.surfaceMigrated).toBe(true)
  })

  it('test_planner_future_e_a_rota_migrada_da_story_14_7', () => {
    const entry = shellRoutes.find((route) => route.routeId === 'planner/future')
    expect(entry?.surfaceMigrated).toBe(true)
  })

  it('test_planner_recurring_e_a_rota_migrada_da_story_14_8', () => {
    const entry = shellRoutes.find((route) => route.routeId === 'planner/recurring')
    expect(entry?.surfaceMigrated).toBe(true)
    // Irmã de NÃO-VACUIDADE, reancorada: até a 14.7 o par era
    // `planner/future` × `planner/recurring`, mas a M09 migrou o segundo. O
    // novo controle é `settings` — destino de TOPO (imune ao rail colapsado do
    // tablet) e a superfície legada de vida mais longa da fila (Épico 18.1),
    // exatamente pela mesma razão registrada nos specs de seam E2E.
    expect(shellRoutes.find((route) => route.routeId === 'settings')?.surfaceMigrated).toBe(false)
  })

  it('test_migration_e_a_rota_migrada_da_story_14_9', () => {
    const entry = shellRoutes.find((route) => route.routeId === 'migration')
    expect(entry?.surfaceMigrated).toBe(true)
    // Irmã de NÃO-VACUIDADE: `today`/`daily/:date` continuam `false` — só o
    // RITUAL roteado é migrado, o Daily legado (com seus banners) segue
    // intocado até o Épico 17.
    expect(shellRoutes.find((route) => route.routeId === 'today')?.surfaceMigrated).toBe(false)
    expect(shellRoutes.find((route) => route.routeId === 'daily/:date')?.surfaceMigrated).toBe(false)
  })

  it('test_brain_dump_e_a_rota_migrada_da_story_15_1', () => {
    const entry = shellRoutes.find((route) => route.routeId === 'brain-dump')
    expect(entry?.surfaceMigrated).toBe(true)
    // Irmã de NÃO-VACUIDADE (mesmo padrão das demais rotas migradas acima):
    // `settings` continua `false` — a flag não "vazou" para toda rota ainda
    // não migrada.
    expect(shellRoutes.find((route) => route.routeId === 'settings')?.surfaceMigrated).toBe(false)
  })

  it('test_as_tres_rotas_de_habitos_sao_migradas_na_story_16_1', () => {
    for (const routeId of ['habits', 'habits/history', 'settings/habits']) {
      expect(shellRoutes.find((route) => route.routeId === routeId)?.surfaceMigrated).toBe(true)
    }
    // Irmã de NÃO-VACUIDADE: as demais rotas de settings e as outras
    // collections continuam `false` — a flag não vazou.
    expect(shellRoutes.find((route) => route.routeId === 'settings')?.surfaceMigrated).toBe(false)
    expect(
      shellRoutes.find((route) => route.routeId === 'settings/health-metrics')?.surfaceMigrated,
    ).toBe(false)
    expect(shellRoutes.find((route) => route.routeId === 'gratitude')?.surfaceMigrated).toBe(false)
  })

  it('test_resolve_rota_estatica_e_rota_parametrizada', () => {
    expect(resolveShellRoute('/today').routeId).toBe('today')
    expect(resolveShellRoute('/planner/week').routeId).toBe('planner/week')
    expect(resolveShellRoute('/daily/2026-07-24').routeId).toBe('daily/:date')
    expect(resolveShellRoute('/migration').routeId).toBe('migration')
    expect(resolveShellRoute('/archive/weekly/2026-07-20').routeId).toBe(
      'archive/weekly/:weekStart',
    )
    expect(resolveShellRoute('/health/metrics/history').routeId).toBe('health/metrics/history')
  })

  it('test_rota_desconhecida_cai_no_default_seguro', () => {
    const entry = resolveShellRoute('/rota-que-nao-existe')
    expect(entry).toBe(DEFAULT_SHELL_ROUTE)
    expect(entry.shell).toBe('new')
    expect(entry.surfaceMigrated).toBe(false)
  })

  it('test_resolucao_tolera_barras_de_borda', () => {
    expect(resolveShellRoute('today').routeId).toBe('today')
    expect(resolveShellRoute('/today/').routeId).toBe('today')
  })

  it('test_registro_e_dados_puros_sem_hooks_nem_query', () => {
    // AC 7: o registro é dados puros justamente para não obrigar mocks novos de
    // TanStack Query nos 3 testes compartilhados do chrome.
    const source = shellRoutingSource
    expect(source).not.toMatch(/@tanstack\/react-query/)
    expect(source).not.toMatch(/\buse[A-Z]\w*\(/)
    expect(source).not.toMatch(/import\.meta\.env/)
    expect(source).not.toMatch(/from ['"]react['"]/)
  })
})
