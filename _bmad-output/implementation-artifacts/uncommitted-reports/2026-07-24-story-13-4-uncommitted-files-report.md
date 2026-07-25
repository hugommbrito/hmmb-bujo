# Explicação dos arquivos não commitados — Story 13.4: Passe de paridade e acessibilidade do shell

## Visão geral

A Story 13.4 é o **passe de fechamento do Épico 13**: unifica o predicado de destino
ativo, consolida a linha de destino compartilhada (`ShellNavDestination`), fecha a
**matriz axe de 2 → 16/17 células** (medium e tablet não tinham cobertura nenhuma),
adiciona teclado/foco-não-encoberto (WCAG 2.4.11)/live-region única/zoom 200%/reflow 320,
cobre os estados ST-01…ST-06 e fecha a checklist de paridade com coluna de evidência.
100% frontend, sem migration. Legados de rollback (`AppLayout`/`Sidebar`/`BottomNav`/
`theme.ts`/`registry.ts`) com `git diff --stat` vazio.

**Decisão consciente registrada:** `prefers-reduced-motion` (UX-DR30 item 6) é
**dispensado** para o App Shell por decisão do dono (Hugo, 2026-07-24) — não é dívida nem
deferimento (waiver A11Y-07). Toda afirmação de "piso de a11y fechado" está qualificada.

**Correções de produto no ciclo (documentadas):**
- `ShellNavigationSheet` — regra `:focus-visible` reaplicada no slot `paper` do portal MUI
  (nenhum controle do sheet tinha anel de foco — A11Y-06 / WCAG 2.4.7).
- `ShellLayout` — guard de `ctrl`/`meta`/`alt` movido para antes do dispatch, valendo p/
  os dois atalhos (`Cmd+[` = "voltar" no macOS não colapsa mais a sidebar).

## Verificação (rodada de verdade)

- **Vitest:** 89 arquivos / **981 testes** passando (952 herdados + 29 novos); typecheck +
  lint limpos.
- **E2E do shell:** **95 passed** (7 specs); specs que navegam pelo chrome **29 passed**
  (fecharam 2 falhas pré-existentes de locator, test-only). Via Postgres local (credencial
  da branch Neon e2e stale; pendência ops).
- **Code review (AI): APPROVE**, sprint-status → `done`. Épico 13 fechado.

## Decisões/achados desta story (todos documentados, validados na review)

- **DIV-17 / LEG-03:** o label "Título" do Capture Sheet (portalizado pelo MUI, pintado
  pelo `primary.main` do tema legado ~2.8:1) reprova color-contrast. `theme.ts` é fora de
  escopo → escopo do axe estendido a essa superfície (nenhuma regra do axe desligada);
  inventariado. Correção real fica para a onda de superfícies.
- **2 falhas E2E pré-existentes** (`archive.spec.ts`, `daily-tasks.spec.ts`) — locators
  ambíguos; verificadas por `git stash` no baseline `2fca13f` (não são regressão da 13.4;
  a de daily-tasks vem do `BrainDumpCaptureSheet` único que a 13.3 subiu ao `ShellLayout`).
  Corrigidas no passo de QA (fix test-only, 1 linha cada).
- **LEG-04 (novo):** `HabitHistoryGrid.srOnly` usa `width: 1` no `sx` do MUI (≤1 = 100%,
  não 1px) → labels sr-only viram full-width, `/habits/history` gera scrollWidth 2136px.
  Viola NFR-1, axe não pega. **Dono: Onda 3 / Épico 14.** Inventariado (não corrigido).

## Escopo do commit (frontend + artefatos 13.x)

Frontend (código do chrome, testes unit, E2E, configs) e os artefatos BMAD da 13.4 —
conforme a File List da story. Ver a File List completa em
`13-4-passe-de-paridade-e-acessibilidade-do-shell.md`.

**NEW:** `ShellNavDestination.tsx`; E2E `shell-keyboard.spec.ts`, `shell-states.spec.ts`,
`shell-active-destination.spec.ts`, `shellHelpers.ts`, `tools/legacy-a11y-inventory.spec.ts`,
`playwright.inventory.config.ts`; `13-shell-a11y-legacy-inventory.md`; `tests/test-summary-13-4.md`;
`13-4-...md`.
**UPDATE:** `shellDestinations.ts`, `navIcons.tsx`, `ShellSidebar.tsx`,
`ShellNavigationSheet.tsx`, `ShellBottomNav.tsx`, `ShellLayout.tsx` (+ seus `.test`);
E2E `shell-a11y.spec.ts`, `shell-sidebar.spec.ts`, `shell-bottomnav.spec.ts`,
`axeHelper.ts`, `playwright.config.ts`, `archive.spec.ts`, `daily-tasks.spec.ts`;
`13-shell-parity-checklist.md`; `sprint-status.yaml`; orquestração.

## FORA deste commit (trabalho paralelo do Épico 14 — NÃO commitado aqui)

Deixado intocado, para o processo do próprio Épico 14:
`_bmad-output/implementation-artifacts/14-0-ux-mockups-complementares-do-nucleo-bujo.md`,
`_bmad-output/planning-artifacts/deferred-features.md`, e toda a árvore
`_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/` modificada/nova
(DESIGN.md, EXPERIENCE.md, .decision-log.md, review-rubric.md, validation-report.*,
mockups/key-archive.html, reconcile-story-14-0.md, story-14-0-evidence-matrix.md,
editorial-review-*-14-0.md, .working/future-vision/, .working/key-archive.html,
.working/archive-14-0-coverage-audit.md, review-accessibility-archive.md). Nenhum desses
está na File List da 13.4.
