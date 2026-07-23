# Explicação dos arquivos não commitados — Story 12.1: Herança de status na migração (#23)

## Visão geral

A Story 12.1 corrige o bug #23 (AD-18 itens 1–2): ao **migrar** ou **adiar** uma tarefa
iniciada (`/`, `started`), o sucessor recém-criado passa a **herdar** o status da origem
em vez de renascer sempre `pending`. A causa-raiz é que `_migrate_subtree` cria o sucessor
via `create_task`, que grava `status=PENDING` hardcoded — então o `/` era perdido ao
carregar a tarefa adiante. A correção é uma **regra pura de service** (`migration.py`),
sem mudança de schema, sem migration e sem tocar a matriz de estados (`state_machine.py`)
nem `create_task` (AC3). Épico 12 é **Tier 0 (sem UI nova)**: o efeito observável surge
pela superfície de status já existente em `TaskRow`.

Escopo do conjunto de mudanças: 1 arquivo de produção (`migration.py`), 2 camadas de teste
(pytest de service/unit + 1 E2E Playwright), o arquivo da story, o `sprint-status.yaml`, o
log cumulativo `test-summary.md` e os artefatos internos da orquestração (story-automator).

## Ordem lógica de funcionamento

1. **Artefato de planejamento** — story file (contrato de ACs/tasks) e `sprint-status.yaml` (status → done).
2. **Regra de negócio (produção)** — `backend/bujo/services/migration.py`: nova função pura + herança por nó.
3. **Testes de service/unit** — `backend/bujo/tests/test_services.py`: regra pura + 4 destinos + subárvore + profundidade-2.
4. **Teste ponta-a-ponta** — `frontend/e2e/migration-flow.spec.ts`: efeito observável de AC1 pela UI.
5. **Artefato de testes** — `test-summary.md`: log cumulativo da rodada de automação.
6. **Orquestração** — `_bmad-output/story-automator/*`: estado do story-automator (rastreio da run).

---

## 1. Artefatos de planejamento/status

### `_bmad-output/implementation-artifacts/12-1-heranca-de-status-na-migracao.md`

**Função geral do arquivo** — Story file: contrato de implementação (Story, Acceptance
Criteria, Tasks/Subtasks, Dev Notes com referências de arquivo, Dev Agent Record).

**Função geral da alteração** — Arquivo novo (untracked), criado pelo create-story e
preenchido pelo dev-story/review. Todas as 18 subtasks marcadas `[x]`; `Status: done`;
`baseline_commit` no frontmatter; Dev Agent Record com contagem real de testes
(**879 passed** na suíte backend) e a seção de review (0 CRITICAL/0 HIGH).

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo** — Fonte da verdade de status por story/épico (consumida pelo orquestrador).

**Função geral da alteração** — `epic-12: backlog → in-progress`; `12-1-...: backlog → done`
(passou por create → dev → review). Comentário de `last_updated` atualizado. 6 linhas.

---

## 2. Regra de negócio — backend (produção)

### `backend/bujo/services/migration.py`

**Função geral do arquivo** — Serviço de migração/adiamento de tarefas. `migrate_task`
(entrada `@transaction.atomic`) e `_migrate_subtree` (recursão por nó que recria a subárvore
no destino, fixa a linhagem — `migrated_to_task`, `migration_count` — e transiciona a origem
para o estado terminal `MIGRATED`/`POSTPONED`).

**Função geral da alteração** — Introduz a herança de status do sucessor. +34 linhas, 1 arquivo
de produção único (AC3: nada mais tocado).

**Blocos principais**
- Nova função de módulo `inherited_successor_status(source_status)` (regra **pura**, sem DB/side
  effects): devolve o status com que o sucessor nasce. Identidade para os dois únicos estados
  migráveis (`pending→pending`, `started→started`). Docstring cita AD-18 item 1 / FR-4.16 e a
  pré-condição (entrada sempre migrável — a matriz AD-02 barra os demais na raiz).
- Em `_migrate_subtree`: captura `source_status = source.status` **ANTES** de qualquer transição
  e **por nó** — é o que garante AC2 (cada filho herda o próprio status, não o do pai).
- Após fixar a linhagem: `if inherited_successor_status(source_status) == Task.Status.STARTED:
  transition_task(new_task → STARTED)`. Como `create_task` nasce `pending`, a promoção a
  `started` mantém `state_machine` como **autoridade única** sobre status (`pending→started` é
  legal na matriz AD-02). `pending→pending` é identidade e não exige transição.

