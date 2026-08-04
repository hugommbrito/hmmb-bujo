---
title: 'DW-17/DW-18: linhagem cross-período do Arquivo — predecessor esquecido e retorno de foco em pilha'
type: 'bugfix'
created: '2026-08-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '22e3c2fbd50168b85c910f14c6815b177d89de58'
final_revision: '2628a2cbfbf4f8f58f642b2a00c8d84dd74a5a05'
context: []
warnings: ['multiple-goals', 'oversized']
deferred:
  - summary: >-
      A pilha de retorno (DW-18) sobrevive a sobrescrita (o bug literal do ledger), mas o
      efeito de chegada sempre prioriza `location.state.focusTaskId` antes de consultar a
      pilha -- então, numa cadeia de 2+ saltos (A→B→C), o botão nativo "voltar" do
      navegador nunca deixa uma página intermediária (B) consumir sua própria entrada
      empilhada; quando a pilha finalmente é lida (ex.: ao voltar até A, ou ao reentrar
      via link fresco pelo índice do Arquivo), o topo pode pertencer a uma página
      diferente da que está perguntando.
    evidence: |-
      Achado convergente por 3 revisores independentes (blind-hunter, edge-case-hunter,
      intent-alignment auditor) na pass de review de 2026-08-03. Confirmado por leitura:
      `if (arrivalTaskId) { focusTaskRow(...); return }` roda ANTES de `readLineageReturn()`
      em ambas as páginas, e o histórico do navegador preserva o `location.state` original
      de cada entrada -- então voltar para uma página alcançada por seta de linhagem
      SEMPRE tem `focusTaskId` presente, nunca cai no ramo da pilha. A ambiguidade de
      "qual página consome qual entrada" já existia identicamente na versão de chave única
      (o mesmo blind-read sem atribuição por página) -- este diff não a introduz, só a torna
      mais visível ao permitir múltiplas entradas sobreviverem simultaneamente. Sem
      regressão real: o padrão "sair via 'Voltar ao Arquivo', reentrar via link fresco do
      índice" (a única outra forma de retorno que a UI oferece) consome a pilha em ordem
      LIFO corretamente, hop a hop. Consequência limitada pelo próprio design "melhor
      esforço" já documentado (`focusTaskRow` numa linha errada só devolve `false`, nunca
      lança) -- resolver de verdade exigiria chavear a pilha por identidade de página
      (weekStart/monthFirst), não só por ordem de inserção, o que é escopo maior que
      "trocar valor único por pilha" (texto literal do ledger).
    location: frontend/src/pages/archive/archiveLineageReturn.ts (readLineageReturn/clearLineageReturn); ArchiveWeeklyDetailPage.tsx e ArchiveMonthlyDetailPage.tsx (efeito de chegada)
    severity: medium
  - summary: >-
      `findPredecessor` nas duas páginas não trata `isPending`/`isError` das queries de
      período de origem -- enquanto a busca cross-período carrega ou se falha, "Veio de"
      fica indistinguível de "sem predecessor conhecido" (nunca um estado de carregamento
      ou erro visível).
    evidence: |-
      Achado convergente por 2 revisores independentes (blind-hunter, edge-case-hunter).
      Confirmado por leitura: `originIsWeekly ? originWeeklyLog.data : undefined` só lê
      `.data`, nunca `.isPending`/`.isError`. Auto-corrige quando a query resolve (o
      componente re-renderiza e o predecessor aparece), então o impacto real é um flash
      breve em cache-miss frio, não uma perda permanente -- mas não é mecânico o bastante
      pra corrigir sem decisão de produto sobre o que exibir nesse intervalo (spinner no
      slot do predecessor? nada?), então não é `patch` trivial.
    location: frontend/src/pages/archive/ArchiveWeeklyDetailPage.tsx; ArchiveMonthlyDetailPage.tsx (findPredecessor/call site)
    severity: low
  - summary: >-
      `originPeriod` é tipado como `MigrationTarget` (inclui a variante `type: 'daily'`),
      mas nenhuma das duas páginas de Arquivo consegue produzir esse tipo hoje -- se algum
      dia surgisse, `originIsWeekly`/`originIsMonthly` seriam ambos `false` e o fallback
      simplesmente não funcionaria, sem erro de compilação nem sinal em runtime.
    evidence: |-
      Achado de 1 revisor (blind-hunter). Confirmado por leitura: só `ArchiveWeeklyDetailPage.tsx`/
      `ArchiveMonthlyDetailPage.tsx` escrevem `originPeriod`, e ambas hardcodam o literal
      `'weekly'`/`'monthly'` -- `DailyPage.tsx` nunca passa `onNavigateToSuccessor` (confirmado
      por grep em toda `frontend/src`), então não há call site real que produza `type: 'daily'`
      aqui. Hardening preventivo, mesma classe de achados já aceitos em bundles anteriores.
    location: frontend/src/pages/archive/ArchiveWeeklyDetailPage.tsx; ArchiveMonthlyDetailPage.tsx (originIsWeekly/originIsMonthly)
    severity: low
  - summary: >-
      `writeLineageReturn` empilha sem deduplicar -- se a mesma tarefa de origem for
      empilhada mais de uma vez sem nunca ser consumida (ex.: compondo com o achado de
      atribuição por página acima), a pilha acumula entradas redundantes do mesmo id.
    evidence: |-
      Achado de 1 revisor (blind-hunter). Confirmado por leitura: `writeLineageReturn` só
      faz `stack.push(taskId)`, sem checar duplicata. Sem consequência funcional real além
      de desperdiçar uma tentativa extra de `focusTaskRow` (idempotente, melhor esforço) --
      não é um vazamento (sessionStorage é limitado ao tab/sessão), só redundância.
    location: frontend/src/pages/archive/archiveLineageReturn.ts (writeLineageReturn)
    severity: low
  - summary: >-
      O helper de teste `renderPage(initialEntry, state)` em `ArchiveWeeklyDetailPage.test.tsx`/
      `ArchiveMonthlyDetailPage.test.tsx` ignora o argumento `initialEntry` para o `pathname`
      real (só o usa para a prop `key` do `MemoryRouter`) -- um teste futuro que passe um path
      genuinamente diferente do default não erraria, só carregaria o período errado
      silenciosamente.
    evidence: |-
      Achado de 1 revisor (blind-hunter). Confirmado por leitura: `pathname` dentro de
      `initialEntries` é hardcoded pro valor default do arquivo em ambas as páginas,
      PRÉ-EXISTENTE a este diff (nenhuma das duas funções `renderPage` foi tocada pelas
      mudanças de DW-17/DW-18). Todos os testes novos desta bundle passam exatamente o
      path que já é o default, então nada quebra hoje.
    location: frontend/src/pages/archive/ArchiveWeeklyDetailPage.test.tsx; ArchiveMonthlyDetailPage.test.tsx (renderPage)
    severity: low
  - summary: >-
      `WeeklyBoardPage.tsx` tem sua própria busca de predecessor artesanal que não recorre
      em `subtasks` -- a mesma classe de bug que a Story 14.10 (review) já corrigiu nas duas
      páginas do Arquivo, mas nunca replicada pro board ativo.
    evidence: |-
      Achado de 1 revisor (verification-gap), explicitamente marcado por ele como fora do
      escopo desta bundle ("no qualifying supersession signal"). Confirmado por leitura:
      `WeeklyBoardPage.tsx:79-97` tem um loop próprio sobre `days`/`unscheduled` sem
      recursão em subtasks; `WeeklyBoardPage.test.tsx` não tem teste de subtarefa/"Veio de".
      Arquivo nunca tocado por este diff -- DW-17/DW-18 só deduplicaram as cópias do
      Arquivo, sem alcance sobre o board ativo.
    location: frontend/src/features/bujo/components/weekly/WeeklyTaskPanel.tsx ou WeeklyBoardPage.tsx (busca de predecessor não recursiva)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Dois gaps deixados de propósito fora do escopo da Story 14.10 (linhagem do Arquivo). (DW-17) `findPredecessor`/`findPredecessorTask` em `ArchiveWeeklyDetailPage.tsx`/`ArchiveMonthlyDetailPage.tsx` só varrem o período CARREGADO — uma tarefa alcançada via seta de linhagem cross-período nunca mostra "Veio de" quando o predecessor mora em outro período. (DW-18) `archiveLineageReturn.ts` guarda o retorno em UMA única chave de `sessionStorage` — um segundo salto (B→C) antes de voltar do primeiro (A→B) sobrescreve a entrada, perdendo o foco-ao-voltar da primeira origem.

