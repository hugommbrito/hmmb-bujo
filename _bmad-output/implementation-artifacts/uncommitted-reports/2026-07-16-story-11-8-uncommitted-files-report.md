# Explicacao dos arquivos nao commitados - Story 11.8 Infos da recorrencia no modal de placement

## Visao geral

O conjunto de mudancas implementa a Story 11.8: fechar o bug remanescente da Story 11.3 em que o modal de placement de tarefas recorrentes (`RecurringPlacementDialog`) nao exibia a **prioridade Eisenhower** do template. O modal ja mostrava titulo, descricao, "Recorrencia: `recurrence_text`" e o calendario de densidade desde a 11.3; a story adiciona uma unica linha condicional "Prioridade: ..." (etiqueta por extenso) quando o template tem uma prioridade real (`ui`/`u`/`i`), respeitando a regra de nulos (`none`/`''`/`null` nao renderizam nada). Como o `RecurringPlacementDialog` e um componente unico compartilhado por Esta Semana (`WeeklyPage`), Este Mes (`MonthlyPage`) e Future Log (`FuturePage`, anuais da 11.4), a correcao vale para as tres superficies de uma vez, sem tocar nenhuma pagina.

A frente e **unica de frontend, arquivo unico de source** (`RecurringPlacementDialog.tsx`). Nao ha mudanca de backend, serializer, view, `urls.py`, `api.ts`, `keys.ts`, contrato (`schema.yaml`/`types.gen.ts`) nem de dependencias. A "categoria" citada no texto do epico foi confirmada como estruturalmente inexistente em `RecurringTaskTemplate` (nem modelo, nem serializer, nem contrato, nem CRUD) e tratada como decisao registrada + questao aberta ao Hugo (AC4), sem trabalho de codigo.

Alem do codigo da story, o commit carrega **um** artefato de rastreamento do story-automator (o state doc `orchestration-11-...md` do run do 2o lote 11.7-11.11). Os artefatos de planejamento maiores (Correct Course, `epics.md`, `architecture.md`, `sprint-status.yaml` da reabertura, agents/complexity/init-log/policy-snapshot) ja foram commitados junto da Story 11.7, entao aqui so aparece o incremento de tracking. Ele e autodocumentado (nao contem runtime) e esta resumido brevemente.

## Ordem logica de funcionamento

1. A **spec da Story 11.8** (`11-8-...md`) e o contrato funcional da mudanca (diagnostico, 4 ACs, tasks, Dev Notes, review) — produzida pela reabertura do Epico 11 ja commitada com a 11.7.
2. O **codigo-fonte** (`RecurringPlacementDialog.tsx`) adiciona o mapa `EISENHOWER_LABEL` local e a linha condicional "Prioridade: ..." no bloco de infos.
3. Os **testes de componente** (`RecurringPlacementDialog.test.tsx`) validam a etiqueta presente (ui/u/i) e ausente (none/''/null) contra o componente real.
4. O **teste E2E** (`recurring-templates.spec.ts`) valida o caminho de integracao real (form MUI -> serializer -> snapshot -> modal) contra o backend, adicionado pelo passo de QA `automate`.
5. Os **registros de execucao** (`test-summary.md`, `sprint-status.yaml`) documentam a conclusao (11.8 -> done).
6. O **artefato do story-automator** (`orchestration-11-...md`) rastreia a passagem da 11.7 para a 11.8 no run.

---

## 1. Especificacao da Story 11.8

### `_bmad-output/implementation-artifacts/11-8-infos-da-recorrencia-no-modal-de-placement.md` (novo)

**Funcao geral do arquivo**

Artefato de story da BMad para a 11.8 — documento de implementacao (nao codigo) que define escopo, ACs, tasks/subtasks, Dev Notes, Dev Agent Record, Senior Developer Review e Change Log. E o contrato funcional consumido pelo dev-story e pela review.

**Funcao geral da alteracao**

Arquivo novo (untracked). Define os 4 ACs e, criticamente, um **Diagnostico** que separa o texto do epico ("descricao, categoria, eisenhower, ...") da realidade do codigo: descricao e `recurrence_text` **ja eram exibidas** (11.3); **categoria nao existe** em `RecurringTaskTemplate`; o gap real e implementavel e **so a etiqueta Eisenhower**. Ancora a solucao no padrao ja duplicado no projeto (`EISENHOWER_LABEL` em `TaskDetailPanel` e `RecurringTemplateManager`) e na regra de nulos ja usada por `TaskRow.eisenhowerChipInfo`.

