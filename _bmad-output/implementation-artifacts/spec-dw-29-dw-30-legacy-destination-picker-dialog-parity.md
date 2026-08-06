---
title: 'DW-29/DW-30 — paridade de Dialog na família LEGADA de seletores de destino'
type: 'bugfix'
created: '2026-08-05'
status: 'in-review'
baseline_revision: '348a04f70c0c04930b14e698fe4cb0e4bb7500d9'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [multiple-goals, oversized]
deferred:
  - summary: '`MigrationRitualPage` congela `pickerMonthFirst` no clique; se `useMonthlyLogQuery` ainda não resolveu, o seletor de destino NUNCA renderiza e o botão vira um clique morto — nada re-executa o snapshot.'
    evidence: '`handleOpenDestinationPicker` faz `setPickerMonthFirst(currentMonthLog.data?.monthFirst ?? null)` (MigrationRitualPage.tsx:268-272) e o render é guardado por `{destinationItemId && pickerMonthFirst && ...}` (:406). O e2e `migration-flow.spec.ts:159` falha por isso com `getByRole(dialog)` não encontrado; o aria-snapshot do Playwright mostra a página SEM dialog nenhum. Reproduzido 3/3 com `--repeat-each=3 --retries=0` TANTO na baseline 348a04f quanto depois desta passada — pré-existente e idêntico em grau, independente da anatomia de overlay.'
    location: 'frontend/src/pages/MigrationRitualPage.tsx:268-272'
    severity: medium
---

<intent-contract>

## Intent

**Problem:** (a) DW-30 — `MonthlyDestinationPicker.tsx:354` e `DestinationPicker.tsx:423` ainda fazem `if (!compact) return content`: sem `Dialog` do MUI no ramo não-compact, o seletor entra no fluxo normal do DOM depois do corpo da página e pode abrir abaixo da dobra, produzindo o sintoma "clico e nada acontece" (mesma causa raiz já corrigida nos dois rituais de planejamento em 2026-08-03). Os testes dessas duas superfícies usam assert de PRESENÇA (`getByRole('dialog', …)`), que fica verde com o defeito de volta. (b) DW-29 — `weekly/WeeklyDestinationPicker.tsx` é código morto confirmado: nenhum import de produção, só o próprio teste e `weekly/noLiteralTokens.test.ts`.

**Approach:** Envolver os dois seletores legados vivos em `Dialog` portalizado no ramo não-compact, preservando o `Drawer` do compact e TODO o resto (props, regras de domínio, mutações, erro), e trocar os asserts de presença dessas superfícies pelo assert ESTRUTURAL que `DestinationDialog.test.tsx` introduziu. Em seguida apagar o componente morto do Weekly com seu teste e sua entrada no `noLiteralTokens`, no mesmo commit.

## Boundaries & Constraints

**Always:**
- Só ENVOLVER: nenhuma prop, assinatura, regra de destino, mutação, rótulo nomeado ou tratamento de erro muda nos dois seletores.
- Não-compact → `<Dialog open onClose={onClose}>` portalizado; compact → o `Drawer anchor="bottom"` atual, byte a byte.
- Exatamente UM `role="dialog"` em qualquer faixa: `role`/`aria-label` ficam no CONTEÚDO só quando `compact`; no ramo `Dialog` o nome vai em `slotProps.paper['aria-label']` — o molde já provado na MESMA superfície por `FutureMonthPicker.tsx:142-160`. O nome acessível continua sendo `Escolher destino` nos dois seletores.
- A prova de regressão é ESTRUTURAL (portal + `.MuiDialog-root`), nunca de presença — é literalmente o motivo de DW-30 existir.
- Uma tecla, um fechamento: com o `Dialog` no ar, `Escape` chama `onClose` exatamente uma vez.
- DW-29 sai em bloco: componente + teste + `?raw`/chave de `SOURCES` no mesmo commit (um `?raw` órfão quebra a transformação do Vite).
- Todo valor estrutural/cromático continua vindo de `var(--ds-*)`.

**Block If:**
- Voltar ao verde exigir mudar COMPORTAMENTO (não locator/anatomia) de algum teste pré-existente.
- Aparecer consumidor de produção novo de `WeeklyDestinationPicker` na conferência antes de apagar.
- Fechar o defeito exigir tocar o Enter/`useKeyboardShortcuts` de `DestinationPicker.tsx:166-177`: isso é DW-20, cuja spec (`spec-dw-20-destination-picker-enter-key-race-2.md`) está `blocked` aguardando decisão humana.