**Approach:** (DW-17) A página de ORIGEM passa sua própria identidade de período (`originPeriod: MigrationTarget`) via `location.state` ao navegar; a página de DESTINO usa `useWeeklyLogQuery`/`useMonthlyLogQuery` (já existentes) para também carregar esse período de origem e cair nele quando a busca local falha. (DW-18) Trocar o valor único por um array JSON (pilha LIFO): `writeLineageReturn` empilha, `readLineageReturn` espia o topo, `clearLineageReturn` remove só o topo.

## Boundaries & Constraints

**Always:** a recursão em `subtasks` (`task.migratedToTask === taskId`) e o invariante "ler e limpar juntos" de `archiveLineageReturn` (fixes da review de 2026-07-28) continuam intactos — esta bundle estende, nunca regride. A busca recursiva duplicada nas duas páginas é deduplicada em UM helper (`taskTree.ts`), mesma convenção já usada para `findTaskById` (Story 14.10, review). `useWeeklyLogQuery` ganha `options?: { enabled?: boolean }` com default `true` — todo call site existente (`MigrationRitualPage`, `WeeklyBoardPage`, `WeeklyPlanningPage`) continua idêntico. A query do período de origem só é `enabled` quando `originPeriod` existe E seu `type` bate com o hook chamado — nunca dispara a busca "semana atual" (sentinela) como efeito colateral de um parâmetro ausente.