**Blocos principais**

- Linhas 1-40: metadata (`baseline_commit: d6ddd17`), Status `done`, narrativa "Como Hugo / Quero / Para que" e os 4 ACs — AC1 (etiqueta Eisenhower passa a aparecer), AC2 (sem regressao; vale nas 3 superficies), AC3 (regra de nulos: `none`/`''`/`null` nao renderiza), AC4 (categoria estruturalmente ausente -> decisao registrada + questao aberta).
- Linhas 42-86: tasks/subtasks — Task 1 (mapa `EISENHOWER_LABEL` + linha condicional; nao alterar o resto do bloco), Task 2 (confirmar sem alterar que categoria e ausente e que o dado ja chega inteiro), Task 3 (estender testes de componente mantendo os existentes e o jest-axe), Task 4 (verificacao; Task 4.5 decide **nao** adicionar e2e no dev-story).
- Linhas 88-193: Dev Notes — Diagnostico (tabela pedido-vs-realidade), prova da ausencia de categoria (AC4), decisao de usar texto e nao chip, valores de Eisenhower e a regra de nulos, componente compartilhado -> 3 superficies, "o que NAO fazer", Previous Story Intelligence (11.7), Git/Project Structure, References ancoradas em arquivos e linhas.
- Linhas 195-224: Dev Agent Record — Debug Log (RED 3 failed/10 passed antes; GREEN 13 passed depois; suite completa 484 passed/45 arquivos), Completion Notes por AC, e a **correcao da review** anotando que o passo de QA adicionou um e2e (deviation consciente); File List reconciliada com os 3 arquivos.
- Linhas 226-250: Senior Developer Review — aprovado (0 CRITICAL); 1 MEDIUM corrigido (File List/Completion Notes omitiam o e2e novo vs. git reality).
- Linhas 252-257: Change Log (1.0 dev-story -> 1.1 review, status -> done).

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Nao define simbolos executaveis; especifica o comportamento implementado no codigo abaixo. Contem a **questao aberta ao Hugo** (AC4): dar `category` a templates recorrentes puxaria backend + migracao + contrato + CRUD + snapshot -> story propria (candidata ao 3o lote), registrada em vez de assumir.

---

## 2. Codigo-fonte — o nucleo da mudanca

### `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx`

**Funcao geral do arquivo**

Modal (MUI `Dialog`) de placement de uma tarefa recorrente, construido na Story 11.3. Coleta o valor bruto de data/dia para o encaixe, exibe o bloco de infos da recorrencia (titulo, descricao, "Recorrencia: ...") e um `MonthDensityCalendar` informativo do mes. E uma instancia unica reaproveitada por `WeeklyPage` (`dateFieldType="date"`), `MonthlyPage` (`dateFieldType="day"`) e `FuturePage` (anuais, 11.4) — mexer no componente vale para as tres superficies (AC2). A conversao do valor bruto em `scheduledDate` fica com quem chama `onConfirm`; este componente so coleta e exibe.

**Funcao geral da alteracao**

Adiciona a exibicao da prioridade Eisenhower do template. Duas adicoes cirurgicas, sem tocar em mais nada: (1) um mapa de rotulos `EISENHOWER_LABEL` no topo do modulo; (2) uma linha condicional "Prioridade: ..." dentro do bloco `{template && (...)}`, logo apos a linha "Recorrencia: ...". Nenhum handler (`handleConfirm`/`handleClose`), hook (`useTaskDensityQuery`), `TextField` de data/dia ou o `MonthDensityCalendar` foi alterado (AC2).

**Blocos principais**

- Linhas 7-15: novo `const EISENHOWER_LABEL: Record<'ui' | 'u' | 'i', string>` com as 3 entradas exibiveis (`ui`->"Urgente + Importante", `u`->"Urgente", `i`->"Importante"). O comentario documenta que `none`/`''`/`null` deliberadamente **nao** entram no mapa (regra de nulos, AC3) e que essa e a 3a copia local do mesmo mapa (espelhando `TaskDetailPanel` e `RecurringTemplateManager`), seguindo a convencao vigente em vez de extrair um modulo compartilhado (scope creep evitado).
- Linhas 60-79: bloco de infos `{template && (...)}` — titulo (`:62-64`), descricao condicional (`:65-69`) e "Recorrencia: `recurrenceText`" (`:70-72`) permanecem **inalterados**.
- Linhas 73-77: **novo** bloco condicional da etiqueta Eisenhower. Guard `template.eisenhower && template.eisenhower in EISENHOWER_LABEL`; quando verdadeiro, renderiza `<Typography>Prioridade: {EISENHOWER_LABEL[template.eisenhower as 'ui' | 'u' | 'i']}</Typography>` no **mesmo estilo tipografico** das linhas vizinhas (`variant="body-sm"`, `color="text.secondary"`, `component="div"`, `sx={{ mt: 0.5 }}`), para nao introduzir visual novo.
- Linhas 81-101: `TextField` de data/dia e `MonthDensityCalendar` — inalterados.
- Linhas 103-108: `DialogActions` com "Cancelar"/"Confirmar" — inalterados.

