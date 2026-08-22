# Test Automation Summary — Story 14.6 (Monthly Board e planejamento mensal no sistema novo)

**Workflow:** `bmad-qa-generate-e2e-tests` · **Data:** 2026-07-25 · **Story:** `14-6-monthly-board-e-planejamento-mensal-no-sistema-novo.md` · **Baseline do passo:** `monthly-board.spec.ts` (11 testes) + `monthly-planning-ritual.spec.ts` (13 testes) + 3 specs de regressão atualizados, 1387 Vitest, todos verdes ao fim do `dev-story` · **Framework:** Playwright (E2E) + Vitest (unit), ambos já no projeto

Story **irmã mensal da 14.5** — o `dev-story` já entregou cobertura densa (24 testes E2E novos + 9
arquivos de unit test novos), majoritariamente frontend sobre um backend já pronto desde as
Stories 14.1/14.2/14.4. Este passo não reexercitou isso. Comparou teste a teste `monthly-board.spec.ts`/
`monthly-planning-ritual.spec.ts` contra os specs **irmãos diretos** do Weekly
(`weekly-board.spec.ts`/`weekly-planning-ritual.spec.ts`, 14.5, já auditados pelo mesmo workflow) —
qualquer cenário provado lá e ausente aqui, sem justificativa de divergência deliberada do M07, é
lacuna real.

## Lacunas encontradas e fechadas

### `monthly-board.spec.ts` — 11 → **12** testes (1 novo)

| # | Lacuna | Teste |
|---|---|---|
| 1 | **AC2 "`TaskDetailCard` aberto inalterado: mesmo footer"** nunca provava Cancelar/Excluir contra o backend real neste board — só Salvar (categoria/Eisenhower) tinha E2E. Confirmado em código: `TaskDetailCard` fecha `Cancelar tarefa`/`Excluir tarefa` sobre hooks PRÓPRIOS (`useDeleteTaskMutation`/`useTransitionTaskMutation`), sem precisar de props do board — o mesmo componente, inalterado, que a 14.5 já tinha coberto. | `Detalhe da tarefa: Cancelar transiciona o status; Excluir remove a linha (AC2)` — molde direto do análogo `weekly-board.spec.ts`. |

### `monthly-planning-ritual.spec.ts` — 12 → **13** testes (1 novo)

| # | Lacuna | Teste |
|---|---|---|
| 1 | **Estado offline do ritual (AC7)** — banner "Sem conexão", `aria-disabled` nas ações, clique guardado sem fila local — nunca exercitado contra o browser real neste ritual, apesar de já ser precedente direto e obrigatório no Weekly. | `offline desabilita decisões com motivo; clique fica guardado, sem fila local (AC7)` — molde direto do análogo `weekly-planning-ritual.spec.ts`, usando a fonte `future-log` (não-bloqueante) por decisão deliberada (ver Achado 1). |

### Vitest — 4 testes novos em 3 arquivos

| # | Arquivo | Lacuna | Teste |
|---|---|---|---|
| 1 | `MonthlyBoardPage.test.tsx` (12→**13**) | **AC7 "empty por filtro"** — filtro sem nenhum resultado precisa manter a barra visível e limpável; `WeeklyBoardPage.test.tsx` já prova isso, `MonthlyBoardPage.test.tsx` não tinha o caso equivalente. | `empty por filtro (AC7): filtro sem resultado nenhum mantém a barra visível e limpável` |
| 2 | `MonthlyPlanningPage.test.tsx` (8→**11**) | **AC5 "falha preserva item, mostra o motivo, oferece Tentar novamente"** e **AC7 "offline"** — `WeeklyPlanningPage.test.tsx` prova essas 3 integrações (decisão falhando+retry, migrate falhando sem fechar o seletor, offline) na própria página, não só no componente isolado; `MonthlyPlanningPage.test.tsx` só tinha a cobertura no componente (`MonthlyDecisionList.test.tsx`). | `Concluir falhando mostra o motivo + Tentar novamente; retry repete a MESMA ação`; `POST de migrate falhando NÃO fecha o seletor e mostra o motivo`; `sem rede: aviso persistente role=status e decisões indisponíveis` |
| 3 | `MonthlyDecisionList.test.tsx` (12→**13**) | **Disparo de `Adiar ao Future Log`** (`defer_to_future_log`) — a única ação da matriz (`allocate`/`keep_undated`/`complete`/`cancel`/`migrate_named_day`/`defer_to_future_log`) sem teste de disparo dedicado (`onX chamado com o id`); só a PRESENÇA do botão era testada. Nenhum E2E dedicado a esta ação foi necessário: o `migrateTask.mutate`/`placeTemplate.mutate` que ela invoca já é exercitado ponta-a-ponta por outros testes (destino, Alocar). | `onDeferToFutureLog dispara com o id do template (única ação de adiamento em recurring)` |

