---
title: 'DW-16 — Contraste AA nos botões das listas de decisão do ritual semanal e mensal'
type: 'bugfix'
created: '2026-08-04'
status: 'in-review'
baseline_revision: 'efe668e0eb63ded3e44b81ea506f3f0afbc257e8'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Os `Button` das linhas de decisão de `WeeklyDecisionList.tsx` e `MonthlyDecisionList.tsx` são renderizados sem `variant`/`color`, então caem no default do MUI (`text` + `primary`) e herdam o teal de marca legado do tema (`theme.ts` → `colors.brandPrimary`, ~2,4:1 sobre `--ds-surface`) — os 10 testes `axe sem exclude` de `weekly-planning-ritual.spec.ts` e `monthly-planning-ritual.spec.ts` reprovam nas 5 faixas com uma violação `[serious] color-contrast` pré-existente (confirmada por A/B com a árvore limpa). Secundariamente, esses mesmos testes medem logo após o `toBeVisible()` do `main`, com o layout ainda assentando, e o `target-size` oscila entre 1 e 2 violações em wide/medium.

**Approach:** Declarar cor EXPLÍCITA do design system (`var(--ds-primary)`) em todo `Button` das duas listas, replicando o irmão já corrigido `MigrationDecisionList.tsx`; e dar ao gate axe uma espera determinística de assentamento de layout, usada pelos 10 testes dos dois rituais.

## Boundaries & Constraints

**Always:**
- Usar apenas tokens `var(--ds-*)` para cor — o padrão que `MigrationDecisionList.tsx` já passa sob a mesma lista proibida de literais.
- Manter o guard `noLiteralTokens.test.ts` de weekly e monthly verde: nada de `#hex`, nem dos literais `36px`/`48px`/`3px`/`0.58` (e os específicos de cada lista) no `?raw` dos componentes.
- A espera de assentamento é limitada por um teto de tempo e ignora animações infinitas (spinners), para nunca pendurar a suíte.
- Correção LOCAL nos dois componentes; o Épico 18 continua livre para consolidar as quatro cópias depois.

**Block If:**
- Deixar os 10 testes axe verdes exigir alterar `theme.ts`, `tokens.ts` ou qualquer token compartilhado.
- Sobrar violação `color-contrast` fora de `WeeklyDecisionList.tsx`/`MonthlyDecisionList.tsx` (ex.: no shell ou em outro componente da página), o que estaria fora do escopo desta entrada.

**Never:**
- Tocar `src/theme.ts`, `src/shared/design/tokens.ts` ou qualquer token `--ds-*` compartilhado (`--ds-weekly-planning-*` inclusive).
- Adicionar `disableRules`/`exclude` novos ao gate axe, ou afrouxar `WCAG_2_2_AA_TAGS` — a espera de assentamento mede o estado final, não silencia regra.
- Mudar rótulos, ordem, semântica ou comportamento das ações (nada de virar `Cancelar` em variante danger, nem de preencher botão com `backgroundColor`) — a mudança é cromática de texto, não de hierarquia visual.
- Alterar os outros specs axe do repo (`migration-ritual`, `weekly-board`, `monthly-board`, `archive-lineage`, shell, etc.).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Botão de ação da linha | `WeeklyDecisionList`/`MonthlyDecisionList` com itens pendentes | Todo `Button` renderiza com `color: var(--ds-primary)` — AA sobre `--ds-surface` | Sem erro esperado |
| Retry de erro por item | `itemErrors[item.id]` preenchido (alerta em `--ds-danger`) | O `Button` "Tentar novamente" dentro do alerta também declara `var(--ds-primary)`, não herda o teal do tema | Sem erro esperado |
| Retry de erro da fonte | `error === true` | O `Button` "Tentar novamente" do bloco `role="alert"` declara `var(--ds-primary)` | Sem erro esperado |
| Buckets fora do progresso | `alreadyPlacedItems`/`alreadyPlacedInYearItems` não vazios | Os `Button` "Alocar"/"Alocar outra instância" também declaram `var(--ds-primary)` | Sem erro esperado |
| Assentamento com animação infinita | Página com spinner/animação `iterations: Infinity` em voo | A espera ignora essa animação e retorna dentro do teto de tempo | Retorna no teto; nunca lança nem pendura |

</intent-contract>

## Code Map