**Block If:** _nenhum — as duas correções são extensões mecânicas de um padrão já implementado e testado, sem ambiguidade deixada pelo texto do intent._

**Never:** tocar `DailyPage.tsx`/`TaskRow` legado (confirmado: nunca passam `onNavigateToSuccessor`, então um `originPeriod` do tipo `daily` é inatingível a partir destas duas páginas) ou `handleLineageClick`/`TaskRowBase.tsx` (navegação de ida já correta, fora de escopo). Não renomear a chave de `sessionStorage` de `archiveLineageReturn` — só o formato do valor muda (string → array JSON). Não restringir o fallback de período de origem só à tarefa de chegada (`focusTaskId`): qualquer tarefa aberta se beneficia, e um falso-positivo é estruturalmente impossível (`migratedToTask` identifica um único sucessor).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Predecessor no período carregado (hoje) | mesmo período | "Veio de" — inalterado | — |
| Predecessor em outra Weekly/Monthly (cross-tipo) | `location.state.originPeriod` resolvido, dado do período de origem carregado | "Veio de" com o período/dia real da origem | — |
| Predecessor na MESMA página mas período diferente (Weekly→Weekly outra semana) | `originPeriod.type === 'weekly'`, `weekStart` diferente do carregado | segunda `useWeeklyLogQuery` resolve, "Veio de" aparece | — |
| Chegada direta (sem seta de linhagem) | `originPeriod` ausente | nenhuma query extra dispara, resultado `null` (como hoje) | — |
| Dois saltos antes de voltar (A→B→C) | 2x `writeLineageReturn` sem `clear` entre eles | ambas sobrevivem; 1º `read`+`clear` revela a entrada anterior | — |
| Pilha vazia | nenhuma entrada gravada | `readLineageReturn()` → `null` | — |

</intent-contract>

## Code Map

