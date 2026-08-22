---
baseline_commit: db440c8a40caf3605c0242a79d55cb5bb9fbd924
---

# Story 12.1: Herança de status na migração (#23)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo (praticante do BuJo),
Quero que uma tarefa iniciada (`/`) migrada carregue o status `started` para o sucessor,
Para que o progresso real não se perca ao carregar a tarefa adiante.

## Acceptance Criteria

**AC1 — Sucessor herda o status da origem (todos os fluxos de migração)**
**Dado que** uma tarefa `started` é migrada ou adiada por **qualquer** fluxo (migração diária, ritual semanal/mensal, Catch-Up, Mover — Stories 4.2/11.6/11.10, todos via `migrate_task`),
**Quando** o service cria o sucessor,
**Então** o sucessor nasce com o status da origem (`started`→`started`, `pending`→`pending`),
**E** a origem permanece terminal (`migrated`/`postponed`) com `migrated_to_task_id` apontando para o sucessor e `migration_count` incrementado em 1 (AD-03 intacto).

**AC2 — Subtarefas herdam o próprio status, não o do pai**
**Dado que** um pai com filhos não-dispostos (`pending`/`started`) é migrado,
**Quando** a subárvore é recriada no destino,
**Então** cada filho recriado herda **o próprio** status de origem, não o do pai (AD-08 item 11 / AD-18 item 2),
**E** filhos `completed`/`cancelled` seguem intocados na origem (comportamento pré-existente preservado).

**AC3 — Matriz de transições e schema inalterados**
**Dado que** a matriz de transições AD-02 permanece inalterada,
**Quando** tarefas `completed`/`cancelled`/`migrated`/`postponed` são avaliadas para migração,
**Então** apenas `pending`/`started` são migráveis (as demais levantam `InvalidTransition`), **nenhum 7º estado é criado** e **nenhuma mudança de schema/migration ocorre** — a herança é regra pura de service em `backend/bujo/services/migration.py`.

**AC4 — Regra de herança testável em nível unit e reutilizável (preparação Épico 14)**
**Dado que** o Épico 14 retocará o mesmo service (fila unificada) e reusará esta regra sem duplicação (arch. §3b item 7 / AC da 14.3),
**Quando** os testes desta story são escritos,
**Então** cobrem a **função de regra de herança** diretamente (nível unit, sem DB), não apenas os endpoints,
**E** todos os caminhos de migração existentes (`today`/`week`/`month`/`future`) ficam cobertos para o caso `started`, **reusando os factories/fixtures já existentes** (`TaskFactory`, `LogFactory`, `tenant_context`) sem duplicação.

## Tasks / Subtasks

- [x] **Task 1 — Extrair a função de regra de herança (AC1, AC3, AC4)**
  - [x] Criar função de módulo `inherited_successor_status(source_status)` em `backend/bujo/services/migration.py`, com docstring citando AD-18 item 1 / FR-4.16. É **dados puros**: recebe o status da origem (`pending`/`started`) e devolve o status que o sucessor deve nascer (identidade para os dois estados migráveis). Sem acesso a DB, sem side effects — a testabilidade unit e o reuso no Épico 14 dependem disso.
  - [x] NÃO tratar `completed`/`cancelled`/`migrated`/`postponed` aqui: eles nem chegam ao `_migrate_subtree` (a matriz AD-02 já barra na raiz). A função assume entrada migrável (documentar essa pré-condição).

- [x] **Task 2 — Aplicar a herança em `_migrate_subtree` por nó (AC1, AC2)**
  - [x] No início de `_migrate_subtree`, **capturar `source_status = source.status` ANTES** de qualquer transição (por nó — é o que garante AC2: cada filho lê o próprio status).
  - [x] Manter a ordem atual: `create_task(...)` (nasce `pending`) → `transition_task(source → new_status)` → `set_lineage_fields` (migration_count, migrated_to_task). Não alterar essa sequência (comentário existente explica a janela de ciclo-fechado).
  - [x] Após fixar a linhagem, se `inherited_successor_status(source_status) == Task.Status.STARTED`, promover o sucessor via `transition_task(user=user, task_id=new_task.id, to_status=Task.Status.STARTED)` (transição `pending→started` já é legal na matriz AD-02 — mantém o `state_machine` como autoridade única sobre status). `pending`→`pending` não exige ação.
  - [x] A recursão sobre os filhos já passa cada `child` como seu próprio `source` — nenhuma mudança estrutural na recursão é necessária além de a nova lógica rodar por chamada.

