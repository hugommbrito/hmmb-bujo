# Explicação dos arquivos não commitados — Story 13.1: Fundação do shell novo com coexistência por rota

## Visão geral

A Story 13.1 entrega a **fundação do App Shell novo** (Épico 13, Onda 2a), consumindo o
gate de UX da 13.0 (`done`). É uma implementação **100% frontend, sem migration e sem
alteração de backend**: introduz uma casca nova (`ShellLayout`) que coexiste com o
`AppLayout` legado **por rota**, decidida por um registro de dados puros
(`shellRouting.ts`) lido em `ProtectedLayout` via `useMatches()` — o mesmo mecanismo do
`RouteAnnouncer`. Rollback de uma superfície = trocar `shell: 'new'` por `'legacy'` numa
linha do registro. Tokens canônicos (`--ds-*`) entram numa camada nova
(`shared/design/tokens.ts`), **sem tocar `theme.ts`**, para não vazar a paleta nova para o
conteúdo legado durante o seam.

O commit inclui um **fix de regressão E2E** confirmado desta story: o novo `ShellTopbar`
mostra o título da superfície (`role="banner"`), o que fazia o `getByText('Histórico de
Gratidão')` do spec `gratitude-history` casar 2 elementos (o topbar + o live region do
`RouteAnnouncer`). O locator foi desambiguado para mirar só o `role="status"` do
RouteAnnouncer, preservando a intenção do assert. **O topbar não foi alterado** (é design
aprovado na 13.0, decisão B "superfície como protagonista").

Escopo do commit: código do shell (`layout/shell/*`), tokens (`shared/design/*`),
`router.tsx`, specs E2E (novas + o fix da gratitude), `package.json`/`package-lock.json`
(devDependency `@axe-core/playwright`), o arquivo da story, o checklist de paridade, o
`sprint-status.yaml` e os artefatos de orquestração desta rodada.

**Fora do commit (proposital):** o arquivo da Story 13.2
(`13-2-sidebar-nova-derivada-do-manifest.md`) foi criado em paralelo (para aproveitar a
janela do E2E), mas pertence ao commit da 13.2 — mantido não commitado aqui para preservar
"1 commit por story".

## Verificação (rodada de verdade)

- **Vitest** (`npm run test:run`): **85 arquivos / 881 testes** passando (baseline da story:
  81/828 → +4 arquivos, +53 testes novos). typecheck + lint limpos.
- **E2E completa (com shell, CI=1, workers=1):** **99 passed / 4 failed** (34,4 min). Das 4
  falhas, **só `gratitude-history` era regressão da 13.1** (agora corrigida). As outras 3 —
  `archive.spec.ts:38`, `recurring-templates.spec.ts:306`, `task-reorder.spec.ts:58` — são
  **PRÉ-EXISTENTES**: rodadas no baseline `ee50f10` com o shell desligado deram **3 failed /
  8 passed**, ou seja, falham igual sem a 13.1. São dívida de teste separada, não regressão
  desta story, e **não bloqueiam** a 13.1 (AC7 = "sem regressão introduzida por esta story").
- **`gratitude-history.spec.ts` isolada após o fix:** 1 passed (24,1 s).

---

## 1. Código do shell (novo)

### `frontend/src/app/layout/shell/ShellLayout.tsx` (novo)
Casca nova: monta topbar + skip link + `LegacySeamNotice` + `<Outlet />` num wrapper focável
(alvo do skip link). **Não renderiza um segundo `<main>`** (há testes de regressão contra
isso). Geometria toda por `var(--ds-*)`; reserva de scroll para topbar/bottom-nav/FAB/safe-area.

### `frontend/src/app/layout/shell/ShellTopbar.tsx` (novo)
Topbar "superfície como protagonista": mostra o `handle.title` do match mais profundo como
`<strong>` estático (nunca live region) dentro de `role="banner"`. Fonte de verdade igual à
do `RouteAnnouncer`.

### `frontend/src/app/layout/shell/SkipLink.tsx` (novo)
Skip link como primeiro elemento focável, mirando o wrapper do conteúdo.

### `frontend/src/app/layout/shell/LegacySeamNotice.tsx` (novo)
Faixa editorial do seam (não `role=alert`, sem dispensar/toggle); some quando
`surfaceMigrated=true`.

### `frontend/src/app/layout/shell/shellRouting.ts` (novo)
Registro de dados puros da coexistência por rota (`resolveShellRoute`): decide shell
`new`/`legacy` por rota e expõe `surfaceMigrated`. Rollback por superfície = 1 linha.

### Testes unitários do shell (novos)
`ShellLayout.test.tsx` (22), `LegacySeamNotice.test.tsx` (6), `shellRouting.test.ts` (9).

## 2. Tokens (camada nova)

### `frontend/src/shared/design/tokens.ts` (novo) + `tokens.test.ts` (16)
Tokens canônicos como dados puros (estruturais + Mineral Light/Dark), aplicados como
`--ds-*` na raiz do shell. `theme.ts` **intocado** de propósito.

## 3. Ativação da coexistência

### `frontend/src/app/router.tsx` (modificado)
Único UPDATE de fonte do app: `ProtectedLayout` passa a escolher `ShellLayout` (novo) vs
`AppLayout` (legado) via `resolveShellRoute(useMatches())`. Legado permanece como rota de
rollback.

## 4. E2E

### `frontend/e2e/shell.spec.ts` (novo)
7 testes de comportamento do shell (skip link, tokens estruturais, topbar reflete a
superfície com um único main, atalho `[`).

### `frontend/e2e/shell-a11y.spec.ts` + `axeHelper.ts` (novos)
axe-core (WCAG 2.2 AA) no chrome do shell em wide e compact.

### `frontend/e2e/gratitude-history.spec.ts` (modificado — FIX de regressão)
Locator desambiguado: `getByText('Histórico de Gratidão')` →
`getByRole('status').filter({ hasText: 'Histórico de Gratidão' })`, mirando o RouteAnnouncer
e evitando a colisão com o título homônimo do topbar.

## 5. Dependência

### `frontend/package.json` + `frontend/package-lock.json` (modificados)
`@axe-core/playwright` como devDependency (usado pelo `shell-a11y.spec.ts`).

## 6. Artefatos da story

### `_bmad-output/implementation-artifacts/13-1-fundacao-do-shell-novo-com-coexistencia-por-rota.md` (novo)
Arquivo da story com ACs, tasks, Dev Agent Record, Completion Notes e Senior Developer
Review (AI).

### `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md` (novo)
Inventário enumerado e verificável do chrome real (origem arquivo/linha no baseline
`ee50f10`), contrato de paridade para as Stories 13.1–13.4, com divergências contratadas,
dívidas e seção de rollback.

### `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado)
`13-1-...` → `done`.

## 7. Orquestração (story-automator, rodada 13)

`orchestration-13-20260724-130311.md` (estado), `agents-orchestration-13-...md`,
`complexity-orchestration-13-...json`, `preflight-13-...md`,
`policy-snapshots/20260724-130311-79b3b368.json`, `init-log-20260724T124715Z.md`.
Artefatos determinísticos da rodada; seguem o precedente das rodadas 1–12.
