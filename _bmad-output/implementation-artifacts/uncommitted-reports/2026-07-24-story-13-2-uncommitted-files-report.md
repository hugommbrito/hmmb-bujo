# Explicação dos arquivos não commitados — Story 13.2: Sidebar nova derivada do manifest

## Visão geral

A Story 13.2 entrega a **sidebar do shell novo derivada do manifest de collections**
(Épico 13, Onda 2a), sobre a fundação da 13.1. 100% frontend, sem migration: o
`ShellSidebar` deriva os destinos por **map puro do registro** (`collections/registry`),
usa o **catálogo fechado de ícones Phosphor** (`navIcons.tsx`, `@phosphor-icons/react` —
dependência que a 13.1 deferiu para cá) e a geometria vem exclusivamente de tokens
(`--ds-sidebar-expanded` 240 / `--ds-sidebar-collapsed` 64 — resolvendo a divergência
DIV-1 56→64 registrada no checklist de paridade). Rail colapsável (atalho `[` + toggle;
estado só da sessão, nada persistido), `aria-current` no destino ativo, agrupador com
`.contains` acessível quando recolhido com rota ativa dentro, e badge do Brain Dump
(cap `9+`) estilizado pelos 4 tokens de `app-shell-badge` via `badgeSx`. Legados
(`Sidebar.tsx` MUI) intocados como rollback.

## Verificação (rodada de verdade)

- **Vitest:** **86 arquivos / 907 testes** passando (901 do dev + 2 da review + contagem
  re-observada pós-chore); typecheck + lint limpos.
- **E2E da story:** **19 passed (1,0 min)** — `shell-sidebar.spec.ts` (10) +
  `shell.spec.ts` (7) + `shell-a11y.spec.ts` (2), incluindo axe com o rail colapsado e o
  badge `9+` com seed real (`seedBrainDumpItems.ts`).
  - Nota de ambiente: rodado contra **Postgres local** (`bujo_e2e`) porque a credencial
    da branch Neon e2e está stale (pendência ops registrada; runbook
    `docs/e2e-neon-reset.md` §2). O full-E2E cross-app fica para quando a credencial for
    renovada — fora do escopo desta story.
- **Code review (AI): APPROVE** — 0 críticos; 4 médios + 2 baixos, todos corrigidos na
  própria review (destaques: `iconFor` degrada sem ícone em vez de crashar o shell para
  collection futura fora do catálogo; teste de integração do badge; File List completado).

## 1. Sidebar nova (código)

### `frontend/src/app/layout/shell/ShellSidebar.tsx` (novo)
Rail 240/64 por tokens; derivação por map puro do manifest; `aria-current="page"`;
agrupador colapsado com `.contains` + descrição acessível; toggle + atalho `[` (guards
iguais ao legado); sem imports de TanStack Query nem @mui/icons (grep-verificado).

### `frontend/src/app/layout/shell/navIcons.tsx` (novo)
Catálogo Phosphor **fechado** (20px, `currentColor`, `fill` no ativo) mapeado por
identidade estável; `iconFor` degrada graciosamente (label sem ícone) para id fora do
catálogo — collection futura não derruba o shell.

### `frontend/src/app/layout/shell/ShellSidebar.test.tsx` (novo — 19 testes)
Ordem canônica, navegação real, estados ativo/colapsado, tokens de geometria (e ausência
dos literais legados), acessibilidade (AC4/AC5), integração do badge (max=9 + badgeSx),
não-crash com collection injetada fora do catálogo.

### `frontend/src/app/layout/shell/ShellLayout.tsx` (modificado)
Troca `Sidebar` legado → `ShellSidebar` no chrome do shell.

### `frontend/src/features/braindump/components/BrainDumpBadge.tsx` + `.test.tsx` (modificados)
Badge aceita `max` e `badgeSx` (estilo por tokens vindo do shell), preservando o
comportamento legado; testes cobrem cap `9+` e repasse de estilo.

## 2. Dependência

### `frontend/package.json` + `package-lock.json` (modificados)
`@phosphor-icons/react` (planejado na 13.1 para entrar aqui).

## 3. E2E

### `frontend/e2e/shell-sidebar.spec.ts` (novo — 10 testes)
Ordem/navegação derivadas do manifest, estados visuais do ativo, ícones Phosphor,
geometria 240↔64 por tokens, colapso session-only, `.contains` do agrupador, badge 9+
com seed real, falha do contador não bloqueia navegação, axe no rail, tablet inicia em 64.

### `frontend/e2e/seedBrainDumpItems.ts` (novo)
Seed de itens do Brain Dump via `manage.py shell` (mesmo padrão dos seeds existentes,
`backendEnv.ts` → settings e2e).

## 4. Artefatos

### `_bmad-output/implementation-artifacts/13-2-sidebar-nova-derivada-do-manifest.md` (novo)
Story com ACs, tasks, Dev Agent Record, Completion Notes e Senior Developer Review (AI).

### `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md` (modificado)
Itens da 13.2 marcados (DIV-1 56→64 resolvida; estados do rail/badge/ícones).

### `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado)
`13-2-...` → `done`.

### `_bmad-output/story-automator/orchestration-13-20260724-130311.md` (modificado)
Log da orquestração da rodada (inclui o diagnóstico do vazamento de env que motivou o
chore e9cba41, commitado à parte).