**Never:**
- Não migrar os call-sites para `DestinationDialog` — o pedido é paridade de anatomia, não reescrita de superfície.
- Não deletar nem alterar a lógica de `monthly/MonthlyDestinationPicker.tsx`, que segue VIVO em `FutureBoardPage.tsx:470`.
- Não mudar o contrato de `POST /migrate/` nem de `place/`; a passada é frontend-only.
- Não tocar `FutureMonthPicker`, `DestinationDialog`, `BrainDumpDestinationPicker`, `RecurringPlacementDialog` nem os rituais semanal/mensal (já migrados).
- Não editar `deferred-work.md`, `sprint-status.yaml` nem `epics.md` — o orquestrador registra a resolução.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Future Log, faixa desktop | "Definir dia de…"/"Mover…"/"Mover tarefa" do detalhe | Seletor sobreposto e visível sem rolagem, portalizado para fora do container da página | N/A |
| Migração, faixa desktop | "Escolher destino…" | Idem, com as 3 abas (Esta semana · Dia no mês · Outro mês) intactas | N/A |
| Falha de escrita | POST rejeitado com destino armado | Seletor CONTINUA aberto, destino armado preservado, motivo em `role="alert"` | Mensagem local inalterada |
| Escape no desktop | Foco dentro do seletor | Fecha uma única vez (nunca dois `onClose`) | N/A |
| Faixa compact | Abaixo do breakpoint | `Drawer anchor="bottom"` com `role="dialog"` nomeado no conteúdo — sem regressão | N/A |
| Troca de mês em foco | Pai atualiza `targetMonthFirst` | Dia armado descartado, como hoje | N/A |

</intent-contract>

## Code Map

**DW-30 — os dois seletores a envolver**

- `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.tsx` -- **defeito :354**. `content` :147-352, com `role="dialog"`/`aria-label="Escolher destino"` em :149-150 e `onKeyDown={handleContainerKeyDown}` em :151. Escape em :119-122 — SEM `stopPropagation`, então com o `Modal` do MUI no caminho o `onClose` seria chamado duas vezes. `Drawer` compact :356-374 (preservar). Reset do dia ao trocar de mês :91-93, `confirmLabelFor` :125-135, `role="row"` entre grid/gridcell :272 — tudo read-only.
- `frontend/src/features/bujo/components/DestinationPicker.tsx` -- **defeito :423**. `content` :193-421, `role="dialog"`/`aria-label` :195-196. `Drawer` compact :425-443 (preservar). :166-177 `useKeyboardShortcuts({Enter, Escape})` em `window` — **NÃO TOCAR** (DW-20 bloqueada). O listener é de fase de bolha, então o `stopPropagation` do `Modal` já o neutraliza no Escape: nada a mudar aqui, só a provar.
- `frontend/src/features/bujo/components/future/FutureMonthPicker.tsx:142-160` -- **molde a copiar**, read-only: `aria-label` em `slotProps.paper`, com :12-17 explicando por que no componente não funciona (cai no root `role="presentation"` do Modal). É o OUTRO overlay da mesma página.
- `frontend/src/features/bujo/components/DestinationDialog.tsx` -- read-only: :397-404 role/aria-label só no compact · :340-347 Escape com `preventDefault`+`stopPropagation` ("uma tecla, um fechamento") · :608-656 o par `Drawer`/`Dialog`.
- `frontend/src/features/bujo/components/DestinationDialog.test.tsx:72-104` -- **os 4 asserts estruturais a espelhar** (portal, `.MuiDialog-root`, `aria-modal`, um único `role="dialog"`, e o caso compact com `.MuiDrawer-root`). :612,:620 usam `axe(document.body)` — precedente verde para medir com Dialog aberto.

**Call-sites e testes**

- `frontend/src/pages/planner/FutureBoardPage.tsx:469-480` (`MonthlyDestinationPicker`, import :39) e `frontend/src/pages/MigrationRitualPage.tsx:406-417` (`DestinationPicker`, import :36) -- só renderizam; **nada a mudar**.
- `frontend/src/pages/planner/FutureBoardPage.test.tsx` -- asserts de presença :393 e :442-443 (`within(seletor)` segue válido: o paper contém o conteúdo). Os axe :751 e :760 rodam SEM o seletor aberto → `axe(container)` continua correto lá.
- `frontend/src/pages/MigrationRitualPage.test.tsx` -- presença :203 e :218-220; **:297-304 roda `axe(container)` com o seletor ABERTO** — depois da portalização esse container fica vazio e `aria-hidden`, então o teste pararia de medir o que o nome dele promete.
- `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.test.tsx` -- :57 e :64 disparam `keyDown` em `screen.getByRole('dialog')`; com o `Dialog` o papel migra para o paper e o handler fica num FILHO, então o evento tem de partir de dentro do conteúdo. :195-219 `axe(container)` no ramo não-compact.
- `frontend/src/features/bujo/components/DestinationPicker.test.tsx:154-155` -- `axe(container)` no ramo não-compact.

