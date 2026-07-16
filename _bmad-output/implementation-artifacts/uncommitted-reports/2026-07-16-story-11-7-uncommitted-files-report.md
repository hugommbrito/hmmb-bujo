# Explicacao dos arquivos nao commitados - Story 11.7 Edicao de tarefa persiste em Esta Semana / Este Mes

## Visao geral

O conjunto de mudancas implementa a Story 11.7: corrigir o bug (herdado da Story 11.5) em que a edicao de uma tarefa em Esta Semana / Este Mes nao persistia. A causa era 100% de fiacao de UI no `TaskDetailPanel` (componente compartilhado por Daily / Semana / Mes): a persistencia acontecia por gatilho implicito (`onBlur` de titulo/descricao, `onChange`-mutate dos `Select` de categoria/eisenhower) e nao havia botao de salvar, entao fechar o Drawer pelo X / Esc / backdrop descartava a edicao. A correcao converte os 4 campos editaveis em rascunho local e adiciona um botao "Salvar" explicito que dispara um unico `PATCH`; fechar passa a descartar sem persistir. Nao ha mudanca de backend, contrato (`schema.yaml`/`types.gen.ts`) nem de dependencias — a frente e unica de frontend.

Alem do codigo da story, o commit carrega os artefatos de planejamento da **reabertura do Epico 11** via Correct Course (2026-07-15): o Epico 11 estava `done` (retro concluida) e foi reaberto para um 2o lote de stories (11.7-11.11), nascidas de bugs/melhorias observados em uso. Esses artefatos sao autodocumentados (planejamento/rastreamento, nao codigo) e estao resumidos aqui de forma mais breve.

## Ordem logica de funcionamento

1. O **Correct Course** (`sprint-change-proposal-2026-07-15.md`) reabre o Epico 11 e propoe as Stories 11.7-11.11.
2. Os artefatos de planejamento (`epics.md`, `architecture.md` AD-16, `docs/futureIdeas.md`) e o `sprint-status.yaml` sao atualizados para refletir a reabertura.
3. O **story-automator** inicia um novo run para o lote 11.7-11.11 (state doc, agents, complexity, init-log, policy snapshot) e marca o run anterior (1o lote) como `COMPLETE`.
4. A **spec da Story 11.7** (`11-7-...md`) e o contrato funcional da mudanca (diagnostico, ACs, tasks, Dev Notes, review).
5. O **codigo-fonte** (`TaskDetailPanel.tsx`) troca o auto-save implicito por rascunho local + botao "Salvar".
6. Os **testes** validam: componente (`TaskDetailPanel.test.tsx`), depois E2E do Daily (`daily-tasks.spec.ts`) e de Semana/Mes (`weekly-monthly-task-crud.spec.ts`).
7. Os **registros de execucao** (`test-summary.md`, `sprint-status.yaml`) documentam a conclusao (11.7 → done).

---

## 1. Planejamento e reabertura do Epico 11 (Correct Course)

> Grupo de artefatos autodocumentados de planejamento/rastreamento. Sao a origem do 2o lote do Epico 11; nao contem runtime. Resumidos brevemente.

### `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-15.md`

**Funcao geral do arquivo**

Proposta de mudanca de sprint (output do workflow `bmad-correct-course`). Documento novo (untracked).

**Funcao geral da alteracao**

Formaliza a reabertura do Epico 11 pos-retro. Registra o gatilho principal (a "Mover" da 11.6 nunca leva a tarefa ao Daily Log de hoje — `LogSerializer` so le o container `log`), o gatilho secundario (logs passados nao-fechados inalcancaveis pela navegacao) e o lote de feedback direto do Hugo (edicao nao persiste, modal de placement sem infos, "Mover" quebrado em Esta Semana, polimento de UI). Seleciona a Opcao 1 (Ajuste Direto: adicionar stories ao epico reaberto) e lista as 5 mudancas de artefato aplicadas.

**Blocos principais**