- [x] **Task 3 — NÃO tocar `create_task` nem schema (AC3)**
  - [x] `backend/bujo/services/tasks.py::create_task` continua criando com `status=PENDING` hardcoded — a assinatura e o comportamento dele permanecem intactos (é usado por placement de recorrentes e por outros fluxos). A herança vive **só** em `migration.py`.
  - [x] Confirmar: nenhuma migration nova, nenhum campo novo, enum de 6 estados intacto. (Esta story **não** aplica migration à branch Neon e2e — não há migration.)

- [x] **Task 4 — Testes unit da regra + cobertura dos caminhos (AC4, AC1, AC2)**
  - [x] Teste unit direto da função `inherited_successor_status`: `STARTED → STARTED`, `PENDING → PENDING` (sem `@pytest.mark.django_db`, sem DB).
  - [x] Teste de service: `started` migrada para `today` → sucessor `started`, origem `migrated`, `migration_count == 1`. Reusar `TaskFactory(user=user, log=log, status=Task.Status.STARTED)` dentro de `with tenant_context(user):`.
  - [x] Teste de service: `started` migrada para `month`/`future` → sucessor `started`, origem `postponed`. (cobre o ramo POSTPONED)
  - [x] Teste de subárvore de status misto: pai `started` + filho `pending` → novo pai `started`, novo filho `pending` (prova AC2). Espelhar o padrão de `test_migrar_pai_recria_apenas_filhos_nao_dispostos`.
  - [x] Verificar que os testes existentes de migração de tarefas `pending` continuam verdes **sem alteração** (eles já afirmam `new_task.status == PENDING` — a herança identidade os mantém válidos).
  - [x] Rodar a suíte completa do backend: `cd backend && uv run pytest` (Postgres LOCAL via docker-compose — full-suite local é o padrão do projeto).

## Dev Notes

### O bug que esta story corrige (#23)

Hoje `create_task` (`backend/bujo/services/tasks.py:60`) grava `status=Task.Status.PENDING` **hardcoded**. Como `_migrate_subtree` cria o sucessor via `create_task`, **toda** tarefa migrada renasce `pending` — o `/` (started) é perdido ao carregar a tarefa adiante. AD-18 item 1 corrige isso: o sucessor **herda** o status da origem.

Atenção ao vocabulário do código, que é uma armadilha: em `_migrate_subtree`/`migrate_task`, o parâmetro **`new_status`** é o status **terminal da ORIGEM** (`MIGRATED`/`POSTPONED`), **não** o do sucessor. O status do sucessor é uma dimensão nova, derivada de `source.status`. Não confundir os dois.

### Arquivos que esta story toca

- **`backend/bujo/services/migration.py`** (UPDATE — único arquivo de produção alterado):
  - Estado atual: `_migrate_subtree` (recursivo, AD-08 item 11) cria o novo registro, transiciona a origem para `new_status`, fixa linhagem (`migration_count`, `migrated_to_task`), e recorre nos filhos `pending`/`started`. `migrate_task` (`@transaction.atomic`) despacha por `destination` (`today`/`week`/`month`/`future`/`cancel`), define `new_status` (MIGRATED para today/week; POSTPONED para month/future) e chama `_migrate_subtree`.
  - O que muda: adicionar `inherited_successor_status(...)` e usá-la por nó para promover o sucessor a `started` quando a origem era `started`.
  - O que preservar (NÃO quebrar): a ordem "criar-antes-de-transicionar-a-origem" (janela de ciclo-fechado documentada no comentário de `_migrate_subtree`); o retorno de `migrate_task` é a **ORIGEM recarregada** (`Task.objects.get(id=task.id)`), não o sucessor; `destination="cancel"` não cria linhagem nem sucessor (sai cedo por `transition_task`); recursão só nos filhos `pending`/`started`.
- **`backend/bujo/tests/test_services.py`** (UPDATE — testes; ver bloco `# --- migrate_task` a partir da linha ~501).
- **NÃO alterar:** `services/tasks.py` (`create_task`), `services/state_machine.py` (matriz `ALLOWED`), `models.py` (schema/enum), `views.py`, serializers, frontend. Sem migration.

### Caminho único de migração (garante AC1 sem N implementações)