**DW-29 — o que sai junto**

- `frontend/src/features/bujo/components/weekly/WeeklyDestinationPicker.tsx` + `WeeklyDestinationPicker.test.tsx` -- apagar. Grep desta passada: nenhum import de produção.
- `frontend/src/features/bujo/components/weekly/noLiteralTokens.test.ts:13` (`?raw`) e `:25` (chave de `SOURCES`) -- remover as duas linhas no MESMO commit.
- Prosa com referência pendurada, ajustar de passagem: `DestinationDialog.tsx:5,229,433,452`, `DestinationPicker.tsx:7,17`, `monthly/MonthlyDestinationPicker.tsx:3`.

**E2E**

- `frontend/e2e/future-log-board.spec.ts:37-42` -- o comentário do helper `seletorDestino` AFIRMA que em wide/medium/tablet o seletor é inline e que `waitForDialogSettled` nunca assentaria: vira falso com esta correção. Usos :266, :324, :413; gate axe com o seletor aberto :402-428.
- `frontend/e2e/migration-ritual.spec.ts:68-89` -- o caminho equivalente na Migração. Também tocam o seletor: `migration-flow.spec.ts:169-170`, `unified-migration-queue.spec.ts`.
- `frontend/e2e/shellHelpers.ts:116` `expectVisibleWithoutScrolling` (prova GEOMÉTRICA) e `:140+` `waitForDialogSettled` -- reusar, sem criar helper novo.
- `frontend/e2e/weekly-planning-ritual.spec.ts:112-154` -- molde exato da prova geométrica a replicar.

**Baseline medida antes de mudar código (2026-08-05 19:40):** `npx tsc -b --noEmit` sem erro; `npx vitest run` nos 6 arquivos afetados = 6 arquivos / 165 testes verdes. Qualquer vermelho depois é regressão desta passada.

## Tasks & Acceptance

**Execution:**
- `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.tsx` -- envolver o não-compact em `Dialog` portalizado (molde `FutureMonthPicker:142-160`), mover `role`/`aria-label` do conteúdo para `slotProps.paper` fora do compact e acrescentar `stopPropagation` no Escape -- fecha o defeito sem duplicar papel nem fechamento
- `frontend/src/features/bujo/components/DestinationPicker.tsx` -- mesma envoltória e mesmo tratamento de `role`/`aria-label`, sem tocar `useKeyboardShortcuts` -- fecha o defeito na Migração preservando o escopo bloqueado de DW-20
- `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.test.tsx` -- acrescentar os asserts estruturais (portal, `.MuiDialog-root`, `aria-modal`, um único `role="dialog"`, compact em `.MuiDrawer-root`), cobrir o Escape de uma só chamada, migrar os `keyDown` para dentro do conteúdo e os `axe` para `document.body` -- é o que impede a regressão de voltar invisível
- `frontend/src/features/bujo/components/DestinationPicker.test.tsx` -- os mesmos asserts estruturais e o `axe(document.body)` -- idem na Migração
- `frontend/src/pages/planner/FutureBoardPage.test.tsx` -- trocar os asserts de presença :393 e :442 pelo estrutural -- assert de presença fica verde com o defeito de volta
- `frontend/src/pages/MigrationRitualPage.test.tsx` -- idem em :203/:218, e apontar o `axe` de :303 para `document.body` -- senão o gate de a11y do seletor deixa de medir o seletor
- `frontend/e2e/future-log-board.spec.ts` -- corrigir o comentário :37-42 e provar geometricamente (`waitForDialogSettled` + `expectVisibleWithoutScrolling`) que o seletor abre dentro da viewport em wide -- prova ponta-a-ponta do sintoma relatado
- `frontend/e2e/migration-ritual.spec.ts` -- mesma prova geométrica no "Escolher destino…" da Migração -- a segunda superfície do defeito
- `frontend/src/features/bujo/components/weekly/WeeklyDestinationPicker.tsx`, `WeeklyDestinationPicker.test.tsx`, `weekly/noLiteralTokens.test.ts` -- apagar os dois primeiros e remover o `?raw` :13 + a chave :25 do terceiro, depois de reconferir por grep que nenhum consumidor novo apareceu -- DW-29; um `?raw` órfão quebra o Vite
- `frontend/src/features/bujo/components/DestinationDialog.tsx`, `DestinationPicker.tsx`, `monthly/MonthlyDestinationPicker.tsx` -- ajustar só a PROSA que aponta para o arquivo removido -- não deixar referência pendurada