## Questão aberta respondida

**Questão 3 do Dev Notes** ("se `weekly-monthly-review.spec.ts` precisa de um teste substituto
cobrindo 'pull do Future Log' no novo ritual, ou se `monthly-planning-ritual.spec.ts` já cobre esse
caso por completude"): **respondida — sim, já cobre por completude.** O teste `future-log: Manter
sem dia` cobre a disposição `keep_undated`; o teste `seletor de destino mensal` usa o MESMO item de
Future Log para cobrir "escolher um dia" (migração). As duas disposições exercitáveis da fonte já
têm prova ponta-a-ponta contra o backend real. Nenhum teste substituto foi criado.

## Achados

**1 — Bug de autoria do próprio teste (não de produto), achado e corrigido durante a escrita.**
O primeiro rascunho do teste "Concluir falhando" usava a fonte `previous-monthly` (a única com a
ação `Concluir`) e falhava com `TestingLibraryElementError: Found multiple elements with the role
"alert"` — a página já renderiza, persistentemente, um segundo `role="alert"` para o aviso
bloqueante do Monthly anterior (AC5: "Monthly anterior: N pendência(s) — bloqueia iniciar mês"),
que colide com o `role="alert"` do erro por item quando a MESMA fonte é usada para os dois papéis.
É a mesma razão pela qual `WeeklyPlanningPage.test.tsx` usa uma fonte NÃO-bloqueante
(`monthly-in-week`) para o teste equivalente — o Monthly não tem uma fonte de item não-bloqueante
com a ação `Concluir` disponível (só `previous-monthly` a oferece), então a correção foi escopar a
asserção a `within(getByRole('region', {name: 'Decisões — Monthly anterior'}))` em vez de trocar de
fonte. Registrado aqui para quem for reusar este molde numa fonte bloqueante.

**Nenhum achado de produto novo neste passo** — as 3 lacunas fechadas exercitam comportamento já
implementado e já provado por caminhos adjacentes (unit test do componente isolado, ou a mesma
mutação exercitada por uma ação irmã); o objetivo era fechar a lacuna de PROVA, não descobrir
defeito.

## Provas de não-vacuidade

| # | O quê | Resultado |
|---|---|---|
| (a) | `applyFilters` (MonthlyBoardPage.tsx) alterado para devolver `tasks` sem filtrar | O teste "empty por filtro" falhou de forma determinística (`queryByText('Pendente')` continuava visível após o filtro) — confirmado, restaurado, arquivo de produção idêntico ao original |
| (b) | `handleRetryItem` (MonthlyPlanningPage.tsx) virou no-op | O teste "Concluir falhando... retry repete a MESMA ação" falhou (`mockPost` chamado 1x, não 2x) — confirmado, restaurado |
| (c) | `onError` do `migrateTask.mutate` em `handleConfirmDestination` virou no-op | O teste "POST de migrate falhando" falhou (alerta nunca aparece, timeout) — confirmado, restaurado |
| (d) | `offline={!isOnline}` fixado em `offline={false}` no `MonthlyDecisionList` | O teste "sem rede" falhou (`aria-disabled` ficou `"false"`, esperado `"true"`) — confirmado, restaurado |

Os 2 specs E2E novos não passaram por reversão cirúrgica de produção (risco já mitigado: exercitam
caminhos de mutação — `DELETE`/`POST transition`/`context.setOffline` — que só podem passar contra
uma implementação real e correta; uma implementação quebrada faz o teste falhar naturalmente, como
demonstrado pelas rodadas de descoberta do próprio `dev-story`, ver Debug Log References da story).

## Gates

| Gate | Resultado |
|---|---|
| `npx tsc -b --noEmit` (Node 22.15.1) | limpo |
| `npm run lint` (eslint) | limpo |
| `npx vitest run` | **115 arquivos, 1392 testes** (+5 sobre os 1387 do dev-story) |
| `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate --check` (branch Neon `e2e`) | limpo (exit 0), confirmado antes de cada rodada de Playwright |
| `CI=1 npx playwright test monthly-board.spec.ts monthly-planning-ritual.spec.ts` (isolado, 2 rodadas) | **25/25 passed** em ambas as rodadas (8.8min e 5.9min) — 3 flaky na 1ª rodada, 2 flaky (DIFERENTES) na 2ª, todos testes PRÉ-EXISTENTES (não desta passagem de QA), mesma causa raiz (timeout no fixture de signup/login contra a branch Neon `e2e`, cold-start já documentado nas retros dos Épicos 4/5/11) |

**Contagem re-derivada por contagem literal de `test(`/`it(` (nunca por subtração):
`monthly-board.spec.ts` 11→**12**, `monthly-planning-ritual.spec.ts` 12→**13** (a Task 10 da story
já citava "13 testes" para este arquivo na entrega original do dev-story, mas a contagem literal do
arquivo entregue era 12 — divergência pré-existente, corrigida nesta recontagem).
`MonthlyBoardPage.test.tsx` 12→**13**, `MonthlyPlanningPage.test.tsx` 8→**11**,
`MonthlyDecisionList.test.tsx` 12→**13**.

## Cobertura

- **AC2 (Task Row/detalhe canônico):** Cancelar/Excluir agora com E2E contra o backend real neste
  board, fechando a paridade com o Weekly (Salvar+categoria+Eisenhower já tinha E2E desde o
  dev-story).
- **AC5 (ritual):** falha de decisão com retry e falha de migração agora provadas na integração da
  PÁGINA (não só no componente isolado); disparo de `Adiar ao Future Log` provado.
- **AC7 (estados obrigatórios):** offline do ritual agora com E2E (browser real,
  `context.setOffline`) e com unit (integração da página, `navigator.onLine`); "empty por filtro"
  do Monthly Board agora coberto, fechando paridade com o Weekly.
- **Questão aberta #3 do Dev Notes:** respondida (ver seção acima).
- **Sem cobertura, por decisão (fora do escopo desta story):** os 4 buckets da fonte Recorrentes
  (`items` monthly+annual, `alreadyPlaced`, `alreadyPlacedInYear`) já têm cobertura de unit
  exaustiva (`monthlyRitualSources.test.ts`) — nenhum E2E dedicado ao bucket anual foi adicionado,
  por já existir prova de wiring E2E equivalente via o bucket mensal (`recorrentes: Alocar`); os 3
  achados de acessibilidade e o bug de layout tablet já documentados pelo `dev-story` não foram
  reauditados (fora do escopo de geração de teste).

## Próximos passos

1. Regressão desta story (`monthly-board.spec.ts`, `monthly-planning-ritual.spec.ts`) cresceu de
   23 para 25 testes — considerar o tempo agregado (~6-9min só os dois arquivos) ao escopar
   regressão de stories futuras do Épico 14 que tocarem o Monthly Board ou o `TaskDetailCard`.
2. A flakiness de cold-start da branch Neon `e2e` (fixture de signup/login) segue afetando
   1-3 testes por rodada, sempre resolvida por retry — nenhuma ação nova recomendada além do que
   as retros dos Épicos 4/5/11 já registraram; **nenhum** dos testes flaky nas duas rodadas
   coincide com os 2 testes que este passo adicionou.
3. Se uma story futura precisar testar a matriz completa de `Adiar ao Future Log` (recurring vs.
   future-log vs. previous-monthly, os 3 branches de `handleDeferToFutureLog`), o dispatch já está
   provado (`MonthlyDecisionList.test.tsx`) e o `migrateTask.mutate`/`placeTemplate.mutate` já é
   provado por outros caminhos — faltaria só um E2E ponta-a-ponta específico para essa ação, se o
   produto priorizar essa prova.
