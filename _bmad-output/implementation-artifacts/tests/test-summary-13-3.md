# Test Automation Summary — Story 13.3 (Bottom nav e captura persistente mobile)

**Data:** 2026-07-24 · **QA:** HugoMMBrito · **Executor:** workflow `bmad-qa-generate-e2e-tests`
**Frameworks:** Playwright 1.61 (chromium, browser real) + `@axe-core/playwright`. **Story 100% frontend** → sem pytest novo.

> Nota de arquivo: o `default_output_file` do skill é `test-summary.md`, ocupado
> pelo resumo da 12.4 (e `-12-5`/`-12-6` pelas seguintes). Este resumo é gravado
> como `test-summary-13-3.md` no mesmo diretório, sem destruir os anteriores.

---

## Estratégia: E2E é o único nível que fecha os gaps desta story

A 13.3 é chrome de navegação. A camada jsdom já é densa (**41 testes novos** no
dev-story: `shellDestinations` 11, `ShellBottomNav` 11, `ShellNavigationSheet` 13,
additions em `ShellSidebar`/`ShellLayout` 6) e cobre bem **atributos e derivação**.
O que ela **não pode** cobrir — e onde estavam todos os gaps reais — é o que
depende de **layout, animação, hit-test, árvore de acessibilidade do browser,
eventos nativos de conectividade e contraste real**:

- jsdom não faz layout ⇒ nada de geometria, alvo de toque medido, rolagem interna;
- jsdom não resolve `var(--ds-*)` em cor/px ⇒ nada de "tinta = token";
- jsdom não implementa focus trap, `inert`/`aria-hidden` de Modal, nem hit-test de backdrop;
- `jest-axe` **não roda `color-contrast`** em jsdom (aprendizado da 13.1);
- `navigator.onLine`/eventos `online|offline` só são fiéis com `context.setOffline`.

Nenhum teste de API foi gerado: a story não cria endpoint, migration nem OpenAPI
(a única API tocada — `GET /api/brain-dump/count/` — já tem gate próprio e é
exercitada aqui pelo caminho de sucesso **e** de erro).

---

## Cobertura pré-existente (herdada do dev-story) — 27 E2E do shell

| Arquivo | Testes | O que já cobria da 13.3 |
|---|---|---|
| `e2e/shell-bottomnav.spec.ts` | 8 | 3 atalhos + Menu com altura do token; navegação + `aria-current`; Menu selecionado fora dos atalhos; sheet com conteúdo canônico + foco no ativo + geometria acima da barra; Fechar/`Escape` + retorno de foco; navegar fecha; FAB abre o Capture Sheet real; reflow 320 sem scroll horizontal |
| `e2e/shell.spec.ts` | 7 | landmark novo no compact (assert atualizado), skip link, topbar, atalhos `[`/`B`, seam |
| `e2e/shell-a11y.spec.ts` | 2 | gate axe wide + **compact com a bottom nav nova incluída** (SHELL-DEBT-01) |
| `e2e/shell-sidebar.spec.ts` | 10 | sidebar da 13.2 (rail, badge, ícones, axe em rail) |

---

## Gaps encontrados e fechados (+14 E2E, todos em `shell-bottomnav.spec.ts`)

Auditoria AC por AC contra os 8 E2E + 41 unit existentes. Cada linha abaixo era
um contrato **sem nenhum teste que pudesse falhar** se o comportamento
regredisse no browser.

