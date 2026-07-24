# Explicação dos arquivos não commitados — Story 13.3: Bottom-nav e captura persistente mobile

## Visão geral

A Story 13.3 entrega a **navegação mobile do shell novo** (Épico 13, Onda 2a): a
`ShellBottomNav` (bottom-nav compacto) + `ShellNavigationSheet` (folha "Menu" com o
inventário completo) + o FAB de **captura persistente** do Brain Dump. A derivação de
destinos foi extraída para `shellDestinations.ts` (dados puros, `deriveShellNavItems` /
`SHELL_BADGE_SX`) e passou a ser compartilhada entre a sidebar (13.2) e a nova navegação
mobile — por isso `ShellSidebar.tsx`, `navIcons.tsx` e `tokens.ts` aparecem como
modificados (refatoração sem mudança de comportamento + token `bottomNavHeight` 56→64).
Legados (`BottomNav`/`Sidebar`/`AppLayout`) intocados como rollback. 100% frontend, sem
migration.

## Verificação (rodada de verdade)

- **Vitest:** **89 arquivos / 952 testes** passando (907 herdados + 41 do dev + 4 da
  review); typecheck + lint limpos. Os 4 testes novos da review foram provados
  **não-vacuosos** (revertendo cada fix, o teste correspondente falha — 4/4).
- **E2E shell:** **41 passed (1,6 min)** — 4 specs do shell incl. 8 novos em
  `shell-bottomnav.spec.ts`, zero regressão.
  - Ambiente: rodado contra **Postgres local** (`bujo_e2e`) — a credencial da branch Neon
    e2e segue stale (pendência ops registrada; runbook `docs/e2e-neon-reset.md` §2).
- **Code review (AI): APPROVE**, sprint-status → `done`.

## Desvios contratados e dívidas (documentados, não são bugs)

- 3 desvios nas Completion Notes: fluxo mobile do `RouteAnnouncer.test` migrou para
  Menu→sheet (a aba "Hábitos" legada deixou de existir por design); assert do badge da
  sidebar fortalecido para 2 badges (AC5); `keepMounted: false` no sheet.
- 2 questões abertas seguiram decisão interina e foram empurradas para o passe da **13.4**
  (aria-current no Menu; ícone 24px no FAB).
- Dívidas registradas no checklist para a **13.4** (deliberadamente não corrigidas aqui):
  **SHELL-DEBT-03** (ShellSidebar com ativo por match exato), **SHELL-DEBT-04**
  (`deriveShellNavItems` escolhe collections avulsas por id hardcoded habits/gratitude →
  uma collection avulsa nova não apareceria), e a duplicação de ~90 linhas de
  `renderDestination`/`renderGroup` entre sidebar e sheet.

## Arquivos

### Novos — navegação mobile
- `frontend/src/app/layout/shell/ShellBottomNav.tsx` (+ `.test.tsx`) — bottom-nav compacto.
- `frontend/src/app/layout/shell/ShellNavigationSheet.tsx` (+ `.test.tsx`) — folha "Menu"
  com inventário completo; foco devolvido ao Menu ao fechar; Escape/backdrop fecham.
- `frontend/src/app/layout/shell/shellDestinations.ts` (+ `.test.ts`) — derivação de
  destinos como dados puros, compartilhada sidebar↔mobile.
- `frontend/e2e/shell-bottomnav.spec.ts` — 8 testes E2E (bottom-nav, sheet, FAB, foco,
  safe-area, alvo ≥ 44px).

### Modificados — integração/refatoração
- `frontend/src/app/layout/shell/ShellLayout.tsx` — monta bottom-nav + FAB no compact.
- `frontend/src/app/layout/shell/ShellSidebar.tsx` (+ `.test.tsx`) — passa a consumir
  `shellDestinations` (sem mudança de comportamento).
- `frontend/src/app/layout/shell/navIcons.tsx`, `frontend/src/shared/design/tokens.ts` —
  ícones/token do bottom-nav (bottomNavHeight 56→64).
- `frontend/e2e/shell.spec.ts`, `shell-a11y.spec.ts` — cobertura estendida ao compact.
- `frontend/src/app/layout/RouteAnnouncer.test.tsx`, `frontend/src/app/router.test.tsx` —
  fluxo mobile agora via Menu→sheet (aba legada não existe mais no shell novo).

### Artefatos
- `_bmad-output/implementation-artifacts/13-3-bottom-nav-e-captura-persistente-mobile.md`
  — story (ACs, Dev Agent Record, Completion Notes, Senior Developer Review).
- `_bmad-output/implementation-artifacts/tests/test-summary-13-3.md` — auditoria + mapa por AC.
- `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md` — itens 13.3 + dívidas 13.4.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `13-3-...` → `done`.
- `_bmad-output/story-automator/orchestration-13-20260724-130311.md` — log da rodada.
