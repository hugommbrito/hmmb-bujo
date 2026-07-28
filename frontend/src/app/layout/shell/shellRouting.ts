// ─────────────────────────────────────────────────────────────────────────────
// Registro de coexistência por rota — qual casca cada rota autenticada monta e
// se a superfície interna daquela rota já foi migrada para o sistema novo.
//
//   ▶ DADOS PUROS: sem hooks, sem TanStack Query, sem env, sem side effects —
//     mesmo espírito do manifest de collections (AD-17 / Story 12.3). Server
//     state no chrome obrigaria mocks de Query nos 3 testes compartilhados
//     (`AppLayout`/`router`/`RouteAnnouncer`); manter puro é o que preserva o
//     AC 7 desta story.
//
//   ▶ ROLLBACK POR SUPERFÍCIE = UMA LINHA: trocar `shell: 'new'` por
//     `shell: 'legacy'` na entrada da rota. O procedimento completo (arquivo,
//     campo, efeito, verificação) está em
//     `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md`,
//     seção "Rollback por superfície".
//
//   ▶ Sem flag de ambiente, sem feature flag remota, sem toggle de UI. O
//     seletor visível "Legado/Moderno" está explicitamente REJEITADO no
//     reconcile da Story 13.0.
//
// [Source: epics.md#Story-13.1 — AC2/AC3; UX-DR21/UX-DR22/UX-DR30]
// [Source: ux-designs/.../EXPERIENCE.md#State-Patterns — Seam legado]
// [Source: architecture.md#AD-17]
// ─────────────────────────────────────────────────────────────────────────────

/** Casca que a rota monta: shell novo (13.1) ou `AppLayout` legado (rollback). */
export type ShellKind = 'new' | 'legacy'

export interface ShellRouteEntry {
  /**
   * Padrão de path da rota, exatamente como declarado em `router.tsx` (relativo
   * à raiz autenticada, sem barra inicial). Segmentos `:param` casam qualquer
   * valor não vazio.
   */
  routeId: string
  /** Casca que renderiza esta rota. Rollback = trocar para `'legacy'`. */
  shell: ShellKind
  /** A superfície INTERNA já foi migrada? `false` ⇒ a rota mostra o seam. */
  surfaceMigrated: boolean
}

/**
 * Estado inicial da Story 13.1: o shell é novo em **todo** o app e **nenhuma**
 * superfície interna foi migrada — logo, toda rota autenticada mostra o seam.
 * É o comportamento contratado, não efeito colateral: o seam some rota a rota
 * conforme as Ondas 3–5 migram cada superfície.
 */
export const shellRoutes: readonly ShellRouteEntry[] = [
  // ─── Núcleo ────────────────────────────────────────────────────────────────
  { routeId: 'today', shell: 'new', surfaceMigrated: false },
  { routeId: 'daily/:date', shell: 'new', surfaceMigrated: false },
  // Story 14.9 (M10): ritual de migração/catch-up — rota NOVA, já nasce com
  // `surfaceMigrated: true` (é uma superfície do sistema novo desde o dia 1,
  // nunca teve seam legado). `today`/`daily/:date` acima permanecem `false` —
  // só o RITUAL é migrado, o Daily legado segue intocado até o Épico 17.
  { routeId: 'migration', shell: 'new', surfaceMigrated: true },
  // Story 14.5: PRIMEIRA superfície interna migrada — `LegacySeamNotice`
  // desaparece só nesta rota (e na do ritual, abaixo).
  { routeId: 'planner/week', shell: 'new', surfaceMigrated: true },
  // Segmentos diferentes de `planner/week` — `matchesPattern` exige
  // igualdade de contagem de segmentos, então precisa de entrada própria.
  { routeId: 'planner/week/planning', shell: 'new', surfaceMigrated: true },
  // Story 14.6: SEGUNDA superfície interna migrada — `LegacySeamNotice`
  // desaparece também nessas duas rotas.
  { routeId: 'planner/month', shell: 'new', surfaceMigrated: true },
  { routeId: 'planner/month/planning', shell: 'new', surfaceMigrated: true },
  // Story 14.7: TERCEIRA superfície interna migrada (Future Log / M08) — o
  // `LegacySeamNotice` desaparece também nesta rota.
  { routeId: 'planner/future', shell: 'new', surfaceMigrated: true },
  // Story 14.8: QUARTA superfície interna migrada (Recorrentes / M09) — o
  // `LegacySeamNotice` desaparece também nesta rota.
  { routeId: 'planner/recurring', shell: 'new', surfaceMigrated: true },
  { routeId: 'brain-dump', shell: 'new', surfaceMigrated: false },
  // Story 14.10: QUINTA superfície interna migrada (Arquivo) — o
  // `LegacySeamNotice` desaparece também nas 3 rotas do Arquivo.
  { routeId: 'archive', shell: 'new', surfaceMigrated: true },
  { routeId: 'archive/weekly/:weekStart', shell: 'new', surfaceMigrated: true },
  { routeId: 'archive/monthly/:monthFirst', shell: 'new', surfaceMigrated: true },
  { routeId: 'settings', shell: 'new', surfaceMigrated: false },
  { routeId: 'settings/habits', shell: 'new', surfaceMigrated: false },
  { routeId: 'settings/health-metrics', shell: 'new', surfaceMigrated: false },
  { routeId: 'settings/medications', shell: 'new', surfaceMigrated: false },

  // ─── Derivadas do registro de collections (Story 12.3) ─────────────────────
  // Enumeradas explicitamente (e não geradas por map) porque o rollback por
  // superfície exige que cada entrada seja editável em uma linha. O teste
  // `shellRouting.test.ts` garante que nenhuma rota do registro fique de fora.
  { routeId: 'habits', shell: 'new', surfaceMigrated: false },
  { routeId: 'habits/history', shell: 'new', surfaceMigrated: false },
  { routeId: 'health/metrics', shell: 'new', surfaceMigrated: false },
  { routeId: 'health/metrics/history', shell: 'new', surfaceMigrated: false },
  { routeId: 'health/medications', shell: 'new', surfaceMigrated: false },
  { routeId: 'health/medications/history', shell: 'new', surfaceMigrated: false },
  { routeId: 'gratitude', shell: 'new', surfaceMigrated: false },
  { routeId: 'gratitude/history', shell: 'new', surfaceMigrated: false },
]

/**
 * Entrada de fallback para pathname sem correspondência (ex.: o catch-all `*`,
 * que redireciona para `/today`). Default seguro: shell novo, seam ligado —
 * nunca esconder o seam por omissão.
 */
export const DEFAULT_SHELL_ROUTE: ShellRouteEntry = {
  routeId: '*',
  shell: 'new',
  surfaceMigrated: false,
}

function segmentsOf(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0)
}

function matchesPattern(pattern: string, pathname: string): boolean {
  const patternSegments = segmentsOf(pattern)
  const pathSegments = segmentsOf(pathname)
  if (patternSegments.length !== pathSegments.length) return false
  return patternSegments.every(
    (segment, index) => segment.startsWith(':') || segment === pathSegments[index],
  )
}

/**
 * Resolve a entrada do registro para um pathname já resolvido (o do match mais
 * profundo do router). Funções puras: nenhum hook aqui — quem chama lê o match
 * ativo no componente e passa o pathname.
 */
export function resolveShellRoute(pathname: string): ShellRouteEntry {
  return (
    shellRoutes.find((entry) => matchesPattern(entry.routeId, pathname)) ?? DEFAULT_SHELL_ROUTE
  )
}