**Funções, classes e importações específicas**
- `create_task` (importado de `services/tasks`): inalterado — segue com `PENDING` hardcoded;
  a herança vive só em `migration.py`.
- `transition_task`: aplica a promoção respeitando a matriz de estados.
- `set_lineage_fields`: fixa `migration_count`/`migrated_to_task` (AD-03 intacto).

**Comportamento de libs usadas**
- `@transaction.atomic` (Django) em `migrate_task`: qualquer falha na promoção reverteria a
  criação também — sem sucessor órfão.

---

## 3. Testes de service/unit — backend

### `backend/bujo/tests/test_services.py`

**Função geral do arquivo** — Suíte pytest da camada de service (inclui migração).

**Função geral da alteração** — +191 linhas: 8 testes novos cobrindo AC1–AC4.

**Blocos principais**
- `test_inherited_successor_status_started_carrega_started` / `..._pending_carrega_pending`:
  testes **unit puros** da regra, sem `@pytest.mark.django_db` (AC4 — coração da story; reuso Épico 14).
- 4 testes de service para o caso `started` nos destinos `today`/`week`/`month`/`future` (AC1):
  afirmam sucessor `started`, origem terminal (`migrated`/`postponed`), `migration_count == 1`,
  container correto. Reusam `TaskFactory`/`LogFactory`/`tenant_context` — sem factory/fixture novo.
- Teste de **subárvore de status misto** (pai `started` + filhos `pending`/`started`/`completed`):
  prova AC2 — cada nó herda o próprio status; filho `completed` intocado na origem.
- Teste de **profundidade-2** (adicionado no code-review): fecha a lacuna LOW de a recursão só
  estar coberta em profundidade 1.

**Comportamento de libs usadas**
- `pytest.mark.django_db`: só nos testes que tocam DB; os 2 unit da regra pura rodam sem DB.
- `tenant_context(user)` (helper do projeto): envolve criação + chamada + asserts sob o tenant.

---

## 4. Teste ponta-a-ponta — frontend

### `frontend/e2e/migration-flow.spec.ts`

**Função geral do arquivo** — Specs Playwright do fluxo de migração diária (browser real,
stack `npm run dev` + `runserver` sob `config.settings.e2e`, branch Neon `e2e`).

**Função geral da alteração** — +33 linhas: 1 teste novo para o efeito observável de AC1
(lacuna real — todos os E2E de migração existentes usavam tarefas `pending`).

**Blocos principais**
- Teste `migra tarefa iniciada (/) para hoje; o sucessor nasce iniciado no Daily Log`: seeda uma
  tarefa `started` em ontem, migra via banner → "Iniciar" → atalho "1", e afirma o status herdado
  por **duas** superfícies — `getByRole('button', { name: 'Em andamento' })` e `getByText('Iniciada')`.

**Comportamento de libs usadas**
- `expect` (Playwright): auto-retry até o GET real de `logs/today/` estabilizar — sem sleeps.
- Locators semânticos/acessíveis; sem seletores CSS frágeis. Execução: **6 passed (1.6m)** no
  arquivo completo (5 originais + 1 novo, 0 regressão), Node 22.15.1 via nvm.

---

## 5. Artefato de testes

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Função geral do arquivo** — Log cumulativo (append-only) dos resumos de automação por story.

**Função geral da alteração** — +78 linhas: seção da Story 12.1 (gaps descobertos, cobertura
por AC×camada, contagem real observada, checklist de validação, limites de cobertura por design).

---

## 6. Orquestração (story-automator)

Artefatos internos da run do story-automator para o Epic 12, incluídos no commit por opção do
usuário (rastreabilidade da execução):

- `_bmad-output/story-automator/orchestration-12-20260723-154227.md` — documento de estado
  (tabela de progresso, action log, sessões).
- `_bmad-output/story-automator/agents/agents-orchestration-12-*.md` — plano de agentes por story/task.
- `_bmad-output/story-automator/complexity-orchestration-12-*.json` — matriz de complexidade programática.
- `_bmad-output/story-automator/preflight-12-*.md`, `init-log-*.md`, `policy-snapshots/*.json` — snapshots de preflight/política.

Nenhum destes altera comportamento de produção — são metadados de orquestração.

---

## Nota

Nenhum comportamento de código-fonte foi alterado por este relatório (documentação apenas). A
regra de produção da story vive integralmente em `backend/bujo/services/migration.py`.