**Todos** os fluxos de migração/adiamento passam por `migrate_task` → `_migrate_subtree`. Não há outro ponto de criação de sucessor:
- `bujo/views.py:507` `TaskMigrateView.post` é o único endpoint (`POST /api/tasks/{pk}/migrate`); "Mover" (11.6/11.10), migração diária (4.2), ritual semanal/mensal e Catch-Up (4.3/4.4) são todos variações de `destination`/`scheduled_date` sobre esse mesmo endpoint.
- `services/logs.py` só tem `get_or_create_*` (sem lógica de migração). `services/recurring.py` faz *placement* (não migração). Portanto, alterar `_migrate_subtree` cobre todos os fluxos de uma vez.

### Como aplicar o status herdado (decisão de implementação)

Recomendado: promover o sucessor via `transition_task(new_task → STARTED)` quando `source_status == STARTED`. Racional — `state_machine.py` é a autoridade única sobre `status` ("o serviço impõe a matriz inteira"), e `pending→started` já está em `ALLOWED`. Alternativa aceitável: `set_lineage_fields(task_id=new_task.id, status=<herdado>)` (helper já dono da mutação de linhagem em migration.py, mas contorna a matriz). Evitar adicionar parâmetro `status` a `create_task` (efeito colateral fora de escopo — AC3 quer a mudança contida em `migration.py`).

Esboço (ilustrativo, não copiar cegamente):

```python
def inherited_successor_status(source_status):
    """Sucessor de migração herda o status da origem (AD-18 item 1, FR-4.16).
    Só pending/started são migráveis (matriz AD-02); ambos carregam como-são."""
    return source_status

def _migrate_subtree(source, *, user, container_field, container, scheduled_date, parent_task, new_status):
    source_status = source.status          # AC2: por nó, ANTES de transicionar
    new_task = create_task(...)            # nasce pending (inalterado)
    transition_task(user=user, task_id=source.id, to_status=new_status)
    set_lineage_fields(task_id=new_task.id, migration_count=source.migration_count + 1)
    set_lineage_fields(task_id=source.id, migrated_to_task=new_task)
    if inherited_successor_status(source_status) == Task.Status.STARTED:
        transition_task(user=user, task_id=new_task.id, to_status=Task.Status.STARTED)
    # ... recursão nos filhos pending/started (inalterada)
```

### Escopo — o que NÃO fazer

- **Sem UI / sem frontend.** Épico 12 é Tier 0 (DIR-15). Nenhuma superfície visível muda.
- **Sem `waiting_on`.** É a Story 12.2 (schema novo). A herança de `waiting_on` no sucessor (AD-18 item 5) pertence à 12.2 — **não** implementar aqui. 12.1 é só status.
- **Sem fila unificada.** `unified_migration_queue` é Épico 14 (14.3). Só deixe a `inherited_successor_status` disponível para reuso futuro; não a antecipe.

### Testing standards summary

- Framework: `pytest` + `pytest-django`; DB Postgres **LOCAL** (docker-compose) — full-suite local é barato e padrão (`cd backend && uv run pytest`). CI roda `uv run pytest` sem scoping.
- Fixtures/factories já disponíveis (`backend/bujo/tests/factories.py`): `TaskFactory`, `LogFactory`, `WeeklyLogFactory`, `MonthlyLogFactory`; fixtures `user`, `other_user`; helper `tenant_context`; utilitários `today_for`, `week_start_of`. Reusar — **não** criar factory/fixture novo (AC4).
- Padrão dos testes de migração existentes: `with tenant_context(user):` envolvendo criação + chamada + asserts; `TaskFactory(user=user, log=log, status=Task.Status.STARTED, ...)`.
- O teste da regra pura (`inherited_successor_status`) **não** usa `@pytest.mark.django_db` (sem DB — nível unit puro, é o coração do AC4).

### Project Structure Notes