**Acceptance Criteria:**
- Dado o Future Log ou a Migração em faixa desktop, quando o usuário abre o seletor de destino, então ele aparece sobreposto e inteiramente dentro da viewport, sem qualquer rolagem.
- Dado um teste que só verificasse a PRESENÇA de `role="dialog"`, quando o `if (!compact) return content` voltasse, então a suíte falharia mesmo assim — porque o assert é estrutural (portal + raiz de modal).
- Dado o seletor aberto em qualquer faixa, quando a árvore de acessibilidade é inspecionada, então existe exatamente um `role="dialog"` e ele tem o nome acessível "Escolher destino".
- Dada a passada concluída, quando se roda o grep por `WeeklyDestinationPicker` em `frontend/src` e `frontend/e2e`, então não sobra nenhuma referência de código — só prosa ajustada.
- Dada a baseline de 165 testes verdes nos 6 arquivos afetados, quando a suíte roda depois da mudança, então nenhum teste pré-existente ficou vermelho por mudança de COMPORTAMENTO.

## Spec Change Log

## Review Triage Log

## Design Notes

Cinco pontos onde a envoltória tem custo real se feita sem cuidado:

1. **Nome acessível.** `aria-label` posto no `<Dialog>` pousa no root `role="presentation"` do Modal e deixa o overlay anônimo. O paper do `Dialog` já é o `role="dialog"`, então o nome tem de ir em `slotProps.paper['aria-label']` — e o `role`/`aria-label` do conteúdo tem de sair fora do compact, senão ficam DOIS `role="dialog"` aninhados, o de fora sem nome. No `Drawer` é o inverso: o MUI não estampa papel nenhum, então o conteúdo mantém os seus.
2. **Escape.** O `Modal` chama `onClose` no próprio `keydown`. Num handler interno que só faz `preventDefault`, o evento sobe e fecha duas vezes — daí o `stopPropagation` do molde de `DestinationDialog:340-347` no `MonthlyDestinationPicker`. No `DestinationPicker` o Escape vem de um listener de `window` em fase de bolha, que o `stopPropagation` do Modal já corta antes: nada a mudar, mas é comportamento novo e merece teste.
3. **`axe(container)` vira medida vazia.** Com o conteúdo portalizado, o container do RTL fica sem o seletor e ainda recebe `aria-hidden` do Modal. Todo `axe` que pretende medir o seletor aberto passa a `axe(document.body)` — precedente verde em `DestinationDialog.test.tsx:612`. Os `axe(container)` que rodam com o seletor FECHADO ficam como estão.
4. **`keyDown` no elemento certo.** Com o papel no paper, `fireEvent.keyDown(screen.getByRole('dialog'))` não alcança mais o handler, que está num filho. Disparar de um elemento de dentro (uma célula do calendário, por exemplo) — que é também o que o usuário faz de verdade.
5. **Ordem do commit em DW-29.** O `?raw` de `noLiteralTokens.test.ts:13` referencia o arquivo por caminho: apagar o componente sem tirar o import quebra a transformação do Vite e derruba a suíte inteira do módulo, não só aquele teste.

## Verification

**Commands:**
- `nvm use 22.15.1` -- pré-requisito: a sessão inicia em Node 18, incompatível com o frontend
- `cd frontend && npx tsc -b --noEmit` -- expected: sem erro (o vitest usa esbuild e NÃO type-checa)
- `cd frontend && npm run lint` -- expected: sem erro
- `cd frontend && npx vitest run` -- expected: full-suite verde; comparar com a baseline registrada no Code Map
- `cd frontend && CI=1 npx playwright test e2e/future-log-board.spec.ts e2e/migration-ritual.spec.ts e2e/migration-flow.spec.ts` -- expected: verde; o Playwright sobe os servidores sozinho contra o Postgres local `bujo_e2e`
- `grep -rn "WeeklyDestinationPicker" frontend/src frontend/e2e` -- expected: só prosa de comentário, nenhum import nem uso

**Manual checks (if no CLI):**
- Em wide/medium/tablet, abrir o seletor no Future Log e na Migração e confirmar que aparecem sobrepostos e centrados sem rolagem — a prova geométrica que o assert de portal cobre estruturalmente, mas não visualmente.