- Secao 1 (linhas 9-24): resumo do problema e evidencias de codigo (`serializers.py:57-59`, `views.py:245-301`, `api.ts:185-259`).
- Secao 2 (27-35): analise de impacto — epico `done → in-progress`, retro → `optional`, sem impacto de schema/PRD, unico delta de backend previsto e leitura de Daily Log por data (11.11).
- Secao 4 (50-70): tabela das 5 mudancas de artefato e resumo das Stories 11.7-11.11.
- Secao 5 (74-81): handoff — proximo passo `bmad-create-story` da 11.7, depois `bmad-story-automator`.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Nao ha simbolos executaveis nem libs; e Markdown documental.

### `_bmad-output/planning-artifacts/epics.md`

**Funcao geral do arquivo**

Catalogo de epicos e stories do projeto.

**Funcao geral da alteracao**

Estende o Epico 11 com o 2o lote: overview e intro detalhada passam a citar as Stories (7)-(11); adiciona as **Stories 11.7-11.11** completas com ACs Given/When/Then e um bloco introdutorio do 2o lote referenciando o Correct Course e o AD-16.

**Blocos principais**

- Linha 275: overview do Epico 11 ganha o paragrafo do 2o lote.
- Linha 757: lista ordenada por dependencia estendida com → (7) ... (11).
- Linhas 892-1008 (aprox.): bloco do 2o lote + Stories 11.7 (edicao persiste), 11.8 (infos da recorrencia no placement), 11.9 (polimento visual dos cards + grid da semana), 11.10 (seletor Mover/Migrar completo, abas Hoje/Semana/Mes/Futuro), 11.11 (navegar/agir em logs passados nao-fechados).

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem simbolos; especificacao consumida por create-story/dev-story.

### `_bmad-output/planning-artifacts/architecture.md`

**Funcao geral do arquivo**

Registro de decisoes de arquitetura (ADs) do projeto.

**Funcao geral da alteracao**

Adiciona o **AD-16** — "Mover para Hoje" (destino explicito ao Daily Log), balde de semana/mes sem dia no seletor de Mover, botao explicito "Migrar" (so no seletor Mover; `MigrationCard`/UX-DR3 preservado) e navegacao de logs passados nao-fechados. Documenta 4 decisoes; nota "Impacto de schema: nenhum". Relevante para as Stories 11.10 e 11.11 (nao para a 11.7).

**Blocos principais**

- Linhas 761-778 (aprox.): bloco do AD-16 (contexto + 4 decisoes + impacto de schema).

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem simbolos; decisao de arquitetura em prosa.

### `docs/futureIdeas.md`

**Funcao geral do arquivo**

Lista de bugs/ideias/UX mantida pelo proprio Hugo (fonte de origem do Epico 11).

**Funcao geral da alteracao**

Reabre itens antes marcados como concluidos e adiciona secoes novas de "Bugs" e "Melhorias de UX/UI". Notavelmente reabre "Este mes / Esta Semana: deletar/editar tasks — Story 11.5 (Edicao nao esta salvando)" e "Recorrentes: modal ... Story 11.3 (Falta exibir infos)", alem de listar o comportamento desejado do modal de mover (abas Hoje/Semana/Mes/Futuro) e melhorias de card/grid.

**Blocos principais**

- Linhas 17, 19: itens 11.3 e 11.5 revertidos de `[x]` para `[ ]` com a causa anotada.
- Linhas 21-40 (aprox.): novas secoes "Bugs" e "Melhorias de UX/UI".

**Nota de escopo (registrada na review 11.7):** este arquivo sao anotacoes do usuario, fora do output de codigo da story — foi deixado intocado de proposito (nao reverter notas do usuario), apenas incluido no commit.

### `_bmad-output/story-automator/orchestration-11-20260716-015115.md` (novo)

**Funcao geral do arquivo**

State doc do run do story-automator para o lote 11.7-11.11.

**Funcao geral da alteracao**

Arquivo novo. Front matter com `storyRange: [11.7..11.11]`, `status: IN_PROGRESS`, `currentStory: 11.7`, referencias a agents/complexity/policy-snapshot. A tabela de progresso mostra 11.7 com create/dev/automate/code-review `done` e git-commit pendente; 11.8-11.11 `pending`. O Action Log registra os marcos da 11.7 (review gate PASS, dev-story, automate, code-review PASSED com LOW nao-bloqueante de e2e nao re-rodado na review).

