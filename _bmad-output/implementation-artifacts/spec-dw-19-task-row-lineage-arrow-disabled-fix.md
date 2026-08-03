---
title: 'Seta de linhagem em TaskRowBase: clique morto quando sucessor está indisponível (DW-19)'
type: 'bugfix'
created: '2026-08-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      `successorAvailable` (useEffect com deps `[status, migratedToTask]`) nunca revalida contra
      mutações do DOM depois do mount; se o sucessor entrar no DOM depois desse efeito já ter
      rodado, a nova guarda de DW-19 bloqueia uma navegação que a query ao vivo anterior
      encontrava por acidente.
    evidence: |-
      Achado independente por dois revisores (adversarial e edge-case-hunter) da review do DW-19.
      `successorReachable = successorAvailable || canNavigateCrossPeriod` é recomputado só quando
      o efeito roda; `handleLineageClick` agora usa esse valor como guarda em vez da query ao vivo
      que fazia antes — troca um "self-heal" acidental por uma falha determinística nessa janela.
      Corrigir exigiria reescrever o efeito de disponibilidade, fora do escopo do DW-19 (spec
      Boundaries: "Never: reescrever ... o efeito de disponibilidade").
    location: >-
      frontend/src/features/bujo/components/TaskRowBase.tsx:186-192,240-246
    severity: medium
  - summary: >-
      Para os 4 boards nomeados no DW-19 (Weekly/Monthly/Future/Migration) o clique na seta já era
      um no-op antes da correção e continua um no-op depois — nenhuma mudança perceptível para o
      usuário mouse/touch; a alternativa `disabled` nativo (também citada no ticket) teria produzido
      esse efeito tátil, mas foi descartada para preservar o foco por teclado (AT/AC7).
    evidence: |-
      Achado pela auditoria de alinhamento de intenção da review do DW-19: rastreando o fluxo antes
      e depois do fix para o cenário nomeado no ticket (successor fora do período carregado, sem
      `onNavigateToSuccessor`), os dois produzem exatamente nenhum efeito observável — o "clique
      morto" descrito no ticket não muda de aparência para o usuário final nesses boards. O ticket
      autoriza ambas as alternativas ("real disabled attribute or an early-return guard"), então
      isto não é um gap de intenção, mas um possível follow-up de UX se o feedback tátil "parece
      clicável" continuar incomodando usuários reais.
    location: >-
      frontend/src/features/bujo/components/TaskRowBase.tsx:291-322
    severity: medium
baseline_revision: 'a4b8908729792bfdce567fa1039c30b219f6e452'
final_revision: '8e490ebc271cf1d7142d1e1dcae3b41b93ade5d3'
---

<intent-contract>

## Intent

**Problem:** Em `TaskRowBase.tsx`, a seta de linhagem usa só `aria-disabled` (não `disabled` nativo) quando o sucessor está indisponível, e `handleLineageClick` não tem nenhuma guarda que consulte `successorReachable` (a mesma fonte de verdade do `aria-disabled`/cursor) antes de agir — o botão continua um `<button>` real, clicável por mouse/touch, e o "nada acontece" de hoje é um acidente das branches internas (`querySelector` não encontra nó + callback ausente), não uma invariante expressa em código. Isso é um clique morto silencioso em todo consumidor que não passa `onNavigateToSuccessor` (Weekly, Monthly, Future, Migration) e uma divergência real entre o que a UI anuncia (indisponível) e o que o handler realmente consulta (uma query ao vivo no DOM, independente do estado).

**Approach:** Adicionar uma guarda explícita de early-return no topo de `handleLineageClick` que checa `successorReachable` — a mesma variável que já governa `aria-disabled` e o `cursor` — antes de qualquer `querySelector`/navegação/callback. Não trocar `aria-disabled` por `disabled` nativo: os comentários do arquivo (linhas 141-157) e os testes de teclado (AC7) documentam que o foco deve permanecer alcançável mesmo quando indisponível, para que o `aria-label` explicativo ("O sucessor está em outro período") seja descobrível por teclado/leitor de tela.

## Boundaries & Constraints