- `frontend/src/pages/archive/ArchiveWeeklyDetailPage.tsx:60-87` -- `hasPredecessorTask`/`findPredecessor`: hoje só varre `days`/`unscheduled` do próprio `weeklyLog.data`; passa a delegar a busca recursiva ao helper novo e ganha fallback.
- `frontend/src/pages/archive/ArchiveWeeklyDetailPage.tsx:45-48,90-156,191` -- `ArchiveDetailLocationState`/`handleNavigateToSuccessor`/destructuring: adicionar `originPeriod?: MigrationTarget`; `handleNavigateToSuccessor` referencia `loadedWeekStart` (linha 191) via closure — legítimo em JS: a função só EXECUTA (em resposta a um clique) depois que o corpo do componente já rodou até lá, apesar de estar declarada antes textualmente.
- `frontend/src/pages/archive/ArchiveMonthlyDetailPage.tsx:37-40,67-86,88-154,189` -- espelho exato do arquivo Weekly (mesmas âncoras relativas, tipo `monthly`).
- `frontend/src/features/bujo/taskTree.ts` -- adicionar `findPredecessorTask(tasks, taskId)` (recursivo em `subtasks`, checa `task.migratedToTask === taskId`) — mesmo padrão de `findTaskById` já aqui.
- `frontend/src/pages/archive/archivePredecessor.ts` (NOVO) -- `findPredecessorInWeeklyLog(days, unscheduled, taskId)` / `findPredecessorInMonthlyLog(tasks, taskId)`: realocam os `findPredecessor` atuais de cada página (lógica idêntica, só a forma dos dados difere) para um módulo compartilhado, usando `findPredecessorTask` de `taskTree.ts`.
- `frontend/src/features/bujo/api.ts:218-223,301-307` -- `useWeeklyLogQuery`: adicionar `options?: { enabled?: boolean }` no mesmo molde de `useMonthlyLogQuery` (linha 301).
- `frontend/src/pages/archive/archiveLineageReturn.ts:13-16,35-50` -- cabeçalho documenta a limitação de "chave única" (precisa reescrita); `STORAGE_KEY`/`writeLineageReturn`/`readLineageReturn`/`clearLineageReturn` trocam o valor de string única para array JSON — mesma chave, mesma assinatura pública.
- `frontend/src/pages/archive/archiveLineageReturn.test.ts:46-50` -- teste que hoje PINA a sobrescrita como esperada ("limitação conhecida") — vira teste de pilha.
- `frontend/src/pages/archive/ArchiveWeeklyDetailPage.test.tsx:12-18,248,275,282,294` / `ArchiveMonthlyDetailPage.test.tsx` (espelho) -- mock de `useWeeklyLogQuery`/`useMonthlyLogQuery` hoje ignora o argumento (devolve sempre o mesmo valor); precisa despachar por parâmetro para simular período próprio + origem com dados distintos. Asserts de `sessionStorage.getItem(...)` que esperam string crua migram para o formato de array.

## Tasks & Acceptance

**Execution:**
- `frontend/src/features/bujo/taskTree.ts` -- adicionar `findPredecessorTask` (recursivo, subtasks) -- primitivo único reusado pelos dois lados da busca (local + origem)
- `frontend/src/pages/archive/archivePredecessor.ts` (novo) -- `findPredecessorInWeeklyLog`/`findPredecessorInMonthlyLog`, portando a lógica hoje duplicada em cada página
- `frontend/src/features/bujo/api.ts` -- `useWeeklyLogQuery` ganha `options?: { enabled?: boolean }` (default `true`)
- `frontend/src/pages/archive/ArchiveWeeklyDetailPage.tsx` -- `originPeriod?: MigrationTarget` no location state; `handleNavigateToSuccessor` passa `{ type: 'weekly', weekStart: loadedWeekStart }`; nova `useMonthlyLogQuery` (origem mensal) + segunda `useWeeklyLogQuery` (origem semanal de outra semana), ambas com `enabled` condicional; `findPredecessor` local delega às funções importadas com fallback pro período de origem
- `frontend/src/pages/archive/ArchiveMonthlyDetailPage.tsx` -- espelho exato (origem semanal via `useWeeklyLogQuery`, origem mensal de outro mês via segunda `useMonthlyLogQuery`)
- `frontend/src/pages/archive/archiveLineageReturn.ts` -- `writeLineageReturn` empilha (array JSON em `sessionStorage`), `readLineageReturn` espia o topo, `clearLineageReturn` remove só o topo; cabeçalho atualizado
- `frontend/src/pages/archive/archiveLineageReturn.test.ts` -- reescrever o teste de sobrescrita como teste de pilha (2 escritas + leituras/limpezas intercaladas revelando a entrada anterior)
- `frontend/src/pages/archive/ArchiveWeeklyDetailPage.test.tsx`, `ArchiveMonthlyDetailPage.test.tsx` -- mocks despachando por parâmetro; novos testes cobrindo a matriz de I/O (predecessor cross Weekly→Monthly, Monthly→Weekly, e mesma-página-outro-período); asserts de `sessionStorage` atualizados pro formato de array