### `_bmad-output/story-automator/agents/agents-orchestration-11-20260716-015115.md` (novo)

**Funcao geral do arquivo**

Plano de agentes (qual primary/fallback por task) do run, em JSON embutido em Markdown.

**Funcao geral da alteracao**

Arquivo novo. Mapeia cada story (11.7-11.11) e cada etapa (create/dev/auto/review) ao agente `claude` sem fallback.

### `_bmad-output/story-automator/complexity-orchestration-11-20260716-015115.json` (novo)

**Funcao geral do arquivo**

Scores de complexidade por story, calculados pelo story-automator.

**Funcao geral da alteracao**

Arquivo novo. Classifica 11.7 (score 3, Low), 11.8 (2, Low), 11.9 (3, Low), 11.10 (4, Medium), 11.11 (5, Medium). Os "reasons" sao heuristicos e nem sempre casam com o conteudo real (ex.: "Database schema changes" na 11.10, que o AD-16 afirma nao ter impacto de schema) — sao dados de planejamento, nao verdade de dominio.

### `_bmad-output/story-automator/init-log-20260716-014818.md` (novo)

**Funcao geral do arquivo**

Log de inicializacao do run.

**Funcao geral da alteracao**

Arquivo novo, uma linha: registra que o estado stale do Epico 3 (STOPPED) foi ignorado e que se iniciou um run fresco do lote 2 do Epico 11 (11.7-11.11).

### `_bmad-output/story-automator/policy-snapshots/20260716-015115-79b3b368.json` (novo)

**Funcao geral do arquivo**

Snapshot imutavel da politica de execucao do story-automator no momento do run (hash `79b3b368`).

**Funcao geral da alteracao**

Arquivo novo, gerado. Congela runtime/merge/parser e a config por etapa (assets, skills, checklists — ex.: `bmad-qa-generate-e2e-tests` para a etapa `auto`). Nao precisa inspecao linha a linha; e contrato de configuracao versionado por hash.

### `_bmad-output/story-automator/orchestration-11-20260714-185946.md` (modificado)

**Funcao geral do arquivo**

State doc do run **anterior** (1o lote, 11.1-11.6).

**Funcao geral da alteracao**

Fecha o run do 1o lote: `status: IN_PROGRESS → COMPLETE`, `currentStep → step-04-wrapup`, e 3 entradas finais de log (retro+closure commitados em `8490e8e1`, execucao finalizada, orquestracao COMPLETE 6/6).

**Blocos principais**

- Linhas 3-13: front matter (status/step/timestamp).
- Linhas 131-134: entradas finais do Action Log.

---

## 2. Especificacao da Story 11.7

### `_bmad-output/implementation-artifacts/11-7-edicao-de-tarefa-persiste-em-esta-semana-este-mes.md` (novo)

**Funcao geral do arquivo**

Artefato de story da BMad para a 11.7 — documento de implementacao (nao codigo) que define escopo, ACs, tasks/subtasks, Dev Notes, Dev Agent Record, Senior Developer Review e Change Log. E o contrato funcional consumido pelo dev-story e pela review.

**Funcao geral da alteracao**

Arquivo novo. Define os 3 ACs (AC1 persistir os 4 campos via `PATCH`/`useUpdateTaskMutation`; AC2 caminho explicito de salvar, fechar nao persiste; AC3 sem regressao no Daily, mesmo padrao nas 3 superficies) e o diagnostico de que o gap e so de fiacao de UI. Ancora a solucao no precedente `RecurringTemplateManager.TemplateRow` (rascunho local + botao "Salvar" + guard de obrigatorio + mutate unico).

**Blocos principais**