**Always:** preservar `aria-disabled` (nunca introduzir `disabled` nativo no botão da seta) — foco por teclado deve continuar alcançável no estado indisponível; preservar todos os `aria-label`/ícones/strings atuais; a guarda deve usar exatamente `successorReachable`, a mesma variável que já decide `aria-disabled`/`cursor` (nada de recomputar `successorAvailable`/`canNavigateCrossPeriod` de outra forma).

**Block If:** nenhuma decisão de produto pendente identificada — o escopo e a fonte de verdade (`successorReachable`) já estão resolvidos pelo ticket.

**Never:** reescrever `successorAvailable`/`canNavigateCrossPeriod`/o efeito de disponibilidade; tocar estilo (`cursor`, `opacity`) da seta; alterar o comportamento para os consumidores que já passam `onNavigateToSuccessor` (Archive) quando `successorReachable` é `true`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clique com sucessor fora do DOM, sem `onNavigateToSuccessor` (Weekly/Monthly/Future/Migration) | `successorReachable=false` | clique não dispara `scrollIntoView`/highlight/`focus`, nem chama callback | No error expected |
| Clique com `onNavigateToSuccessor` passado mas `migrationTarget` nulo | `successorReachable=false` | early-return antes do `querySelector`; callback nunca chamado | No error expected |
| Nó com o mesmo `data-task-id` de `migratedToTask` aparece no DOM fora do ciclo do efeito de disponibilidade (`successorAvailable` continua `false`) | `successorReachable=false` mas `querySelector` acharia um nó | guarda bloqueia ANTES do `querySelector` — o nó nunca é focado/scrollado, a UI (aria-disabled=true) nunca diverge do comportamento real | No error expected |
| Clique com sucessor no DOM | `successorReachable=true` | comportamento atual preservado: scroll, highlight, foco no sucessor | No error expected |
| Clique com `onNavigateToSuccessor` + `migrationTarget` resolvidos, sucessor fora do DOM | `successorReachable=true` | callback chamado com `(successorTaskId, originTaskId, migrationTarget)` | No error expected |

</intent-contract>

## Code Map

- `frontend/src/features/bujo/components/TaskRowBase.tsx` (L237-256) -- `successorReachable` já calculado em L238; `handleLineageClick` (L240-256) precisa da guarda `if (!task.migratedToTask || !successorReachable) return` como primeira linha, antes do `querySelector`.
- `frontend/src/features/bujo/components/TaskRowBase.tsx` (L291-322) -- botão da seta (`aria-disabled={!successorReachable}`) permanece intocado; a guarda é só no handler.
- `frontend/src/features/bujo/components/TaskRowBase.test.tsx` (L249-421, L479-607) -- suítes existentes de linhagem (`migrated`/`postponed`, `onNavigateToSuccessor`, teclado AC7) já cobrem `successorReachable` true/false em todos os consumidores relevantes; nenhuma precisa mudar — servem de regressão de que a guarda não altera comportamento observável nos casos já cobertos.
- Consumidores confirmados sem `onNavigateToSuccessor` (via grep): `WeeklyTaskPanel.tsx`, `MonthlyDayCell.tsx`, `FutureBoardPage.tsx` e o board de Migração (via `ItemRowBase.tsx`) — só `ArchiveWeeklyDetailPage.tsx`/`ArchiveMonthlyDetailPage.tsx` passam a prop.

## Tasks & Acceptance

**Execution:**
- `frontend/src/features/bujo/components/TaskRowBase.tsx` -- adicionar `if (!task.migratedToTask || !successorReachable) return` como primeira linha de `handleLineageClick` -- fecha a lacuna apontada pelo DW-19: a partir de agora o handler consulta a MESMA fonte de verdade que já governa a aparência (`aria-disabled`/`cursor`), em vez de depender de uma coincidência entre branches internas.
- `frontend/src/features/bujo/components/TaskRowBase.test.tsx` -- adicionar um teste que injeta um nó com `data-task-id` coincidente FORA do ciclo de render (simulando divergência entre `successorAvailable` e o DOM ao vivo) e prova que o clique na seta indisponível não foca/navega esse nó -- é o único cenário do I/O Matrix que expõe a diferença de comportamento entre o código atual (acidentalmente seguro só porque nenhum nó coincidente existe hoje) e o código corrigido (seguro por construção).