| # | Gap (contrato sem cobertura executável) | AC / item | Teste novo |
|---|---|---|---|
| 1 | **Âncora de captura desktop** — zero E2E: a captura em desktop/medium/tablet (decisão Captura A) só existia em jsdom, sem borda/alvo medidos nem o Capture Sheet real | AC5 · FAB-06 | `âncora nominal ao fim da navegação abre a instância única do Capture Sheet` (wide) |
| 2 | **Âncora icon-only no rail** — rótulo somindo *com nome acessível preservado* e badge contido nos 64px só se prova na AX tree/layout do browser | AC5 · FAB-06 | `âncora icon-only no rail preserva o nome acessível e o badge dentro dos 64px` (wide) |
| 3 | **Faixa tablet (768–1023)** — nenhum teste provava que ali vale a âncora e **não** o FAB/bottom nav | AC5 | `tablet em rail: âncora icon-only abre a captura e não existe FAB nem bottom nav` (800×720) |
| 4 | **Offline do FAB** — `useOnlineStatus` nunca foi exercitado contra o evento **nativo** do browser; nem o tooltip, nem a permanência do foco, nem o guard do click | AC6 · DIV-8 · FAB-02/03 | `offline: FAB indisponível com motivo, focável, sem abrir a captura; navegação segue` |
| 5 | **Offline da âncora** — idem, mais "superfície/tinta disabled **preservando identidade**" (a borda do controle continua) | AC6 · DIV-8 | `offline: âncora indisponível com motivo, focável e sem abrir a captura` (wide) |
| 6 | **Falha do contador ≠ indisponibilidade** — o AC6 diz explicitamente que erro/loading do badge não bloqueia a captura; ninguém testava | AC6 | `falha do contador não desabilita nem bloqueia a captura` |
| 7 | **Badge com contagem REAL** nos portadores novos (FAB e Brain Dump do sheet): `9+`, contagem exata acessível, tokens do `app-shell-badge`, sem cobrir o pictograma | AC3/AC5 · BD-01/BD-04/FAB-04 | `badge real do Brain Dump: 9+ no FAB e no sheet, com contagem exata acessível` |
| 8 | **`Tab` contido + conteúdo inferior inerte** — os dois lados do AC4 que jsdom não implementa (focus trap real e saída da AX tree) | AC4 | `sheet: Tab contido no Modal e conteúdo inferior inerte` |
| 9 | **Fechamento pelo BACKDROP** — 4º modo do contrato, sem cobertura (hit-test real); e o backdrop usando a tinta `overlay` | AC3/AC4 | `sheet fecha pelo backdrop e devolve o foco ao Menu` |
| 10 | **Agrupadores dentro do sheet** — `aria-expanded` sem `aria-current`, **um único** `aria-current` na navegação completa, recolher sem navegar/fechar, com a rota ativa vinda da derivação **real** do registro | AC3 | `sheet: agrupador com a rota ativa dentro usa aria-expanded, nunca aria-current` |
| 11 | **Rolagem interna do sheet** — "termina acima da barra **e** rola por dentro": alça/header/Fechar fixos, paper imóvel, alvos ≥44px | AC3 · `{components.mobile-navigation-sheet}` | `sheet: rolagem interna preserva header e Fechar, com alvos ≥44px` |
| 12 | **Catálogo Phosphor + alvos da barra** — parte da DIV-5 (zero `@mui/icons-material`) só era verificada por grep de source; `regular`→`fill` e ≥48px exigem DOM/layout real | AC7 · DIV-5 · BN-06 | `bottom nav: ícones Phosphor 20px sem MUI, fill no selecionado e alvos ≥48px` |
| 13 | **Gate axe do sheet ABERTO** — o `shell-a11y.spec.ts` mede o chrome com o sheet fechado; o paper no portal, o backdrop e os grupos eram superfície nova **fora de qualquer gate** WCAG | AC8 | `axe sem violações com o sheet de navegação aberto` |
| 14 | **Reflow 320 com o sheet aberto** — o estado mais denso do fluxo mobile não era medido a 320 CSS px | AC7 · NFR-1 | `sheet aberto a 320px: sem scroll horizontal e todos os destinos alcançáveis` |

Além dos 14 novos, **1 teste existente foi reforçado**: o do FAB passou a provar
"**sempre visível**" (AC5) rolando o workspace até o fim e conferindo que o FAB
não se move, e a **instância única** do Capture Sheet (`toHaveCount(1)`).

### Achados de ferramenta (não são bugs de produto)