- Linhas 1-33: metadata (`baseline_commit: 8490e8e`), Status `done`, narrativa e os 3 ACs.
- Linhas 37-99: tasks/subtasks — Task 1 (converter para rascunho local + "Salvar"), Task 2 (confirmar sem alterar api.ts/backend), Task 3 (reescrever testes de componente), Task 4 (testes de pagina + e2e), Task 5 (verificacao).
- Linhas 103-168: Dev Notes — diagnostico, precedente, licao da 11.6 (separar `onSuccess` de `onClose`), "o que NAO fazer", Previous Story Intelligence, Git/Project Structure, References.
- Linhas 170-198: Dev Agent Record (Debug Log com contagens: vitest 478 passed / 45 arquivos, Playwright 6 passed; Completion Notes por AC; File List — inclui a adicao de `daily-tasks.spec.ts` na review).
- Linhas 200-222: Senior Developer Review (aprovado; 2 MEDIO corrigidos — File List omitia `daily-tasks.spec.ts` e contagem 476→478; 1 BAIXO de codigo morto `value={description ?? ''}` → `value={description}`; 1 BAIXO registrado — `futureIdeas.md` fora de escopo).
- Linhas 224-230: Change Log (0.1 create-story → 1.0 dev-story → 1.1 review, status → done).

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Nao define simbolos executaveis; especifica o comportamento implementado no codigo abaixo.

---

## 3. Codigo-fonte — o nucleo da mudanca

### `frontend/src/features/bujo/components/TaskDetailPanel.tsx`

**Funcao geral do arquivo**

Drawer (MUI) compartilhado por Daily / Semana / Mes para editar titulo, descricao, categoria, Eisenhower e subtarefas de uma `Task`, alem de "Mover tarefa" (11.6) e "Excluir/Cancelar" (11.5). E a mesma instancia de componente nas tres superficies (remontado por `key={openTaskId}` nas paginas), o que faz a correcao valer para as tres de uma vez (AC3).

**Funcao geral da alteracao**

Substitui o auto-save implicito (`onBlur` de titulo/descricao; `onChange`-mutate dos `Select`) por **rascunho local dos 4 campos + botao "Salvar"** que dispara um unico `PATCH` com os 4 campos e so fecha o painel no sucesso. Fechar por X/Esc/backdrop passa a apenas fechar, descartando o rascunho (AC2). Sem regressao no Daily porque o componente e o mesmo (AC3).

**Blocos principais**

- Linhas 47-55: rascunho local. `title`/`description` ja eram estado local; a story **adiciona** `category` e `eisenhower` como `useState<TaskCategory | ''>` / `useState<TaskEisenhower | ''>`, inicializados de `task?.category`/`task?.eisenhower`. O comentario explica que `key={openTaskId}` remonta o painel por tarefa, entao o rascunho reinicializa a cada abertura sem `useEffect`.
- Linhas 63-80: `handleSave` — trima o titulo; se vazio, retorna (defesa, alem do botao `disabled`); senao chama `updateTask.mutate` com `{ taskId, title, description || null, eisenhower || null, category || null }` e `{ onSuccess: onClose }`. E um unico PATCH, nao 4 mutacoes.
- Linhas 105-110: `TextField` de Titulo agora so tem `value={title}` + `onChange` → `setTitle`; o `onBlur` que fazia `mutate` e revertia titulo vazio foi removido.
- Linhas 111-118: `TextField` de Descricao — `value={description}` (antes `description ?? ''`, simplificado na review por ser codigo morto) + `onChange` → `setDescription`; `onBlur`-mutate removido.
- Linhas 119-131: `Select` de Categoria — `value={category}` + `onChange` → `setCategory(... as TaskCategory | '')`; sem `mutate`.
- Linhas 132-151: `Select` de Eisenhower — `value={eisenhower}` + `onChange` → `setEisenhower(...)`; sem `mutate`. O item em branco ("Nenhum") e o filtro que exclui `none` do map permanecem inalterados.
- Linhas 175-184: novo bloco do botao **"Salvar"** — `variant="contained"`, `onClick={handleSave}`, `disabled={!title.trim()}`. Fica **fora** do gate `!isSubtask`, entao aparece tambem para subtarefas (editar campos de subtarefa e valido), diferente de "Mover"/"Excluir".
- Linhas 185-200: bloco `!isSubtask` de "Mover tarefa" / "Excluir/Cancelar" — inalterado; permanece imediato (nao depende de "Salvar").

