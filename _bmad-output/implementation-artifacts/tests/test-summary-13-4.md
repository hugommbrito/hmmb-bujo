# Test Automation Summary — Story 13.4 (Passe de paridade e acessibilidade do shell)

**Data:** 2026-07-24 · **QA:** HugoMMBrito · **Executor:** workflow `bmad-qa-generate-e2e-tests`
**Frameworks:** Playwright 1.61 (chromium, browser real) + `@axe-core/playwright`; Vitest 4.1.9 + Testing Library + `jest-axe`. **Story 100% frontend** → nenhum teste de API gerado (sem endpoint, migration ou OpenAPI novos).

> Nota de arquivo: o `default_output_file` do skill é `test-summary.md`, ocupado
> pelos resumos anteriores (`-12-5`, `-12-6`, `-13-3`). Este resumo é gravado como
> `test-summary-13-4.md` no mesmo diretório, sem destruir os anteriores.

---

## Ponto de partida: uma story que já chegou densa

O dev-story da 13.4 entregou **+29 Vitest** e **+45 E2E** (2 specs novos —
`shell-keyboard`, `shell-states` — e a matriz axe de 2 → 16 células). A auditoria
deste passo, portanto, não procurou "cobertura em geral": foi AC por AC procurar
**contrato que nenhum teste poderia reprovar se o comportamento regredisse**.

Foram 6 lacunas reais — 5 fechadas com testes novos e **1 que era defeito de
produto**, encontrada pelo teste e corrigida aqui.

---

## Achado do passo de QA: o sheet de navegação NÃO tinha anel de foco

**O que o AC5 exige:** "todo controle do chrome exibe foco visível pelo
`focus-ring` do token (`--ds-focus`, 2px, offset 2px)".

**O que o browser fazia:** `outline-style: none` em **todo** controle dentro do
sheet de navegação completa — Fechar, os dois agrupadores e os 14 destinos.

**Causa:** a regra do focus ring do shell é `'& :focus-visible'` no `sx` do
`shell-root` (`ShellLayout.tsx:157-160`) — um seletor **descendente**. O MUI
renderiza o `SwipeableDrawer` do sheet num **portal em `document.body`**, então o
paper não é descendente do `shell-root` e a regra não o alcança. E o `ButtonBase`
do MUI aplica `outline: 0`, o que remove até o anel **default do browser** —
sobrando apenas a tinta de `.Mui-focusVisible` como pista de foco, num
`--ds-surface` claro.