**Funcoes, classes e importacoes especificas**

- `EISENHOWER_LABEL` (novo, modulo-local): mapa de 3 chaves; unico ponto de traducao codigo->rotulo. O tipo `Record<'ui' | 'u' | 'i', string>` restringe as chaves justamente aos 3 valores exibiveis.
- Guard `template.eisenhower in EISENHOWER_LABEL`: a checagem falsy (`&&`) descarta `''`/`null`/`undefined`; o operador `in` descarta `'none'` (que e truthy mas nao e chave do mapa). Cobre os tres casos "sem prioridade" de uma vez — mesma equivalencia que `TaskRow.eisenhowerChipInfo` (retorna `undefined` para eles) e o filtro `!== 'none'` de `TaskDetailPanel` ja aplicam.
- Cast `as 'ui' | 'u' | 'i'`: seguro **apos** o guard `in` (o TS nao estreita o union `EisenhowerEnum | BlankEnum | NullEnum | null` do campo por conta do `in`, dai o cast). Typecheck limpo.
- `RecurringTaskTemplate` (import de `../types`, inalterado): tipa `template`; seu campo `eisenhower` e `EisenhowerEnum ("ui"|"u"|"i"|"none") | BlankEnum ("") | NullEnum | null`. **Nao** possui `category` (prova da AC4).
- `useTaskDensityQuery` / `MonthDensityCalendar` / `onConfirm` / `onClose`: intocados — a story nao mexe na coleta, na densidade nem na fiacao de dados (o template ja chega inteiro via `onPlace(template)`).

**Comportamento de libs usadas**

- MUI `Typography` `variant="body-sm"`: renderiza a linha de prioridade como texto secundario, coerente com a pilha descritiva ja existente (nao um chip). Reusa o `Typography` ja importado (`:2`) — zero import novo, zero nova violacao de ESLint boundary.
- Operador TS/JS `in`: testa presenca de chave no objeto (nao valor); e o mecanismo escolhido para excluir `'none'` sem listar cada nao-chave.

---

## 3. Testes

### `frontend/src/features/bujo/components/RecurringPlacementDialog.test.tsx`

**Funcao geral do arquivo**

Testes de componente do `RecurringPlacementDialog` (Vitest + Testing Library + jest-axe), com `useTaskDensityQuery` mockado e o componente real renderizado. E a fonte de verdade da renderizacao do modal.

**Funcao geral da alteracao**

Adiciona 6 casos novos cobrindo a etiqueta Eisenhower, sem tocar nos testes pre-existentes nem no default da fixture (`TEMPLATE.eisenhower = null`, mantendo verdes os testes de coleta e o jest-axe). O `describe` continua rotulado `(AC2)` (nao foi renomeado, diferente da 11.7).

**Blocos principais**

- Linhas 17-25: fixture `TEMPLATE` inalterada — `eisenhower: null` por padrao (proposital: o teste "exibe titulo, descricao e recorrencia" e o jest-axe nao devem ver a linha nova).
- Linhas 106-116: `it.each` de AC1 — para `['ui','Urgente + Importante']`, `['u','Urgente']`, `['i','Importante']`, renderiza `template={{ ...TEMPLATE, eisenhower }}` e assere `screen.getByText('Prioridade: ' + label)` presente. Prova que os 3 valores reais viram etiqueta por extenso.
- Linhas 118-128: `it.each` de AC3 — para `null` (default), `'none'` e `''` (blank), assere `screen.queryByText(/Prioridade:/)` **ausente**. Prova a regra de nulos para os tres casos.
- Linhas 130-135: teste jest-axe pre-existente — inalterado; roda `axe(document.body)` porque o conteudo do `Dialog` do MUI e portalado para fora do container de render.

**Funcoes, classes e importacoes especificas**