**Acceptance Criteria:**
- Given uma tarefa alcançada via seta de linhagem cross-período (outra Weekly, outra Monthly, ou mesma página com semana/mês diferente), when o detalhe é aberto, then "Veio de" mostra o período correto mesmo com o predecessor fora dos dados do período carregado
- Given chegada direta (sem seta de linhagem, sem `originPeriod`), when o detalhe é aberto e o predecessor não está no período carregado, then nenhuma query extra dispara e o resultado permanece `null` (comportamento de hoje preservado)
- Given dois saltos de linhagem consecutivos (A→B→C) sem retornar do primeiro, when as duas escritas ocorrem, then ambas sobrevivem em `sessionStorage`; consumir (`read`+`clear`) uma vez revela a anterior, nenhuma é perdida
- Given a suíte completa do frontend (`npx vitest run`), when roda após as mudanças, then permanece 100% verde, sem regressão em `archiveLineageReturn`/`ArchiveWeeklyDetailPage`/`ArchiveMonthlyDetailPage`/demais consumidores de `useWeeklyLogQuery`

## Spec Change Log

## Review Triage Log

### 2026-08-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2 (high 0, medium 1, low 1)
- defer: 6 (high 0, medium 1, low 5)
- reject: 7 (high 0, medium 0, low 7)
- addressed_findings:
  - `[medium]` `[patch]` `useWeeklyLogQuery` (`frontend/src/features/bujo/api.ts`) ganhou `enabled` mas sem teste dedicado contra o hook real (a irmã `useMonthlyLogQuery` já tinha um) -- corrigido: novo teste em `api.test.tsx` (`useWeeklyLogQuery (AC3)`) espelhando o padrão existente, assertando que o fetch não roda com `enabled: false`.
  - `[low]` `[patch]` Ordem de parâmetros de `findPredecessor` estava invertida entre as duas páginas "espelho" (`ArchiveMonthlyDetailPage.tsx` recebia origem semanal primeiro; `ArchiveWeeklyDetailPage.tsx` recebia origem mensal primeiro) -- corrigido: `ArchiveWeeklyDetailPage.tsx` alinhado para `(..., originWeeklyLog, originMonthlyLog)`, mesma ordem da irmã; sem mudança de comportamento (só um dos dois logs de origem é definido por vez, por construção de `MigrationTarget.type`).