**Funcoes, classes e importacoes especificas**

- `handleSave`: espelha `RecurringTemplateManager.TemplateRow.handleSave`; guard de titulo obrigatorio + `mutate` unico + fechar no sucesso.
- `useUpdateTaskMutation` (import de `../api`, inalterado): faz `PATCH /api/bujo/tasks/{id}/` com patch parcial multi-campo, updater otimista de `todayLog` e invalidacao de `weeklyLog`/`monthlyLog` por prefixo (ja correta desde a 11.5) — nao foi tocada nesta story.
- `TaskCategory` / `TaskEisenhower` (import de `../types`, ja existentes): tipam o rascunho local dos Selects; o `| ''` representa "nenhum" no controle, mapeado para `null` no patch.
- `useDeleteTaskMutation` / `useCreateSubtaskMutation` / `TaskDestinationDialog` / `AddTaskRow`: acoes imediatas nao alteradas.

**Comportamento de libs usadas**

- React `useState`: mantem o rascunho por campo; como o painel e remontado por `key`, o estado inicial reflete a tarefa aberta sem sincronizacao manual.
- MUI `Drawer`: seu `onClose` cobre X (`IconButton` "Fechar"), Esc e clique no backdrop — todos apenas fecham (descartam rascunho), nunca persistem.
- MUI `Select`: emite o valor via `event.target.value`; o codigo faz cast para o enum TS ou `''`.
- MUI `Button` `variant="contained"` + `disabled`: acao primaria desabilitada enquanto o titulo estiver vazio/whitespace.
- TanStack Query `mutate(vars, { onSuccess })`: executa a mutacao e so no sucesso chama `onClose` — separando "sucesso da acao" de "fechar/cancelar" (licao HIGH da 11.6).

---

## 4. Testes

### `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx`

**Funcao geral do arquivo**

Testes de componente do `TaskDetailPanel` (Vitest + Testing Library + jest-axe). E a fonte de verdade do comportamento do painel.

**Funcao geral da alteracao**

Substitui os testes baseados em `onBlur` pelos testes do fluxo explicito de "Salvar" e adiciona cobertura para os campos novos (categoria/eisenhower como rascunho) e para os tres caminhos de fechar. O `describe` passa de `(AC2, AC3)` para `(AC1, AC2, AC3)`.

**Blocos principais**

- Linha 47: titulo do `describe` atualizado para incluir AC1.
- Editar os 4 campos + "Salvar" → um unico `mockUpdateMutate` com o patch combinado `{ taskId, title, description, eisenhower: 'u', category: 'teal' }` e 2o argumento com `onSuccess`; ao invocar `onSuccess()`, `onClose` e chamado (AC1). Comentario documenta que `getByRole('option', { name: 'Urgente' })` casa nome acessivel exato (nao "Urgente + Importante").
- Campos vazios enviados como `null` (limpar descricao; categoria/eisenhower ja comecam vazios) → prova o mapeamento "vazio → null" (AC1).
- Abrir com `category: 'teal'`/`eisenhower: 'u'` ja definidos: os Selects refletem "Teal"/"Urgente" e limpa-los para "Nenhuma"/"Nenhum" envia `null` no "Salvar" (AC1) — prova init do rascunho a partir da tarefa e o caminho reverso.
- Fechar sem salvar por **Fechar** (clique no `aria-label` "Fechar"), por **Esc** (`keyDown Escape`) e por **backdrop** (clique em `.MuiBackdrop-root`) → `mockUpdateMutate` **nao** chamado; `onClose` chamado (AC2). O caso backdrop e novo (adicionado no QA/automate).
- Botao "Salvar" `disabled` com titulo vazio/whitespace e `enabled` com titulo valido (AC2).
- Botao "Salvar" presente para subtarefa (`isSubtask`), enquanto "Mover tarefa"/"Excluir tarefa" ausentes (AC3).

**Funcoes, classes e importacoes especificas**