- `renderDialog(props)`: helper que faz merge de defaults com overrides e renderiza sob `ThemeProvider`; usado pelos casos novos para injetar `eisenhower`.
- `it.each([...] as const)`: parametriza os casos; o `as const` preserva os literais para o TS aceitar `eisenhower` como membro do union.
- `screen.getByText(exato)` vs `screen.queryByText(/regex/)`: `getByText` afirma presenca (falha se ausente); `queryByText` com regex `/Prioridade:/` afirma ausencia via `.not.toBeInTheDocument()` sem lancar.

**Comportamento de libs usadas**

- Testing Library `getByText`/`queryByText`: leem o texto renderizado real do Dialog portalado.
- jest-axe `axe(document.body)`: roda contra o componente real (nunca mockado) — lição recorrente 3.3->11.7, preservada.

### `frontend/e2e/recurring-templates.spec.ts`

**Funcao geral do arquivo**

Spec Playwright E2E dos templates recorrentes contra backend real (branch Neon `e2e`, Story 11.1). Ja cobria (AC2/AC3 da 11.3) que o modal do Weekly/Monthly mostra titulo/descricao/recorrencia + calendario.

**Funcao geral da alteracao**

Adiciona **1 teste novo** ao final do arquivo (linhas 296-374, +77 linhas), cobrindo a Story 11.8 ponta-a-ponta. Os testes pre-existentes criam templates **sem** prioridade, entao nunca exercitavam a linha "Prioridade: ...", e o teste de componente monta o modal com fixture **mockada** — este teste fecha o gap do caminho de integracao real (`Select` do form -> serializer -> snapshot de placement -> modal). Adicionado pelo passo de QA `automate` (deviation consciente vs. Task 4.5 do dev-story, que dizia nao adicionar e2e); documentado em `test-summary.md`.

**Blocos principais**

- Linhas 302-311: setup — `test.setTimeout(120_000)`, captura de `console`/`pageerror`, abre a aba "Recorrentes".
- Linhas 312-325: cria via UI **dois** templates weekly — um COM Eisenhower "Urgente + Importante" (abre o `Select` real `getByLabel('Eisenhower').click()` -> `getByRole('option', { name: 'Urgente + Importante' }).click()`, mesmo padrao de `daily-tasks.spec.ts`) e um SEM prioridade (controle da regra de nulos). Confirma a criacao por "Semanal — toda segunda" / "Semanal — toda sexta".
- Linhas 327-350: navega para "Esta Semana", localiza a linha do template critico por texto + `xpath=ancestor::div[1]`, clica "Definir placement" e assere no `dialog`: titulo, "Recorrencia: toda segunda" e **"Prioridade: Urgente + Importante"** (AC1). Fecha por "Cancelar".
- Linhas 352-370: repete para o template neutro e assere que `getByText(/Prioridade:/)` tem `toHaveCount(0)` (AC3 — nada de "Prioridade: Nenhum"), mantendo titulo/recorrencia.
- Linha 372: `expect(consoleErrors).toEqual([])` — zero erros de console.

**Funcoes, classes e importacoes especificas**

- `page.getByText(..., { exact: true }).locator('xpath=ancestor::div[1]')`: escopa o botao "Definir placement" a linha correta (ha dois na secao).
- `getByRole('dialog')` + `expect(...).toHaveCount(0)`: afirma presenca/ausencia do conteudo e o fechamento do modal.
- `getByRole('option', { name: 'Urgente + Importante' })`: seleciona a prioridade real no `Select` do form de criacao — garante que `eisenhower` vem do backend, nao de fixture.

**Comportamento de libs usadas**

- Playwright locators acessiveis (`getByRole`/`getByLabel`/`getByText`) e `toBeVisible`/`toHaveCount` com timeouts de config (sem sleeps artificiais).
- Rodado `--workers=1` por cold-start da branch Neon `e2e` (lição recorrente 11.2->11.7).

---

## 4. Registro de execucao e status

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico de resumos de validacao automatizada (QA).

**Funcao geral da alteracao**

Anexa o resumo da Story 11.8 (linhas 1717 em diante, +78 linhas). Registra que a story chegou em `review` com o gap de componente **ja fechado** pelo dev-story e que a rodada de QA (`automate`) encontrou e auto-aplicou **um** gap de cobertura E2E.

**Blocos principais**