- `frontend/src/features/bujo/components/weekly/WeeklyDecisionList.tsx` -- ALVO. `Button` sem `variant`/`color` nos toggles (:123, :130), no retry da fonte (:138), nas ações da linha (:189, :194, :199, :204-210, :213, :218, :223), no retry por item (:234) e no bucket "Já alocados" (:255, :262). Todos herdam `theme.palette.primary`.
- `frontend/src/features/bujo/components/monthly/MonthlyDecisionList.tsx` -- ALVO. Mesmo padrão: toggles (:136, :139), retry da fonte (:147), ações (:195, :200, :204-211, :214, :219, :224, :229), retry por item (:240) e os dois buckets fora do progresso (:260, :277).
- `frontend/src/features/bujo/components/migration/MigrationDecisionList.tsx` -- MOLDE (read-only). `DecisionList` de mesma forma, já corrigida na 14.9: `sx={{ color: 'var(--ds-primary)' }}` em :99, :102, :110, :169, :184, com o racional escrito em :94-98 e :165-168. Não editar.
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:89-96`, `frontend/src/pages/planner/FutureBoardPage.tsx:54-62`, `frontend/src/pages/braindump/BrainDumpInboxPage.tsx:42-49` -- precedentes de `RETRY_BUTTON_SX` (read-only): const no topo do módulo + comentário citando o achado do axe. Copiar a CONVENÇÃO, não o corpo (aqueles são botões preenchidos com `backgroundColor`; aqui são botões de texto).
- `frontend/src/shared/design/tokens.ts` -- READ-ONLY. `colorRoles` (:299-330) define `primary`/`on-primary`; Mineral Light `primary: '#315F5A'` (:378); `--ds-touch-target-min` emitido em :479. Nenhuma edição aqui.
- `frontend/src/theme.ts:119` -- READ-ONLY. `palette.primary.main = colors.brandPrimary` (o teal legado) — a causa raiz, deliberadamente NÃO tocada nesta entrada.
- `frontend/src/features/bujo/components/weekly/noLiteralTokens.test.ts` -- GUARD. `FORBIDDEN_LITERALS` (:16) + regex de `#hex` (:39) sobre `WeeklyDecisionList.tsx?raw`.
- `frontend/src/features/bujo/components/monthly/noLiteralTokens.test.ts` -- GUARD. `FORBIDDEN_LITERALS` (:15) + `#hex` (:37) + `repeat(7,` (:45) sobre `MonthlyDecisionList.tsx?raw`.
- `frontend/e2e/axeHelper.ts` -- ALVO. `expectNoAxeViolations` (:50) analisa imediatamente; ponto de extensão para a espera de assentamento.
- `frontend/e2e/weekly-planning-ritual.spec.ts` -- ALVO. 5 testes axe: :278 (wide), :290 (medium), :302 (tablet, expande a sidebar antes), :319 (compact), :331 (reflow 320). Todos medem logo após `toBeVisible()` do `main`.
- `frontend/e2e/monthly-planning-ritual.spec.ts` -- ALVO. Mesmos 5 testes: :249, :261, :273, :286, :298.
- `frontend/e2e/migration-ritual.spec.ts:210-222` -- referência (read-only) do problema de assentamento resolvido ad hoc com `page.waitForTimeout(300)` e o racional escrito. Não editar.
- `frontend/playwright.config.ts` -- contexto: único projeto é `chromium`, `workers: 1`, `expect.timeout: 10s`.

**Descoberto em execução (o `target-size` NÃO era timing — ver Design Notes):**

- `frontend/src/features/bujo/components/weekly/WeeklyContextRail.tsx:167-208` / `monthly/MonthlyContextRail.tsx:218-248` -- ALVO. Os botões da seção `Avisos` são `Box component="button"` com `display: block` e SEM `minHeight`: medem abaixo de 24px de altura e ficam encostados, reprovando tamanho E espaçamento do `target-size` em TODAS as 5 faixas dos dois rituais.
- `frontend/src/pages/planner/WeeklyPlanningPage.tsx:429-437` / `MonthlyPlanningPage.tsx:458-465` -- ALVO. `<main>` é um grid de 3 colunas SEM colapso responsivo: abaixo de `desktop` (1024px) a coluna do meio é esmagada a zero e os botões da lista de decisão vazam por cima do rail de contexto (`target-size` "partially obscured" em tablet/compact/reflow-320).
- `frontend/src/pages/MigrationRitualPage.tsx:74,353-356` -- MOLDE (read-only) do colapso: `const isNarrowLayout = !useMediaQuery(mediaQueries.desktop)` + `gridTemplateColumns: isNarrowLayout ? '1fr' : <3 colunas>`. É por isso que os testes axe da Migração já passam em compact.
- `frontend/src/shared/design/tokens.ts:71-92` -- READ-ONLY. `breakpoints.mediumMin = 1024` → `mediaQueries.desktop = (min-width: 1024px)`, exatamente a fronteira entre as faixas que passavam (wide/medium) e as que falhavam (tablet/compact/reflow).
- `frontend/src/pages/planner/noLiteralTokens.test.ts:15-32` -- GUARD das duas páginas do planner (inclui `44px`). Vale para comentário também: o guard casa `\b3px\b`, então escrever "22,3px" em comentário reprova.