É a **mesma classe de armadilha** que a 13.3 já havia documentado para os tokens
("`var()` do root não resolve no paper do portal — reaplicar por `style` nos
slots"): o paper recebia os tokens, mas não a regra que os consome.

**Correção aplicada** (`ShellNavigationSheet.tsx`, slot `paper`, 4 linhas):

```ts
'& :focus-visible': {
  outline: 'var(--ds-focus-ring-width) solid var(--ds-focus)',
  outlineOffset: 'var(--ds-focus-ring-offset)',
},
```

**Detector permanente:** `shell-keyboard.spec.ts::foco visível usa o anel do token
também DENTRO do sheet portalizado` — abre o sheet, dá um `Tab` **real** (foco
programático depois de clique não casa `:focus-visible` no Chromium), confirma que
o foco ficou **dentro** do paper e compara `outline-width`/`outline-offset`/`outline-color`
com os tokens lidos do DOM. Antes da correção: `Expected "solid" / Received "none"`
nas 3 tentativas.

**Fora de escopo, registrado:** o `BrainDumpCaptureSheet` (superfície **legada**,
migra no Épico 15, já excluída do axe por DIV-17) tem o mesmo problema estrutural.
Não foi tocado — é dívida da superfície, não do chrome.

---

## Lacunas fechadas com teste novo (+9 E2E)

| # | Lacuna (contrato sem teste capaz de reprovar) | AC / item | Teste novo |
|---|---|---|---|
| 1 | **A invariante "exatamente UM `aria-current` em TODA rota autenticada" só existia em jsdom.** `shellDestinations.test.ts` a prova sobre a *lista* `shellRoutes` com pathname injetado à mão; o router real (`createBrowserRouter`, match mais profundo, `:date`/`:weekStart`/`:monthFirst`, aninhamento de `settings/*`) nunca foi exercido. | AC1 · A.1 · risco #1 da story | `shell-active-destination.spec.ts::exatamente um aria-current no destino pai correto, em toda rota autenticada` — sweep das **22 rotas** numa única sessão |
| 2 | **Os dois pares de prefixo COLIDENTE não eram visitados por nenhum E2E:** `/settings` × `/settings/{habits,health-metrics,medications}` e `/archive` × `/archive/{weekly,monthly}/*`. São exatamente o modo de falha que o AC1 nomeia — e um segundo `aria-current` nascendo aí passaria pelo gate axe (que não conta ocorrências) e por toda a suíte de browser. | AC1 · SB-05/SB-13 | idem #1 (as 6 rotas entram no sweep) + `…/settings/medications: Menu selecionado e Configurações ativo uma única vez no sheet` + `…/archive/weekly/2026-07-20: …Arquivo…` |
| 3 | **Agrupador recolhido com filho ativo por rota PROFUNDA.** A 13.2 provou `.contains` + `aria-describedby` só com a rota **exata** de um filho (`/planner/week`); a variante que só passou a existir com o predicado de prefixo (histórico ativando o pai) não tinha teste no browser. | AC1 · SB-05/SB-13 | `shell-active-destination.spec.ts::agrupador recolhido com filho ativo por rota profunda: .contains, aria-expanded e nenhum aria-current` |
| 4 | **Contrato do `/daily/:date` no compact.** "Nenhum destino ativo + item Menu selecionado" estava provado apenas na sidebar (jsdom); o lado do sheet (zero `aria-current`) não tinha evidência nenhuma — e é justamente o contrato que um "conserto" bem-intencionado quebraria. | AC1 | `shell-active-destination.spec.ts::/daily/:date: Menu selecionado e nenhum destino ativo no sheet` |
| 5 | **Ordem de Tab em medium e no rail do tablet.** O AC5 pede a ordem visual "em **cada** faixa"; a sequência estava assertada só em wide e compact. O rail é a composição mais distinta do chrome (nomes vindos de `aria-label`, filhos de agrupador **desmontados**, rótulo do toggle invertido). | AC5 · A11Y-09 | `shell-keyboard.spec.ts::ordem de Tab acompanha a ordem visual em medium…` · `…no rail do tablet: toggle → destinos por aria-label → captura` |
| 6 | **Skip link medido apenas fechado.** O AC4 exige que o gate axe cubra "todo o chrome: … skip link", mas ele vive `translateY(-160%)` até receber foco e o axe **não** mede `color-contrast` de nó fora da tela: o estado em que o controle é de fato **visto** (pílula `--ds-surface` + borda `--ds-control-border` + anel `--ds-focus`) nunca passou pelo gate. | AC4 | `shell-a11y.spec.ts::wide · /today · skip link EM FOCO (estado visível do único controle off-screen)` — 17ª célula da matriz |

### Por que nenhuma dessas foi coberta em Vitest

Todas dependem do que jsdom não faz: router real com params, ordem de tabulação
real, `:focus-visible` resolvido, `color-contrast` do axe (só no browser) e a
árvore de acessibilidade calculada pelo Chromium. As lacunas #1–#4 têm par em
jsdom — e é exatamente por isso que eram lacunas: **jsdom prova a função, não o
app**.

---

## Duas falhas E2E pré-existentes: corrigidas (eram test-only)

As Completion Notes da story registraram, com honestidade, 2 falhas verificadas
como pré-existentes no baseline `2fca13f` e as deixaram "para triagem". Como o AC9
exige a suíte dos specs que navegam pelo chrome **verde**, e como as duas são
ambiguidade de **locator de teste** (nenhuma linha de produto envolvida), foram
corrigidas aqui — uma linha cada, com o motivo no comentário:

| Spec | Causa | Correção |
|---|---|---|
| `archive.spec.ts:97` | `getByLabel('Migrada')` casa **2** nós na mesma linha (o controle de status `Migrada` e o chip de linhagem `Migrada 2 vezes`) — `getByLabel` casa por substring ⇒ strict mode violation | `getByLabel('Migrada', { exact: true })` |
| `daily-tasks.spec.ts:89` | `page.getByLabel('Fechar')` casa **2**: o Fechar do `TaskDetailPanel` e o do `BrainDumpCaptureSheet`. Desde a 13.3 o `ShellLayout` mantém a instância ÚNICA da captura montada em **toda** faixa (o `SwipeableDrawer` não desmonta o paper); no `AppLayout` legado ela só existia no compact | `panel.getByLabel('Fechar')` (escopado ao painel) |

A segunda é consequência direta de uma decisão de arquitetura da 13.3 e vale para
**todo spec de desktop** daqui em diante: um `getByLabel('Fechar')` não escopado
passa a ser ambíguo no app inteiro.

---

## Gates executados (comando real + saída literal)

**Vitest** — `nvm use 22.15.1 && npm run test:run`:

```
 Test Files  89 passed (89)
      Tests  981 passed (981)
```

Inalterado em relação ao fechamento do dev-story (**981**): este passo não
acrescentou teste jsdom — as 6 lacunas eram todas de browser — e a correção do
anel de foco é `sx` de portal, que jsdom não resolve (o detector é E2E, de
propósito, não um teste que passaria verde sem medir nada).

**Typecheck** — `npm run typecheck` (`tsc -b --noEmit`): **sem saída** (limpo).
**Lint** — `eslint` nos arquivos tocados: **sem saída** (limpo).

**E2E — os 7 specs do shell** (`CI=1 DATABASE_URL=postgres://postgres:postgres@localhost:5432/bujo_e2e npx playwright test e2e/shell-active-destination.spec.ts e2e/shell-keyboard.spec.ts e2e/shell-a11y.spec.ts e2e/shell-bottomnav.spec.ts e2e/shell-sidebar.spec.ts e2e/shell.spec.ts e2e/shell-states.spec.ts --reporter=line`):

```
  95 passed (3.6m)
```

**86 herdados + 9 novos = 95**, por arquivo: `shell.spec.ts` 7 · `shell-sidebar.spec.ts` 10 ·
`shell-bottomnav.spec.ts` 22 · `shell-states.spec.ts` 7 · `shell-a11y.spec.ts` 16 → **17** (+1) ·
`shell-keyboard.spec.ts` 24 → **27** (+3) · `shell-active-destination.spec.ts` **5** (novo).

**E2E — specs que navegam pelo chrome** (`brain-dump`, `archive`, `daily-tasks`,
`gratitude-history`, `habit-history`, `health-history`, `medications-history`):

```
  29 passed (1.5m)
```

Baseline do fechamento do dev-story: **2 failed / 27 passed**. As duas falhas eram
as ambiguidades de locator da seção anterior — **suíte agora inteira verde**.

**Ambiente:** Node 22.15.1 (`nvm use`), portas 5173/8000 (`--mode e2e`); o dev
local do dono (5174/8001) não foi tocado. `DATABASE_URL` one-shot para o Postgres
**local** `bujo_e2e` — a credencial da branch Neon `e2e` continua **stale**
(pendência de ops do dono, runbook §2).

---

## Cobertura resultante

| Nível | Antes deste passo | Depois |
|---|---|---|
| Vitest (chrome do shell + módulos puros) | 981 (89 arquivos) | 981 — sem mudança |
| E2E do shell | 86 (6 specs) | **95 (7 specs)** |
| Células do gate axe (WCAG 2.2 AA, browser real) | 16 | **17** (Tabela A vai a 13 rotas/estados) |
| Rotas autenticadas com destino ativo verificado **no router real** | 8 (esparsas, por outros asserts) | **22 de 22** |
| Faixas com ordem de Tab assertada como sequência | 2 (wide, compact) | **4** (wide, medium, tablet-rail, compact) |
| Superfícies do chrome com anel de foco verificado | 2 (sidebar, bottom nav) | **3** (+ sheet portalizado — que estava **quebrado**) |

Nenhuma célula usa `disableRules`, `test.skip` ou `test.fixme`; nenhum `exclude`
novo foi introduzido (os dois existentes — `main` e o dialog de captura legado —
permanecem como estavam, DIV-17).

---

## Artefatos atualizados

- `frontend/e2e/shell-active-destination.spec.ts` — **NEW** (5 testes): destino ativo no router real
- `frontend/e2e/shell-keyboard.spec.ts` — **+3 testes** (ordem de Tab em medium e no rail; anel de foco no portal)
- `frontend/e2e/shell-a11y.spec.ts` — **+1 célula** (skip link em foco)
- `frontend/src/app/layout/shell/ShellNavigationSheet.tsx` — **correção de produto**: anel de foco reaplicado no slot `paper`
- `frontend/e2e/archive.spec.ts`, `frontend/e2e/daily-tasks.spec.ts` — locators escopados (2 falhas pré-existentes)
- `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md` — A.1 com a evidência do router real; `A11Y-06` com o portal e a correção; `A11Y-09` nas 4 faixas; matriz axe com a 13ª célula da Tabela A; tabela "além do axe" atualizada

---

## Validação contra o checklist (`checklist.md`)

- [x] Testes de API gerados **se aplicável** — N/A por design (story 100% frontend; nenhum endpoint/migration/OpenAPI novo)
- [x] Testes E2E gerados (UI existe) — **+9 Playwright**
- [x] APIs padrão do framework (`test`/`expect`/locators do Playwright, `toHaveAccessibleName`, `@axe-core/playwright`, fixture de signup do projeto)
- [x] Happy path coberto (destino ativo nas 22 rotas, ordem de Tab, skip link visível, anel de foco)
- [x] Casos de erro/limite críticos cobertos (pares de prefixo colidente, `/daily/:date` sem destino, agrupador recolhido, foco escapando do portal)
- [x] Todos os testes rodam com sucesso — **95/95 no escopo do shell · 29/29 nos specs que navegam pelo chrome**
- [x] Locators semânticos/acessíveis (`getByRole` + nome acessível; CSS só para contar `[aria-current]` e para o paper do portal, sempre comentado)
- [x] Descrições claras em pt-BR, com o AC/item de paridade citado em cada teste
- [x] Sem waits/sleeps fixos (`waitForSheetSettled`/`expect.poll`, marcador estável antes de cada `analyze()`, auto-retry dos matchers)
- [x] Testes independentes (usuário novo por teste via fixture; `test.use({ viewport })` por describe; nenhum estado compartilhado)
- [x] Resumo criado com métricas de cobertura (este arquivo)

---

## Próximos passos

- **Épico 15 (captura)**: o `BrainDumpCaptureSheet` herda o mesmo problema de anel
  de foco no portal que o sheet de navegação tinha. Quando a superfície migrar, o
  padrão de correção já está no `ShellNavigationSheet` — e vale um teste espelho.
- **Ondas 3–5**: o sweep das 22 rotas (`shell-active-destination.spec.ts`) é o
  detector natural de regressão quando cada superfície migrar: se uma rota nova
  nascer sem destino pai, o teste reprova nomeando a rota.
- **Convenção para specs futuros**: `getByLabel('Fechar')` sem escopo é ambíguo em
  qualquer faixa desde a 13.3 (instância única da captura sempre montada). Vale
  como regra de escrita de spec, não como bug a reabrir.
- **Ops (bloqueio recorrente)**: credencial da branch Neon `e2e` segue stale — todo
  run do shell depende do workaround do Postgres local.