1. **Playwright trata `aria-disabled="true"` como "not enabled"** e recusa
   `click()` (3 falhas iniciais). É evidência a mais de que a indisponibilidade
   é legível por máquina — o teste passou a usar `click({ force: true })` para
   provar o **guard do `onClick`** com um clique real. Documentado no spec.
2. **Baseline de geometria durante o slide de entrada**: `toBeFocused` passa cedo
   (o `autoFocus` dispara na montagem, antes do `onEntered`), então medir o paper
   logo após abrir pega a animação. Foi adicionado o helper
   `waitForSheetSettled` (poll até `transform` neutro) — mesmo aprendizado que já
   havia gerado o `expect.poll` do teste de geometria do dev-story.

**Nenhum bug de produção encontrado.** Em particular, o gate axe com o sheet
aberto passou de primeira: o Modal do MUI 6.5 torna o conteúdo inferior inerte
sem deixar focáveis dentro de subárvore `aria-hidden` (a regra
`aria-hidden-focus` era o risco previsto), e o contraste do paper/label/Fechar
está dentro do piso AA.

### O que **não** foi adicionado (evitar redundância/fragilidade)

- **Fechar por arrastar para baixo (swipe-down):** o `SwipeableDrawer` só escuta
  eventos de **touch**; o Playwright não tem gesto de swipe e sintetizar
  `TouchEvent` via `page.evaluate` produziria um teste frágil que testa o MUI, não
  a story. Os outros 3 modos de fechamento (Fechar, backdrop, `Escape`) estão
  cobertos aqui e o swipe é comportamento nativo do componente escolhido —
  registrado como limitação consciente, não como cobertura silenciosa.
- **Ativo por prefixo (`path + '/'`) dos atalhos:** hoje não existe rota
  aninhada sob `/today`, `/planner/week` ou `/planner/month` — só o
  `MemoryRouter` do jsdom consegue montar a rota sintética (e já o faz:
  `ShellBottomNav.test.tsx` "ativo por prefixo do próprio destino").
- **`env(safe-area-inset-*)`:** o Chromium headless reporta sempre `0px`; a
  fórmula com safe-area é verificada por unit + pela geometria do token aqui.
- **Preferência dos 3 atalhos** (Configurações → Navegação mobile): é a **18.1**,
  fora de escopo por AC.
- **Dark mode / matriz axe wide+medium+compact completa:** é a **13.4**.

---

## Mapa de cobertura por AC (depois deste run)

| AC | jsdom (unit) | E2E (browser real) |
|---|---|---|
| AC1 — bottom nav nova no shell, legados intocados, sem Query no chrome | coberto (greps `?raw`, mocks do barrel) | coberto (landmark legado ausente) |
| AC2 — 3 atalhos derivados + Menu; só implementados; ativo por prefixo; Menu selecionado | coberto | coberto (+ ícones/alvos/tinta **novos**) |
| AC3 — Menu abre o sheet com conteúdo canônico, badge, `aria-expanded` | coberto | **completado** (agrupadores, rolagem interna, badge real, backdrop) |
| AC4 — foco inicial no ativo, `Tab` contido, inerte, 4 modos de fechamento, retorno ao Menu, landmarks | parcial (jsdom não tem trap/inert) | **completado** (trap, inertness, backdrop) |
| AC5 — FAB compact + âncora desktop/tablet, sempre visíveis, badge, sheet único | coberto (props/mocks) | **completado** (âncora wide+tablet, "sempre visível", instância única) |
| AC6 — offline indisponível com motivo, focável; contador não bloqueia | coberto (mock de hook) | **completado** (evento nativo, tooltip, guard, erro do contador) |
| AC7 — tokens/catálogo/geometria, ≥44-48px, reflow 320 | coberto (greps) | **completado** (Phosphor no DOM, alvos medidos, reflow com sheet) |
| AC8 — checklist, axe compact, suíte verde | — | **completado** (axe com sheet aberto **novo**) |

---

## Resultado