## Tasks & Acceptance

**Execution:**
- `frontend/src/features/bujo/components/weekly/WeeklyDecisionList.tsx` -- declarar um const de módulo (ex.: `DECISION_BUTTON_SX = { color: 'var(--ds-primary)' } as const`) com comentário curto citando o achado do axe e o teal legado do tema, e aplicá-lo via `sx` a TODOS os `Button` do arquivo (toggles, retry da fonte, ações da linha, retry por item, bucket "Já alocados") -- um botão sem a cor explícita mantém a violação.
- `frontend/src/features/bujo/components/monthly/MonthlyDecisionList.tsx` -- mesma mudança, aplicada a TODOS os `Button` do arquivo, incluindo os dois buckets fora do progresso -- paridade com o Weekly e com `MigrationDecisionList`.
- `frontend/e2e/axeHelper.ts` -- exportar `waitForLayoutSettled(page, timeoutMs?)`: aguarda `document.fonts.ready`, depois as animações/transições CSS em voo que NÃO sejam infinitas (`getComputedTiming().iterations === Infinity` é ignorado), tudo limitado por um teto (default ~1000ms), e fecha com um `requestAnimationFrame` duplo -- mede o layout assentado sem nunca pendurar.
- `frontend/e2e/weekly-planning-ritual.spec.ts` -- chamar `waitForLayoutSettled(page)` imediatamente antes de cada uma das 5 chamadas de `expectNoAxeViolations` (após o `toBeVisible()` do `main` e, no tablet, após expandir a sidebar) -- é onde o `target-size` oscila.
- `frontend/e2e/monthly-planning-ritual.spec.ts` -- mesma inserção nas 5 chamadas.
- `frontend/src/features/bujo/components/weekly/WeeklyContextRail.tsx` + `monthly/MonthlyContextRail.tsx` -- dar `minHeight: 'var(--ds-space-6)'` (24px, o piso exato do WCAG 2.5.8) aos botões de aviso da seção `Avisos` (os do `map` e o do bloco bloqueante do ciclo anterior, idênticos em forma) -- é o `target-size` que reprova em TODAS as 5 faixas, não só nas estreitas.
- `frontend/src/pages/planner/WeeklyPlanningPage.tsx` + `MonthlyPlanningPage.tsx` -- colapsar `gridTemplateColumns` do `<main>` para `'1fr'` abaixo de `mediaQueries.desktop`, via `isNarrowLayout`, replicando `MigrationRitualPage.tsx:74,354` -- sem isso a coluna do meio vai a zero e os botões de decisão ficam "partially obscured" pelo rail de contexto. Os tokens de rail seguem intactos: só param de valer abaixo de `desktop`.
- `frontend/src/features/bujo/components/weekly/WeeklyDecisionList.test.tsx` + `monthly/MonthlyDecisionList.test.tsx` -- adicionar guard estrutural `?raw`: todo `<Button` do arquivo declara `sx={DECISION_BUTTON_SX}`, e o const declara `color: 'var(--ds-primary)'` -- cobre os botões que o gate axe NÃO renderiza (erro por item, erro da fonte, buckets) e pega botão novo sem cor.
- `frontend/e2e/axeHelper.spec.ts` (novo) -- provar a garantia que sustenta a espera: com uma animação INFINITA injetada em voo, `waitForLayoutSettled(page, 2000)` retorna numa fração do teto (é ignorada, não apenas cortada).

**Acceptance Criteria:**
- Dado o ritual semanal em qualquer das 5 faixas (wide 1440, medium 1280, tablet 800, compact 390, reflow 320), quando o teste `axe sem exclude: main` roda, então o axe reporta 0 violações WCAG 2.2 AA.
- Dado o ritual mensal nas mesmas 5 faixas, quando o teste `axe sem exclude: main` roda, então o axe reporta 0 violações WCAG 2.2 AA.
- Dado que os 10 testes axe rodam duas vezes seguidas, quando se comparam os resultados, então ambas as execuções passam — sem oscilação de `target-size` entre execuções.
- Dado o guard estrutural, quando `weekly/noLiteralTokens.test.ts` e `monthly/noLiteralTokens.test.ts` rodam, então nenhum literal proibido nem `#hex` aparece nos dois componentes alterados.
- Dado o diff completo, quando se inspeciona `src/theme.ts` e `src/shared/design/tokens.ts`, então nenhum dos dois foi modificado.
- Dado o restante da suíte de unidade do frontend, quando `npm run test:run` roda, então nenhum teste que já passava passa a falhar (em especial `WeeklyDecisionList.test.tsx` e `MonthlyDecisionList.test.tsx`).