- `mockUpdateMutate` / mock de `useUpdateTaskMutation`: captura os argumentos do patch e permite disparar `onSuccess` manualmente.
- `baseTask(overrides)`: factory local de `Task`.
- `fireEvent.change` / `fireEvent.mouseDown` + `fireEvent.click` (nas `option`) / `fireEvent.keyDown`: dirigem inputs, Selects MUI e o Esc.
- `renderPanel(task, isSubtask, onClose)`: helper que devolve `{ onClose }` para assercoes.

**Comportamento de libs usadas**

- Testing Library `getByRole('option', { name })` com `name` string: match exato do nome acessivel (a opcao `exact` era do Playwright, corrigido no dev-story).
- `getByLabelText('Categoria'|'Eisenhower')` + `toHaveTextContent`: leem o valor exibido do Select.
- `document.querySelector('.MuiBackdrop-root')`: alcanca o backdrop do MUI Modal para o caso de fechar por backdrop.
- jest-axe (bloco preservado, nao alterado): roda contra o componente real, nunca mockado.

### `frontend/e2e/daily-tasks.spec.ts`

**Funcao geral do arquivo**

Spec Playwright E2E do Daily Log (Story 3.3) contra backend real. Cobre a nao-regressao do Daily exigida pela AC3, ja que o painel e compartilhado.

**Funcao geral da alteracao**

Migra os fluxos de edicao via painel de `.blur()` / `Escape` para clicar em **"Salvar"** (que persiste e fecha no sucesso). Correcao critica descoberta no QA: com o gatilho implicito removido, os testes antigos assertavam persistencia sobre um valor nunca salvo.

**Blocos principais**

- Teste "edita campos no painel de detalhe e adiciona subtarefa aninhada": removidos os `titleInput.blur()` e `descriptionInput.blur()`; a subtarefa e adicionada **antes** de salvar (acao imediata propria); o `keyboard.press('Escape')` de fechamento e trocado por `syncAfter(page, () => panel.getByRole('button', { name: 'Salvar' }).click())` + `expect(panel).not.toBeVisible()`.
- Teste "dados persistem apos recarregar a pagina": a descricao passa a ser persistida via "Salvar" (com `syncAfter`) antes do `page.reload()`, provando persistencia real no backend.

**Funcoes, classes e importacoes especificas**

- `detailPanel(page)` (fixture): localiza o Drawer.
- `syncAfter(page, action)` (fixture): sincroniza com o round-trip HTTP (evita sleeps) ao redor do clique em "Salvar".

**Comportamento de libs usadas**

- Playwright `getByRole('button', { name: 'Salvar' })` / `getByLabel` / `getByText`: locators acessiveis.
- `expect(panel).not.toBeVisible()`: confirma que "Salvar" fechou o painel no sucesso.

### `frontend/e2e/weekly-monthly-task-crud.spec.ts`

**Funcao geral do arquivo**

Spec Playwright E2E do CRUD de Semana/Mes (Story 11.5) contra backend real.

**Funcao geral da alteracao**

No fluxo "edita titulo e eisenhower via painel compartilhado em Semana e Mes (AC2)", troca o `.blur()` do input e o clique em "Fechar" por clicar no botao **"Salvar"**, e reordena os passos (preencher titulo + selecionar eisenhower → "Salvar"). Mantem as assercoes de que o valor editado reaparece na `task-row` apos a invalidacao e de zero erros de console.

**Blocos principais**

- Trecho da Semana (linhas ~98-108): `weeklyPanel.getByLabel('Título').fill(...)` sem `.blur()`; seleciona eisenhower; `weeklyPanel.getByRole('button', { name: 'Salvar' }).click()`; `expect(weeklyPanel).not.toBeVisible()`; valor reaparece na lista.
- Trecho do Mes (linhas ~113-121): `monthlyPanel.getByLabel('Título').fill(...)` + `getByRole('button', { name: 'Salvar' }).click()` no lugar de `.blur()` + "Fechar"; `expect(consoleErrors).toEqual([])`.

**Funcoes, classes e importacoes especificas**

- `detailPanel(page)`: localiza o Drawer por superficie.
- `getByRole('option', { name: 'Urgente', exact: true })`: no Playwright, `exact` e valido (contraste com o teste de componente).