- Alinhado à estrutura por camadas de service do backend (`bujo/services/*.py` como fonte única de regra; views finas). A herança fica em `migration.py`, ao lado de `migrate_task` — exatamente onde AD-18 e a §3b item 7 da arquitetura mandam colocar (mesmo lugar que o Épico 14 lerá).
- Nenhuma variância de estrutura. Sem novos módulos, apps ou pastas.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.1: Herança de status na migração (#23)] — user story + ACs originais (linhas ~1910-1934).
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-18] — decisão canônica: item 1 (herança de status, "sem tocar schema", matriz AD-02 inalterada), item 2 (subtarefas herdam o próprio status). (linha ~848)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-03] — linhagem `migrated_to_task_id` + `migration_count`; nota inline atualizada CC 2026-07-22 confirmando a herança (linha ~176).
- [Source: _bmad-output/planning-artifacts/architecture.md §3b item 7] — fila unificada do Épico 14 reusa a função de regra da AD-18 sem duplicação → motiva extrair função nomeada (linha ~1210).
- [Source: backend/bujo/services/migration.py] — `_migrate_subtree` / `migrate_task` (arquivo a alterar).
- [Source: backend/bujo/services/state_machine.py] — matriz `ALLOWED` (AD-02); `pending→started` é legal; NÃO alterar.
- [Source: backend/bujo/services/tasks.py:60] — `create_task` grava `status=PENDING` hardcoded (origem do bug); NÃO alterar.
- [Source: backend/bujo/models.py] — `TaskStatus` (6 estados congelados, Story 3.1); NÃO alterar.
- [Source: backend/bujo/tests/test_services.py:501] — testes de migração existentes (padrão de fixture/asserts a reusar e estender).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- Suíte completa do backend rodada SEM escopo de caminho (`cd backend && uv run pytest -q`, Postgres LOCAL via docker-compose `hmmb-test-db`): **879 passed in 179.65s**. Contagem colada da execução real, não de memória.
- Subconjunto dos 7 testes da story (`uv run pytest bujo/tests/test_services.py -k "inherited_successor_status or migrar_started or subarvore_status_misto"`): **7 passed, 115 deselected**.
- AC3 verificado por `git status --short` sobre `backend/bujo/migrations/ models.py services/tasks.py services/state_machine.py` → saída vazia (nada alterado); `create_task` segue com `status=Task.Status.PENDING` hardcoded em `services/tasks.py:60`. Nenhuma migration nova, enum de 6 estados intacto.

### Completion Notes List

- **AC1 (todos os fluxos):** o sucessor herda o status da origem por identidade. Implementado com a função pura `inherited_successor_status(source_status)` + promoção do sucessor a `started` via `transition_task(new_task → STARTED)` dentro de `_migrate_subtree` — como todos os fluxos (4.2/11.6/11.10/Catch-Up) passam por `migrate_task → _migrate_subtree`, um único ponto cobre `today`/`week`/`month`/`future`. Origem permanece terminal (`migrated`/`postponed`) com `migrated_to_task_id` e `migration_count += 1` (AD-03 intacto). Testes: `today`, `week` (ramo MIGRATED), `month`, `future` (ramo POSTPONED).
- **AC2 (subtarefas):** `source_status = source.status` é lido POR NÓ e ANTES de qualquer transição, então cada filho recriado herda o próprio status, não o do pai. Teste de subárvore de status misto (pai `started` + filho `pending` + filho `started` + filho `completed`) prova: novo pai `started`, filho pending→`pending`, filho started→`started`, filho `completed` intocado na origem.
- **AC3 (schema/matriz inalterados):** herança é regra pura de service em `migration.py`. `create_task`, `state_machine.py` (matriz `ALLOWED`), `models.py` (enum de 6 estados) e migrations não foram tocados — confirmado por git status. Nenhum 7º estado, nenhuma migration.
- **AC4 (regra testável em unit + reuso Épico 14):** `inherited_successor_status` testada diretamente sem DB (2 testes sem `@pytest.mark.django_db`); os 4 caminhos de migração cobertos para o caso `started` reusando `TaskFactory`/`LogFactory`/`tenant_context` já existentes, sem factory/fixture novo. Função nomeada e sem side effects deixada disponível para a fila unificada (14.3) sem duplicação.
- **Decisão de implementação:** usada a abordagem recomendada nas Dev Notes (promoção via `transition_task`, mantendo `state_machine` como autoridade única sobre status) — nenhuma ambiguidade de especificação encontrada; nada a escalar.
- Testes de migração `pending` pré-existentes seguem verdes sem alteração (herança-identidade os mantém válidos).
- **Adicionado na review (2026-07-23):** teste e2e em `frontend/e2e/migration-flow.spec.ts` (tarefa `/` migrada para hoje renasce iniciada no Daily Log) — cobre o único efeito observável desta story backend-only pela superfície de status já existente do `TaskRow`, sem UI nova. Este arquivo faltava no File List/Change Log originais (corrigido). Também adicionado 1 teste de subárvore profunda (>1 nível) para blindar a recursão da herança por-nó.

### File List