## Spec Change Log

## Review Triage Log

## Design Notes

O molde é o irmão já corrigido — botão de TEXTO com cor explícita, não botão preenchido:

```tsx
/** Cor EXPLÍCITA (achado real do axe, DW-16): o `primary` do tema MUI é o teal
 * de marca legado, ~2,4:1 sobre `--ds-surface` — abaixo de AA. */
const DECISION_BUTTON_SX = { color: 'var(--ds-primary)' } as const
...
<Button size="small" aria-disabled={offline} onClick={...} sx={DECISION_BUTTON_SX}>
```

`MigrationDecisionList` repete o objeto inline em 7 lugares; aqui são ~13 por arquivo, então o const de módulo (convenção já usada em `RETRY_BUTTON_SX`) evita a repetição sem inventar abstração nova. Nada de `minHeight: var(--ds-touch-target-min)`: `size="small"` já entrega altura acima do piso de 24 CSS px do WCAG 2.5.8, e forçar 48px mudaria a densidade visual das linhas — fora do que a decisão pediu.

A espera de assentamento resolve a mesma classe de problema que `migration-ritual.spec.ts:210-222` contornou com `waitForTimeout(300)` fixo, mas de forma determinística: espera o que está de fato em voo (transição de largura da sidebar, `Collapse` do submenu com `timeout="auto"`) em vez de um número mágico. O filtro de `iterations === Infinity` existe porque spinners MUI nunca terminam.

**Correção de diagnóstico feita em execução — o `target-size` NÃO era timing.** A entrada DW-16 (e esta spec, derivada dela) tratava a oscilação "1 ou 2 violações" como artefato de medição, curável só por assentar o layout. Medição direta com sonda de geometria mostrou o contrário: são DOIS defeitos determinísticos e pré-existentes, e o assentamento apenas deixou de esconder o primeiro (as violações passaram a aparecer em 10/10 execuções em vez de intermitentemente — o gate ficou honesto, não verde).

1. Os botões de `Avisos` dos dois context rails medem abaixo de 24px de altura, encostados uns nos outros — reprovam tamanho E espaçamento nas 5 faixas. Só existem depois que as respostas de rede chegam, e é exatamente essa dependência de dados (que a espera de fontes/animações não cobre) que produzia a "oscilação".
2. Nas faixas abaixo de `desktop`, o grid de 3 colunas do `<main>` não colapsa: a coluna do meio vai a zero e os botões de decisão vazam por cima do rail de contexto, virando "partially obscured".

Nenhum dos dois exigiu tocar token, tema ou regra do axe — o (2) é a réplica literal do `isNarrowLayout` que `MigrationRitualPage.tsx` já usa, o mesmo tipo de precedente ("o irmão já corrigido") que a decisão do dono mandou seguir para a cor. Os tokens `--ds-weekly-planning-*`/`--ds-monthly-planning-*` seguem com o mesmo valor, consumidos a partir de `desktop`.

## Verification

**Commands:**
- `nvm use 22.15.1` -- pré-requisito: a sessão inicia em Node 18 e o frontend exige ≥20.12.
- `cd frontend && npx vitest run src/features/bujo/components/weekly src/features/bujo/components/monthly` -- expected: guards `noLiteralTokens` e os testes das duas listas verdes.
- `cd frontend && npm run typecheck && npm run lint` -- expected: zero erros.
- `cd frontend && CI=1 npx playwright test e2e/axeHelper.spec.ts e2e/weekly-planning-ritual.spec.ts e2e/monthly-planning-ritual.spec.ts -g "axe"` -- expected: 11 passed, 0 failed. Rodar DUAS vezes para provar a estabilidade do `target-size`.
- `cd frontend && CI=1 npx playwright test e2e/weekly-planning-ritual.spec.ts e2e/monthly-planning-ritual.spec.ts` -- expected: 28 passed. Gate de regressão do colapso de layout: as faixas estreitas passaram a empilhar, então os testes de interação dos dois rituais precisam seguir verdes.
- `cd frontend && npm run test:run` -- expected: suíte de unidade completa verde (nenhuma regressão fora do escopo).
- `git diff --stat -- frontend/src/theme.ts frontend/src/shared/design/tokens.ts` -- expected: saída vazia.