- Contexto: componente ja coberto (`it.each` ui/u/i + null/'none'/'' + jest-axe); QA revisou AC1-AC4 e o checklist do `bmad-qa-generate-e2e-tests`.
- Gap descoberto (tabela): #1 (Medio, AC1/AC3) — o modal so era exercitado E2E com templates sem Eisenhower; a fixture mockada do teste de componente nao prova o caminho `Select` -> serializer -> snapshot -> modal.
- Nota de escopo (deviation consciente): o dev-story (Task 4.5) decidiu nao adicionar e2e; o workflow de QA foi invocado com "auto-apply all discovered gaps" e fechou o caminho de integracao real. Nenhum arquivo de contrato/backend tocado.
- Cobertura por AC (AC1/AC2/AC3 cobertos; AC4 nada a testar — campo inexistente), resultado de execucao (vitest 484 passed/45 arquivos inalterado; Playwright 4 passed no arquivo = 3 pre-existentes + o novo; typecheck/lint verdes) e checklist.
- Proximos passos: registra a questao aberta da AC4 (categoria em templates -> story propria).

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem simbolos; artefato de QA em Markdown.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Rastreamento de status das stories do projeto.

**Funcao geral da alteracao**

Reflete a conclusao da 11.8: `11-8-...: backlog -> done` e atualiza o comentario de `last_updated` para `2026-07-16  # story 11.8 -> done (review); 11.7 done`. O Epico 11 segue `in-progress`; 11.9-11.11 permanecem `backlog`.

**Blocos principais**

- Linha 38: `last_updated` com a nota da conclusao da 11.8.
- Linha 89: `11-8-infos-da-recorrencia-no-modal-de-placement: done`.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem simbolos; estado em YAML consumido pelos workflows de sprint.

---

## 5. Artefato de rastreamento do story-automator

> Artefato autodocumentado de rastreamento do run do orquestrador. Nao contem runtime da aplicacao. Resumido brevemente, conforme escopo.

### `_bmad-output/story-automator/orchestration-11-20260716-015115.md` (modificado)

**Funcao geral do arquivo**

State doc do run do story-automator para o lote 11.7-11.11.

**Funcao geral da alteracao**

Avanca o run da 11.7 para a 11.8: front matter `currentStory: 11.7 -> 11.8`, `lastUpdated` atualizado; na tabela de progresso a 11.7 vira `git-commit: done` / `Status: done` e a 11.8 passa a `create/dev/automate/code-review: done` com `git-commit` pendente (`in-progress`). O Action Log ganha 6 entradas: fechamento da 11.7 (commit `d6ddd17`), inicio da 11.8, review gate PASS, dev-story done (com a OPEN Q de categoria para o wrapup), automate done (recurring-templates 4/4; +1 e2e alem da Task 4.5 por mandato de QA; contrato intacto) e code-review PASSED (1 MEDIUM corrigido, 0 CRITICAL, sprint-status=done).

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem simbolos; rastreamento de execucao consumido apenas pelo proprio story-automator, nao pela aplicacao em runtime.

---

## 6. Relacao produtor-consumidor e validacao cruzada

- `11-8-...md` (spec) **produz** o contrato funcional consumido pelo dev-story para escrever o codigo.
- `RecurringPlacementDialog.tsx` (source) **e consumido** por `RecurringPlacementDialog.test.tsx` (componente) e por `recurring-templates.spec.ts` (E2E), que validam a mesma instancia unica compartilhada por Weekly/Monthly/Future.
- `test-summary.md` e `sprint-status.yaml` **registram** o resultado da validacao (11.8 -> done).
- `orchestration-11-...md` **rastreia** a execucao do run, mas nao e consumido em runtime pela aplicacao.

### Observacao de escopo e risco (ja registrada)

- **Contrato intacto:** o `git diff` nao inclui `schema.yaml`, `frontend/src/api/types.gen.ts`, `api.ts`, `keys.ts` nem `backend/` — nenhuma mudanca de backend/serializer/view/urls. A source e um arquivo unico (`RecurringPlacementDialog.tsx`).
- **Categoria (AC4):** confirmada estruturalmente ausente em `RecurringTaskTemplate`; nao foi adicionada. Fica como **questao aberta ao Hugo** (candidata ao 3o lote), registrada na spec em vez de assumir um campo de backend novo.
- **E2E alem da Task 4.5:** o teste em `recurring-templates.spec.ts` foi adicionado pelo passo `automate` (nao pelo dev-story), como deviation consciente para cobrir o caminho de integracao real; a File List e as Completion Notes da story foram reconciliadas na review (1 finding MEDIUM corrigido).
- **E2E nao reexecutado na review** (validado na etapa `automate`, 4/4 no arquivo); backend intocado -> `pytest` nao reexecutado (baseline 11.7: 360 passed).