**Acceptance Criteria:**
- Dado `successorReachable=false` (sem sucessor no DOM e sem `onNavigateToSuccessor`/`migrationTarget` resolvidos), quando a seta de linhagem é clicada ou ativada por teclado (Enter/Space), então nenhum `scrollIntoView`, evento de destaque ou `focus` é disparado, e nenhum callback é chamado.
- Dado um elemento com o mesmo `data-task-id` de `task.migratedToTask` presente no DOM mas `successorReachable=false` (estado não sincronizado com esse nó), quando a seta é clicada, então esse elemento não recebe foco nem é rolado até a view — a guarda impede a consulta ao DOM antes de qualquer ação.
- Dado `successorReachable=true` (sucessor no DOM, ou `onNavigateToSuccessor`+`migrationTarget` resolvidos), quando a seta é clicada ou ativada por teclado, então o comportamento atual (navegação local ou callback cross-período) é preservado sem alteração.

## Spec Change Log

## Review Triage Log

### 2026-08-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 0, medium 0, low 4)
- defer: 2 (high 0, medium 2, low 0)
- reject: 4 (high 0, medium 0, low 4)
- addressed_findings:
  - `[low]` `[patch]` Comentário novo em `handleLineageClick` citava números de linha absolutos (L296/L312) que já nascem desatualizados (offset do próprio diff) — reescrito para referenciar os atributos por nome, sem linhas fixas.
  - `[low]` `[patch]` Comentário da guarda só explicava a condição nova (`!successorReachable`), deixando a pré-existente (`!task.migratedToTask`) sem contexto — reescrito para cobrir as duas.
  - `[low]` `[patch]` Teste novo (`DW-19`) fazia `document.body.removeChild(fantasma)` só ao final, sem `try/finally` — um assert reprovado acima vazaria o nó fantasma para os testes seguintes do arquivo. Envolvido em `try/finally`.
  - `[low]` `[patch]` Teste novo checava só `focus`/`scrollIntoView`, não o terceiro efeito colateral que a guarda também previne (`LINEAGE_HIGHLIGHT_EVENT` disparado no nó fantasma) — assert adicionado.
  - `[medium]` `[defer]` `successorAvailable` é um snapshot de `useEffect` (deps `[status, migratedToTask]`) que nunca revalida contra mutações do DOM depois do mount. Se o nó sucessor aparecer no DOM DEPOIS desse efeito já ter rodado (sem `status`/`migratedToTask` mudar), a guarda agora bloqueia uma navegação que a query ao vivo anterior "curava" por acidente — troca uma falha silenciosa por uma falha determinística nessa janela de corrida específica. Fora de escopo desta correção (spec proíbe reescrever o efeito de disponibilidade); registrado para atenção futura.
  - `[medium]` `[defer]` Auditoria de alinhamento de intenção: para os 4 boards nomeados no ticket (Weekly/Monthly/Future/Migration), o clique na seta já era um no-op ANTES desta correção (por acidente das branches internas) e continua um no-op DEPOIS (agora por guarda explícita) — nenhuma mudança perceptível para o usuário mouse/touch nesses boards. A guarda satisfaz a alternativa "early-return guard" citada literalmente no texto do DW-19, mas não produz o afeto tátil de "controle genuinamente não-interativo" (sem feedback nativo de `:active`/foco por clique) que a alternativa `disabled` nativo teria dado — essa alternativa foi descartada no planejamento por preservar o foco por teclado (AC7/AT), documentado nos comentários pré-existentes do arquivo. Registrado como possível follow-up de UX, não como gap de intenção (o próprio ticket autoriza as duas alternativas).

## Design Notes

A guarda usa `successorReachable` (não recomputa `successorAvailable`/`canNavigateCrossPeriod` dentro do handler) porque essa é a mesma expressão já usada para `aria-disabled` e `cursor` do botão da seta — garante que "o que a UI anuncia" e "o que o clique faz" nunca mais possam divergir por construção, em vez de coincidirem hoje por acidente.

## Verification