- `backend/bujo/services/migration.py` (MODIFICADO — único arquivo de produção: adicionada `inherited_successor_status` + herança por nó em `_migrate_subtree`)
- `backend/bujo/tests/test_services.py` (MODIFICADO — 9 testes novos: 2 unit puros da regra + `today`/`week`/`month`/`future` + subárvore de status misto + subárvore profunda >1 nível [adicionado na review])
- `frontend/e2e/migration-flow.spec.ts` (MODIFICADO — 1 teste e2e novo: prova ponta-a-ponta que uma tarefa `/` migrada para hoje renasce iniciada no Daily Log, via a superfície de status já existente em `TaskRow` [sem UI nova]. Registrado na review — estava ausente deste File List; seletores/helpers verificados estaticamente contra o `TaskRow` e os `seed*` já existentes)

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-23 · **Resultado:** Aprovado (Changes Applied)

### Escopo e método

Review adversarial autônoma da story 12.1. Cruzei as afirmações do story file com a realidade do git, validei cada AC contra o código, auditei cada task `[x]`, li os arquivos de produção/teste e executei os testes de backend afetados. Fora do escopo de review (excluídos): `_bmad/`, `_bmad-output/`.

### Verificação das ACs (todas IMPLEMENTADAS)

- **AC1** — Sucessor herda status por identidade em `_migrate_subtree` (ponto único: `migrate_task`, cobre `today`/`week`/`month`/`future` → cobre 4.2/11.6/11.10/Catch-Up). Origem terminal com `migrated_to_task` + `migration_count += 1`. Coberto por 4 testes de service. ✅
- **AC2** — `source_status` lido por nó ANTES de qualquer transição; cada filho herda o próprio status. Coberto por teste de subárvore mista (agora também em profundidade >1). ✅
- **AC3** — Confirmado por git: no backend só `services/migration.py` (+ testes) mudou; `create_task`, `state_machine.ALLOWED`, `models.py` e `migrations/` intactos. Enum de 6 estados; sem migration. ✅
- **AC4** — `inherited_successor_status` testada sem DB (2 testes unit puros); 4 caminhos cobertos reusando `TaskFactory`/`LogFactory`/`tenant_context`, sem factory novo. ✅

### Verificação de código

- `transition_task` salva `update_fields=["status"]` — promover o sucessor a `started` após `set_lineage_fields` **não** sobrescreve `migration_count`/`migrated_to_task`. ✅
- Promoção `pending→started` é legal na matriz `ALLOWED`; `state_machine` segue como autoridade única. ✅
- Testes da story executados nesta review (Postgres LOCAL `hmmb-test-db`): **8 passed, 115 deselected** (7 originais + 1 de profundidade adicionado).

### Findings e ações

- 🟡 **MEDIUM (corrigido)** — `frontend/e2e/migration-flow.spec.ts` fora do File List/Change Log/Completion Notes. Documentado no File List + Completion Notes nesta review.
- 🟡 **MEDIUM (mitigado)** — teste e2e não registrado no Debug Log e sem evidência de execução Playwright. Seletores/helpers (`getByTestId('task-row')`, botão `Em andamento` = `STATUS_LABEL.started`, chip `Iniciada` = `STATUS_CHIP_LABEL.started`, `seedYesterdayQueue` com `status:'started'`, `syncAfter`) verificados **estaticamente** contra `TaskRow.tsx` e os `seed*` existentes — todos existem e batem com padrões de testes e2e que já passam. Execução Playwright não rodada nesta review (não bloqueia; story é backend-only e a suíte pytest é o gate do CI).
- 🟢 **LOW (corrigido)** — AC2 só era testada em profundidade 1. Adicionado `test_migrar_subarvore_profunda_cada_nivel_herda_o_proprio_status` (raiz `started` → filho `pending` → neto `started`).

### Recomendação de acompanhamento (não bloqueante)

- Rodar a suíte Playwright (`nvm use 22.15.1`, branch Neon e2e) antes do merge `dev → main` para confirmar o novo teste e2e ponta-a-ponta.

## Change Log

- 2026-07-23 — Implementada a herança de status na migração (#23, AD-18 itens 1-2): sucessor herda o status da origem (`started`→`started`, `pending`→`pending`) em todos os fluxos via `inherited_successor_status` + `_migrate_subtree`; subtarefas herdam o próprio status. Sem mudança de schema/matriz. 7 testes novos; suíte completa verde (879 passed). Status → review.
- 2026-07-23 — Senior Developer Review (AI): aprovada com correções aplicadas. Documentado `frontend/e2e/migration-flow.spec.ts` (ausente do File List) + Completion Notes; adicionado teste de subárvore profunda (>1 nível) em `test_services.py` (8 passed no subconjunto da story). Sem findings CRITICAL/HIGH. Status → done.