```
# Só o spec da story (22 testes: 8 herdados + 14 novos)
cd frontend && CI=1 DATABASE_URL=postgres://postgres:postgres@localhost:5432/bujo_e2e \
  npx playwright test e2e/shell-bottomnav.spec.ts --reporter=line
22 passed

# Suíte E2E do shell inteira (escopo de fechamento da story)
cd frontend && CI=1 DATABASE_URL=postgres://postgres:postgres@localhost:5432/bujo_e2e \
  npx playwright test e2e/shell-bottomnav.spec.ts e2e/shell.spec.ts \
  e2e/shell-a11y.spec.ts e2e/shell-sidebar.spec.ts --reporter=line
41 passed (1.5m)
```

- **41 passed** ✅ = 27 herdados + **14 novos** (nenhuma regressão nos 27).
- `npm run typecheck` e `npm run lint`: **limpos** ✅.
- **Sem mudança em código de produção** — 1 único arquivo tocado:
  `frontend/e2e/shell-bottomnav.spec.ts`. Vitest não foi re-executado por não
  haver mudança em `src/` (contagem do dev-story permanece válida: 89 files / 948 testes).
- **Banco e2e:** `DATABASE_URL` one-shot para o Postgres **local** `bujo_e2e`
  (credencial da branch Neon `e2e` **stale** desde 2026-07-24 — pendência ops do
  dono, runbook §2). Portas 5173/8000 (env `--mode e2e`); o dev local do usuário
  (5174/8001) não foi tocado.
- Esta story **não** cria migration → sem passo de migration no banco e2e.

---

## Validação contra o checklist (`checklist.md`)

- [x] Testes de API gerados **se aplicável** — N/A por design (story 100% frontend; sem endpoint/migration/OpenAPI)
- [x] Testes E2E gerados (UI existe) — **+14 Playwright**
- [x] APIs padrão do framework (`test`/`expect`/locators do Playwright + `@axe-core/playwright`; fixture de signup do projeto)
- [x] Happy path coberto (atalhos, sheet, FAB, âncora, badge real)
- [x] Casos de erro críticos cobertos (**offline** em ambos os controles; **500 no contador**; rota fora dos atalhos)
- [x] Todos os testes rodam com sucesso — **22/22 no spec · 41/41 no escopo do shell**
- [x] Locators semânticos/acessíveis (`getByRole` com nome acessível; CSS só quando o Modal torna a barra inerte de propósito, ou para tokens/geometria — sempre comentado)
- [x] Descrições claras em pt-BR, com o AC/item de paridade citado em cada teste
- [x] Sem waits/sleeps fixos (`expect.poll` para a transição; auto-retry dos matchers)
- [x] Testes independentes (usuário novo por teste via fixture; `setOffline` revertido no próprio teste; `page.route` escopada à página)
- [x] Resumo criado com métricas de cobertura (este arquivo)

---

## Próximos passos

- **13.4** herda três coisas deste run: o gate axe do **sheet aberto** entra na
  matriz wide/medium/compact; a Questão Aberta 1 (`aria-current` no Menu) segue
  registrada para confirmação com UX; e a linha **ST-04** da checklist de
  paridade (offline) já tem evidência E2E — basta referenciar
  `shell-bottomnav.spec.ts` no passe final.
- **18.1** (escolha dos 3 atalhos): os testes de atalho aqui assumem o **default
  derivado**; quando a preferência existir, o ponto de extensão é
  `deriveBottomNavShortcuts(…, preferredPaths)` — os asserts de "3 primeiros na
  ordem canônica" viram os asserts do fallback sem preferência.
- **Épico 15 (15.2)**: quando a superfície de captura migrar, o alvo dos asserts
  `getByRole('dialog', { name: 'Captura rápida' })` muda de dono; o contrato
  testado aqui (FAB/âncora abrem **uma** instância, com foco no título)
  permanece como caracterização da troca.
- **Ops (bloqueio recorrente):** a credencial da branch Neon `e2e` continua
  stale — todo run do shell depende do workaround do Postgres local. Enquanto não
  for rotacionada, a suíte E2E não roda "de fábrica" para ninguém além do dono.