**Commands:**
- `cd frontend && npx vitest run src/features/bujo/components/TaskRowBase.test.tsx` -- expected: todos os testes passam, incluindo o novo teste de regressão do DW-19.
- `cd frontend && npx vitest run src/pages/archive/ArchiveWeeklyDetailPage.test.tsx src/pages/archive/ArchiveMonthlyDetailPage.test.tsx src/pages/planner/FutureBoardPage.test.tsx` -- expected: consumidores de `TaskRowBase` com/sem `onNavigateToSuccessor` seguem passando sem alteração de comportamento.

## Auto Run Result

**Resumo:** `handleLineageClick` (em `TaskRowBase.tsx`) ganhou uma guarda explícita de early-return (`!task.migratedToTask || !successorReachable`) — a mesma variável que já governa `aria-disabled`/`cursor` do botão da seta — fechando a lacuna do DW-19 sem trocar `aria-disabled` por `disabled` nativo (preserva foco por teclado/AT, conforme os comentários pré-existentes do arquivo).

**Arquivos alterados:**
- `frontend/src/features/bujo/components/TaskRowBase.tsx` — guarda nova em `handleLineageClick`, com comentário explicando as duas metades da condição (sem números de linha fixos).
- `frontend/src/features/bujo/components/TaskRowBase.test.tsx` — novo teste de regressão (`DW-19`) provando que um nó com `data-task-id` coincidente, mas fora do ciclo do efeito de disponibilidade, não recebe `focus`/`scrollIntoView`/evento de destaque quando a seta indisponível é clicada; cleanup do nó fantasma em `try/finally`.

**Achados da review (4 revisores em paralelo — adversarial, edge-case, verification-gap, intent-alignment):**
- Patches aplicados: 4 (todos baixa severidade) — comentário com números de linha desatualizados, comentário só explicando metade da guarda, cleanup de teste sem `try/finally`, teste faltando a asserção do evento de destaque. Todos corrigidos pelo subagente de implementação e reverificados.
- Itens deferidos: 2 (média severidade) — (1) `successorAvailable` é um snapshot de `useEffect` que não revalida contra mutações do DOM após o mount; a guarda nova fecha um "self-heal" acidental numa janela de corrida específica (fora de escopo: exigiria reescrever o efeito de disponibilidade). (2) Auditoria de alinhamento de intenção: nos 4 boards nomeados no ticket, o clique já era um no-op antes e continua um no-op depois — a guarda satisfaz a alternativa "early-return guard" citada no próprio ticket, mas não produz o feedback tátil de "genuinamente não-interativo" que `disabled` nativo daria (descartado por preservar foco/AT). Ambos registrados em `deferred` na frontmatter.
- Rejeitados: 4 — teste não usa `rerender` com um segundo `TaskRowBase` real (nitpick de realismo, guarda já provada não-vácua); ledger de deferred-work não atualizado (fora de escopo — orquestrador registra a resolução); asserção `not.toHaveFocus()` redundante com o spy de foco; Code Map do próprio spec cita linhas que já mudaram (drift de documentação, não defeito de código).
- `followup_review_recommended`: `false` (4 patches, todos `low` — score `3×0 + 1×4 = 4` < 5, nenhum `high`).

**Verificação executada:**
- `npx vitest run src/features/bujo/components/TaskRowBase.test.tsx` — 48/48 passaram (após os 4 patches).
- `npx vitest run src/pages/archive/ArchiveWeeklyDetailPage.test.tsx src/pages/archive/ArchiveMonthlyDetailPage.test.tsx src/pages/planner/FutureBoardPage.test.tsx` — 80/80 passaram.
- `tsc --noEmit` e `eslint` nos dois arquivos tocados — limpos.
- Confirmado que o novo teste é não-vácuo: revertendo a guarda temporariamente, o teste falha (`focus` chamado 1x); restaurada a guarda, volta a passar.
- Matrix Test Audit: as 5 linhas do I/O Matrix têm cobertura de teste confirmada rodando e passando.

**Riscos residuais:** os dois itens deferidos acima (janela de corrida em `successorAvailable` e ausência de feedback tátil "genuinamente não-interativo" nos boards nomeados) — nenhum bloqueia esta correção, ambos documentados em `deferred` para atenção futura.