**Comportamento de libs usadas**

- Playwright `page.getByTestId('task-row').filter({ hasText })`: confirma o valor persistido reaparecendo apos invalidacao.

---

## 5. Registro de execucao e status

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico de resumos de validacao automatizada (QA).

**Funcao geral da alteracao**

Anexa o resumo da Story 11.7 (linhas 1634 em diante). Registra que a story chegou em `review` com os testes ja reescritos pelo dev-story e que a rodada de QA (`automate`) encontrou e auto-aplicou 3 gaps.

**Blocos principais**

- Gaps descobertos: #1 (Critico, AC3) — `daily-tasks.spec.ts` ainda usava `onBlur`/`Escape` no painel compartilhado e assertava persistencia sobre valor nunca salvo, passou despercebido porque o Debug Log so re-rodava o spec de Semana/Mes; #2 (Medio, AC2) — fechar por backdrop sem teste; #3 (Medio, AC1) — rascunho de categoria/eisenhower sem teste de init/clear-to-null.
- Testes gerados/estendidos: 2 corrigidos em `daily-tasks.spec.ts` + 2 novos em `TaskDetailPanel.test.tsx`.
- Cobertura por AC, resultado de execucao (vitest 478 passed / 45 arquivos; Playwright 11 passed = 5 Daily + 6 Semana/Mes; typecheck/lint verdes) e checklist.
- Proximo passo / licao: ao alterar componente **compartilhado**, re-rodar a suite E2E inteira, nao so o spec da superficie-alvo (candidato a guardrail).

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem simbolos; artefato de QA em Markdown.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Rastreamento de status das stories do projeto.

**Funcao geral da alteracao**

Reflete a reabertura do Epico 11 e a conclusao da 11.7: `epic-11: done → in-progress` (reaberto via Correct Course), adiciona `11-7...: done` e `11-8..11-11: backlog`, e muda `epic-11-retrospective: done → optional` (1a passada mantida; nova retro cobrira 11.7-11.11). Atualiza o comentario de `last_updated`.

**Blocos principais**

- Linha 38: `last_updated` com nota da reabertura.
- Linhas 81-93 (aprox.): `epic-11: in-progress`, `11-7 → done`, `11-8..11-11 → backlog`, `epic-11-retrospective → optional`.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem simbolos; estado em YAML consumido pelos workflows de sprint.

---

## 6. Relacao produtor-consumidor e validacao cruzada

- `sprint-change-proposal-2026-07-15.md` **produz** a reabertura que se materializa em `epics.md`, `architecture.md` (AD-16) e `sprint-status.yaml`.
- `epics.md` (Story 11.7) **produz** a spec detalhada `11-7-...md`, que **e consumida** pelo dev-story para escrever o codigo.
- `TaskDetailPanel.tsx` (source) **e consumido** por `TaskDetailPanel.test.tsx` (componente) e pelos specs E2E (`daily-tasks.spec.ts`, `weekly-monthly-task-crud.spec.ts`), que validam a mesma instancia compartilhada nas 3 superficies.
- `test-summary.md` e `sprint-status.yaml` **registram** o resultado da validacao (11.7 → done).
- Os artefatos do `story-automator` **rastreiam** a execucao do lote, mas nao sao consumidos em runtime pela aplicacao.

### Observacao de escopo e risco (ja registrada)

- **Contrato intacto:** o `git diff` nao inclui `schema.yaml` nem `frontend/src/api/types.gen.ts` — nenhuma mudanca de backend/serializer/view/urls (diferente da 11.5).
- **`docs/futureIdeas.md`** e nota do usuario, fora do output da story; incluido no commit sem edicao de propria autoria da story.
- **E2E do Daily nao re-executado na review** (LOW nao-bloqueante): a migracao de `daily-tasks.spec.ts` foi validada na etapa `automate` (11/11 na branch Neon `e2e`); a nao-regressao do Daily tambem esta coberta por construcao (mesmo componente) + testes de componente. Recomendado re-rodar antes de fechar o epico.