- Achados roteados como `defer` (registrados em `deferred` no frontmatter, não repetidos aqui): ambiguidade de atribuição por página na pilha de retorno quando a chegada via `focusTaskId` sempre roda antes da leitura da pilha (achado convergente de 3 revisores -- blind-hunter, edge-case-hunter, intent-alignment auditor; avaliado contra o texto verbatim do ledger -- "replace the single value with a stack" é uma instrução mecânica de estrutura de dados, satisfeita integralmente; a ambiguidade de atribuição por página já existia identicamente na versão de chave única, não é regressão nova, e resolvê-la de verdade exigiria chavear a pilha por identidade de página, escopo maior que o pedido); ausência de tratamento de `isPending`/`isError` nas queries de período de origem usadas por "Veio de" (2 revisores convergentes, auto-corrige ao resolver a query, exige decisão de produto pra virar patch); `originPeriod` tipado como `MigrationTarget` permite uma variante `daily` inatingível hoje (hardening preventivo); `writeLineageReturn` empilha sem deduplicar (sem consequência funcional real); `renderPage` (helper de teste) ignora `initialEntry` pro `pathname` real (pré-existente, não tocado por este diff); `WeeklyBoardPage.tsx` tem busca de predecessor própria sem recursão em subtasks (pré-existente, arquivo nunca tocado por esta bundle, o próprio revisor já marcou como fora de escopo).
- Achados descartados como `reject` (ruído/fora de escopo pela autoridade do próprio texto do ledger, não repetidos individualmente): dispatch dos mocks de teste por `call.length` em vez de identidade semântica (fragilidade hipotética, sem cenário de falha atual); mocks roteando chamada própria e de origem pela mesma lookup por valor (colisão só se `originPeriod` apontasse pro mesmo período já carregado, sem call site real); duas queries extras sempre montadas com `enabled: false` + guard recomputado em 3 lugares (overhead desprezível, sem consequência funcional); separação `read`(espia)/`clear`(remove) nunca usada independentemente (API pré-existente a este diff, mudá-la seria refactor não pedido); "Veio de" só resolve contra o ÚNICO período de origem desta navegação, não qualquer período possível (comportamento literal do texto do intent -- "the origin period", singular); `originPeriod` não sobrevive a refresh/URL direta (a spec já define isso como comportamento IGUAL ao de hoje para chegada direta -- não regride nem promete mais que isso).

## Design Notes

Por que `originPeriod` viaja em `location.state` em vez de um campo novo no backend: a página de ORIGEM já sabe sua própria identidade (`loadedWeekStart`/`loadedMonthFirst`) no momento em que decide navegar — não há necessidade de um "ponteiro reverso" no servidor (`Task.migrated_from`, `related_name` já existe no model mas nunca foi exposto pelo serializer) só para reconstruir uma informação que o cliente já possui de graça.

A pilha de retorno (DW-18) resolve exatamente o que o ledger descreve — perda por sobrescrita — mas não tenta resolver "qual página consome qual entrada" quando uma chegada por `focusTaskId` (branch que sempre roda primeiro no efeito de chegada) pula a leitura da pilha sem consumi-la. Essa ambiguidade de atribuição por página já existia igualmente na versão de chave única (nenhuma das duas versões sabe "de quem" é a entrada) e nenhuma review anterior desta área a registrou como bug — fora do texto verbatim do ledger, não é escopo desta bundle.

Reaproveitar `useWeeklyLogQuery`/`useMonthlyLogQuery` para o período de origem tende a ser cache-hit (TanStack Query, mesma `queryKey`, dado buscado há segundos na página anterior) — custo real de rede é o caso raro, não o comum.

## Verification

**Commands:**
- `cd frontend && npx tsc -b --noEmit` -- limpo
- `cd frontend && npm run lint` -- limpo
- `cd frontend && npx vitest run` -- sem regressão nos números atuais + testes novos verdes
- `nvm use 22.15.1 && cd frontend && CI=1 npx playwright test e2e/archive.spec.ts e2e/archive-lineage.spec.ts --retries=0` -- 100% verde (regressão; sem cenário e2e novo nesta bundle)

## Auto Run Result

**Resumo da mudança implementada:** DW-17 -- `ArchiveWeeklyDetailPage.tsx`/`ArchiveMonthlyDetailPage.tsx` agora propagam a identidade do próprio período (`originPeriod: MigrationTarget`) via `location.state` ao navegar por uma seta de linhagem cross-período; a página de destino carrega esse período de origem sob demanda (`useWeeklyLogQuery`/`useMonthlyLogQuery`, o primeiro ganhando `options?: { enabled?: boolean }` para suportar isso) e cai nele quando a busca local por "Veio de" falha. A recursão em subtasks duplicada nas duas páginas foi deduplicada em `findPredecessorTask` (`taskTree.ts`), consumida via o módulo novo `archivePredecessor.ts`. DW-18 -- `archiveLineageReturn.ts` trocou o valor único de `sessionStorage` por uma pilha LIFO (array JSON, mesma chave): `write` empilha, `read` espia o topo, `clear` remove só o topo, JSON inválido/legado é tratado como pilha vazia.

**Arquivos alterados:**
- `frontend/src/features/bujo/taskTree.ts` -- novo `findPredecessorTask` (recursivo em subtasks), primitivo único reusado pelos dois lados da busca (local + origem)
- `frontend/src/pages/archive/archivePredecessor.ts` (novo) -- `findPredecessorInWeeklyLog`/`findPredecessorInMonthlyLog`, deduplicando a lógica antes local a cada página
- `frontend/src/features/bujo/api.ts` -- `useWeeklyLogQuery` ganha `options?: { enabled?: boolean }` (default `true`, mesmo molde de `useMonthlyLogQuery`)
- `frontend/src/pages/archive/ArchiveWeeklyDetailPage.tsx`, `ArchiveMonthlyDetailPage.tsx` -- `originPeriod` no location state; `handleNavigateToSuccessor` grava a própria identidade de período; queries condicionais pro período de origem; `findPredecessor` com fallback (ordem de parâmetros alinhada entre as duas páginas na pass de review)
- `frontend/src/pages/archive/archiveLineageReturn.ts` -- pilha LIFO (array JSON) substituindo o valor único; cabeçalho do módulo atualizado
- `frontend/src/pages/archive/archiveLineageReturn.test.ts` -- teste de sobrescrita reescrito como teste de pilha + testes de pilha vazia e JSON corrompido
- `frontend/src/pages/archive/ArchiveWeeklyDetailPage.test.tsx`, `ArchiveMonthlyDetailPage.test.tsx` -- mocks despachando por parâmetro; novos testes cobrindo toda a matriz de I/O; asserts de `sessionStorage` atualizados pro formato de array
- `frontend/src/features/bujo/api.test.tsx` -- novo teste de `enabled: false` para `useWeeklyLogQuery` (patch da review)

**Review findings:** 2 `patch` aplicados (1 medium, 1 low), 6 `defer` (1 medium, 5 low, registrados em `deferred` no frontmatter), 7 `reject` (todos low). Achado convergente mais relevante (3 revisores independentes): a pilha de retorno não resolve atribuição por página quando a chegada via `focusTaskId` sempre precede a leitura da pilha -- avaliado contra o texto verbatim do ledger ("replace the single value with a stack") e classificado como fora do escopo mecânico pedido, não como regressão (a ambiguidade já existia identicamente na versão de chave única). Ver `## Review Triage Log` para o detalhamento completo.

**Recomendação de review de acompanhamento:** `false` -- score = 3×1 (medium) + 1×1 (low) = 4 (< 5); nenhum patch de severidade `high`. Contagem de patches por severidade: high 0, medium 1, low 1.

**Verificação executada:**
- `cd frontend && npx tsc -b --noEmit` -- limpo (um erro pré-existente e não relacionado em `BrainDumpDestinationPicker.tsx`, confirmado presente no baseline antes desta bundle).
- `cd frontend && npm run lint` -- limpo.
- `cd frontend && npx vitest run` -- 1910 passaram / 8 falharam; as 8 falhas (`FuturePage`, `TaskDestinationDialog`, `TaskDetailPanel`, `noLiteralTokens`) são idênticas ao baseline (confirmado via `git stash`), não relacionadas a esta bundle. `npx vitest run src/pages/archive/ src/features/bujo/taskTree src/features/bujo/api` -- 160/160 passaram (escopo direto desta bundle, 100% verde).
- `nvm use 22.15.1 && CI=1 npx playwright test e2e/archive.spec.ts e2e/archive-lineage.spec.ts --retries=0` -- 8/8 passaram.
- Matrix Test Audit: todas as 6 linhas da matriz I/O têm pelo menos um teste cobrindo o comportamento esperado, todos rodaram e passaram (confirmado por nome de teste em ambos os arquivos de página + `archiveLineageReturn.test.ts`).

**Riscos residuais:** nenhum novo além dos já registrados em `deferred` no frontmatter desta spec (6 itens, 1 medium, 5 low). O item de maior severidade (ambiguidade de atribuição por página na pilha de retorno) é uma limitação estrutural pré-existente que este diff não agrava -- fica como referência para quando uma story futura decidir chavear a pilha por identidade de página em vez de ordem de inserção.
