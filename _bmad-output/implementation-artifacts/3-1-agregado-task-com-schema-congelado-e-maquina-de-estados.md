---
baseline_commit: 8a76795a7e3434f746dd7e92c9313cc78a438e42
---

# Story 3.1: Agregado `Task` com schema congelado e máquina de estados

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como desenvolvedor do projeto,
Quero o model `Task` completo (incluindo colunas de linhagem e subtarefa) e a máquina de estados formal na camada de serviço,
Para que o agregado seja estável e testado, e o Épico 4 possa apenas consumir/transicionar sem alterar o schema (FR-1.3, FR-1.4, FR-1.5, AR-13, AR-14, AR-15).

## Acceptance Criteria

1. **Model `Task` e Daily Log — schema congelado**
   - **Dado que** o app `bujo/` e o model `Task`,
   - **Quando** ele é definido,
   - **Então** herda `TenantModel` e tem: `log_id` (FK), `status` (`TextChoices` pending/started/completed/cancelled/migrated/postponed + `CheckConstraint`), `eisenhower` (ui/u/i/none, nullable), `order_index` (float), `title`, `description` (nullable), e — **congeladas agora, nuláveis/inertes** — `migrated_to_task_id` (self-FK), `migration_count` (default 0), `parent_task_id` (self-FK), `source_template_id` (nullable),
   - **E** existe o model de Daily Log chaveado por `(user_id, log_date DATE)`, materializado na primeira abertura via método de serviço idempotente.

2. **Máquina de estados (AD-02)**
   - **Dado que** a máquina de estados,
   - **Quando** `bujo/services/state_machine.py` é implementado,
   - **Então** a matriz de transições é imposta no serviço: `pending↔started↔completed` via clique, `cancelled` via menu, `completed` reabre via clique, `cancelled` desfaz via edição; `migrated`/`postponed` são terminais e só atingíveis pelo fluxo de migração (não pelo clique),
   - **E** uma transição ilegal levanta `InvalidTransition` (→ 409), coberta por teste com 100% das transições da matriz.

3. **Regra `/` e `\` formando X (FR-1.5) e isolamento**
   - **Dado que** a regra `/` e `\` formando X,
   - **Quando** uma tarefa cicla,
   - **Então** iniciar marca `started` (`/`) e concluir marca `completed` (X visual),
   - **E** o `user_id` é auto-preenchido e toda query de `Task` é escopada por tenant.

## Tasks / Subtasks

- [x] **Task 1: Criar e registrar o app `bujo/`** (AC: #1)
  - [x] 1.1 Criar `backend/bujo/` com `__init__.py`, `apps.py` (`BujoConfig`, `default_auto_field = "django.db.models.BigAutoField"`, `name = "bujo"` — mesmo padrão de `core/apps.py`/`accounts/apps.py`)
  - [x] 1.2 Adicionar `"bujo"` a `INSTALLED_APPS` em `backend/config/settings/base.py` (seção `# Local`, após `"accounts"`)
  - [x] 1.3 **Nenhuma ação necessária** em `pyproject.toml` — `bujo` já está listado em `[[tool.importlinter.contracts]].forbidden_modules`; o contrato funciona via `include_external_packages = true` mesmo antes do app existir (ver comentário no arquivo). Confirmar apenas que o `import-linter` continua verde após o app ser criado.

- [x] **Task 2: Model `Log` (Daily Log)** (AC: #1)
  - [x] 2.1 Em `bujo/models.py`, criar `class Log(TenantModel)`: campo `log_date = models.DateField()`; `Meta`: `db_table = "logs"`, `constraints = [models.UniqueConstraint(fields=["user_id", "log_date"], name="uniq_log_user_id_log_date")]`
  - [x] 2.2 Gerar migration (`python manage.py makemigrations bujo`)

- [x] **Task 3: Model `Task`** (AC: #1)
  - [x] 3.1 `Task.Status(models.TextChoices)`: `PENDING="pending"`, `STARTED="started"`, `COMPLETED="completed"`, `CANCELLED="cancelled"`, `MIGRATED="migrated"`, `POSTPONED="postponed"`
  - [x] 3.2 `Task.Eisenhower(models.TextChoices)`: `URGENT_IMPORTANT="ui"`, `URGENT="u"`, `IMPORTANT="i"`, `NONE="none"`
  - [x] 3.3 Campos: `log = models.ForeignKey(Log, on_delete=models.CASCADE, related_name="tasks")` (coluna `log_id`); `status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)` (maior valor `"cancelled"`/`"completed"`/`"postponed"` = 9 chars — 16 dá folga); `eisenhower = models.CharField(max_length=8, choices=Eisenhower.choices, null=True, blank=True)` (maior valor `"none"` = 4 chars); `order_index = models.FloatField()`; `title = models.CharField(max_length=500)`; `description = models.TextField(null=True, blank=True)`; `created_at = models.DateTimeField(auto_now_add=True)`; `updated_at = models.DateTimeField(auto_now=True)` (schema completo em AD-03, §3)
  - [x] 3.4 Campos congelados/inertes: `migrated_to_task = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="migrated_from")` (coluna `migrated_to_task_id`); `migration_count = models.PositiveIntegerField(default=0)`; `parent_task = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="subtasks")` (coluna `parent_task_id`); `source_template_id = models.UUIDField(null=True, blank=True)` — **plain `UUIDField`, não FK** (ver Dev Notes: `recurring_task_templates` só existe no Épico 4)
  - [x] 3.5 `Meta`: `db_table = "tasks"`; `ordering = ["order_index"]`; `constraints = [models.CheckConstraint(condition=models.Q(status__in=Task.Status.values), name="task_status_valid")]` — usar `condition=`, não `check=` (Django 5.1 renomeou o kwarg; ver Dev Notes). **Desvio da Reference Implementation**: `Task.Status.values` referenciado de dentro de `Meta` (classe aninhada) levanta `NameError` — uma classe aninhada em Python não enxerga o namespace da classe que a contém, só o módulo. Corrigido movendo `TaskStatus` para o nível do módulo e expondo como `Task.Status = TaskStatus` (mantém `Task.Status.PENDING` funcionando); ver comentário em `bujo/models.py`.
  - [x] 3.6 Gerar migration (mesma rodada de `makemigrations bujo` da Task 2, ou separada — decisão do dev)

- [x] **Task 4: Serviço de materialização idempotente do Daily Log** (AC: #1)
  - [x] 4.1 Criar `bujo/services/__init__.py` (pacote, per §7.1: `services/{state_machine,migration,catchup}.py` — `migration`/`catchup` chegam só no Épico 4)
  - [x] 4.2 Criar `bujo/services/logs.py` com `@transaction.atomic def get_or_create_daily_log(*, user, log_date) -> Log`: usa `Log.objects.get_or_create(log_date=log_date)` (auto-scoping via `TenantManager` + auto-fill de `user_id` via `TenantModel.save()`); recebe `log_date` já resolvido pelo chamador — **não chama `today_for()` nem `date.today()` aqui** (autoridade de "hoje" fica com o chamador, futuro em Story 3.2; padrão idêntico a `seed_habit_day(*, user, date)` do AD-06)

- [x] **Task 5: Máquina de estados** (AC: #2, #3)
  - [x] 5.1 Criar `bujo/services/state_machine.py` com o dicionário `ALLOWED` (matriz completa AD-02, 6 estados) e `@transaction.atomic def transition_task(*, user, task_id, to_status) -> Task` seguindo literalmente a Reference Implementation de §6.10: busca via `Task.objects.get(id=task_id)` (auto-escopado), valida `to_status in ALLOWED[task.status]`, senão `raise InvalidTransition(task.status, to_status)`, salva só o campo `status`
  - [x] 5.2 `ALLOWED` deve cobrir exatamente a matriz da AD-02 (ver Dev Notes para a tabela completa) — nenhuma transição fora da tabela deve ser alcançável, incluindo auto-transições (`pending→pending`, etc.)

- [x] **Task 6: Testes** (AC: #1, #2, #3)
  - [x] 6.1 `bujo/tests/factories.py`: `LogFactory` e `TaskFactory` (`factory_boy`) seguindo o padrão `class Params: user = factory.SubFactory(UserFactory)` + `user_id = factory.SelfAttribute("user.id")` (ver Dev Notes — `user_id` não é FK, então `user` não pode ser kwarg direto do model)
  - [x] 6.2 No mesmo módulo (ou um dedicado, ex. `bujo/tests/isolation_cases.py` — decisão do dev), chamar `register_isolation_case(...)` para `Log` e para `Task` (ver `core/tests/registry.py` e `core/tests/models.py` como referência); adicionar o módulo escolhido a `_ISOLATION_TEST_MODULES` em `backend/conftest.py`
  - [x] 6.3 `bujo/tests/test_models.py`: `UniqueConstraint` de `Log` (mesma `(user_id, log_date)` levanta `IntegrityError`); `CheckConstraint` de `Task.status` (criar com status inválido via `.objects.create(status="bogus", ...)` levanta `IntegrityError` — lembrar de envolver em `transaction.atomic()` no teste, senão a transação de teste fica abortada para as asserções seguintes); relações self-FK (`parent_task`/`subtasks`, `migrated_to_task`/`migrated_from`) funcionam
  - [x] 6.4 `bujo/tests/test_services.py`: `transition_task` parametrizado sobre as 36 combinações (6×6) de `Status`, comparando contra `ALLOWED` — cada combinação fora da matriz levanta `InvalidTransition`, cada uma dentro persiste o novo `status`; `get_or_create_daily_log` idempotente (duas chamadas com o mesmo `user`+`log_date` retornam o mesmo `Log.id`, sem duplicar) e escopado por tenant (dois usuários com o mesmo `log_date` geram `Log`s distintos)
  - [x] 6.5 Rodar a suíte completa (`pytest`) incluindo `core/tests/test_guardrails.py` (guardrail de manager escopado cobre `Task`/`Log` automaticamente) e `import-linter` — confirmar tudo verde antes de finalizar

- [x] **Task 7: Remover o placeholder da camada de serviço** (housekeeping — não é AC, mas é instrução explícita do próprio arquivo)
  - [x] 7.1 Remover `backend/core/services.py` e `backend/core/tests/test_services.py` — o docstring do arquivo instrui removê-lo "quando o primeiro serviço de domínio real for criado"; `bujo/services/` (Task 4/5) é esse primeiro serviço

## Dev Notes

### Escopo desta story — só backend

As ACs do Épico 3 para a Story 3.1 cobrem **apenas** `model + service layer` (schema + máquina de estados). Não há serializers, views, URLs nem UI nesta story — isso começa na Story 3.2 (superfície do Daily Log). Não criar endpoints/serializers antecipadamente.

### Nomenclatura de FK — por que os nomes de campo importam

Para que a coluna gerada bata exatamente com o nome exigido pela AC (`log_id`, `migrated_to_task_id`, `parent_task_id`), o **nome do campo Python** deve ser o nome da coluna **sem** o sufixo `_id` (Django adiciona `_id` automaticamente a toda `ForeignKey`):
- campo `log` → coluna `log_id`
- campo `migrated_to_task` → coluna `migrated_to_task_id`
- campo `parent_task` → coluna `parent_task_id`

`source_template_id` é diferente: a própria AC já escreve o nome **com** `_id` porque **não é uma FK** — `recurring_task_templates` só é criada no Épico 4 (AD-08). Por isso o campo é um `UUIDField` solto (nulo, inerte), não um `ForeignKey("recurring_task_templates")`.

### Matriz de transições completa (AD-02) — para implementar `ALLOWED`

| De \ Para | pending | started | completed | cancelled | migrated | postponed |
|---|---|---|---|---|---|---|
| **pending** | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **started** | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| **completed** | ✅ | ✅ | — | ✅ | ❌ | ❌ |
| **cancelled** | ✅ | ❌ | ❌ | — | ❌ | ❌ |
| **migrated** | ❌ | ❌ | ❌ | ❌ | — | ❌ |
| **postponed** | ❌ | ❌ | ❌ | ❌ | ❌ | — |

`—` (auto-transição) conta como **ilegal** também — não está em nenhum conjunto `ALLOWED[x]`. A distinção entre "clique"/"menu"/"fluxo"/"edição manual" da AD-02 é uma questão de **qual caller/UI aciona** a transição (Épico 4 será o único caller que pede `to_status=migrated/postponed`) — não uma distinção que o `state_machine.py` precisa modelar com funções separadas. Um único `transition_task(*, user, task_id, to_status)` que impõe a matriz inteira é suficiente e é o que a AC pede ("a matriz de transições é imposta no serviço").

### Reference Implementation obrigatória (§6.10 da arquitetura)

```python
# bujo/services/state_machine.py — forma normativa, copiar o padrão
@transaction.atomic
def transition_task(*, user, task_id, to_status) -> Task:
    task = Task.objects.get(id=task_id)            # objects = auto-escopado por user
    if to_status not in ALLOWED[task.status]:
        raise InvalidTransition(task.status, to_status)   # core.exceptions → 409
    task.status = to_status
    task.save(update_fields=["status"])
    return task
```

### Padrão de factory para models tenant sem FK de User

`TenantModel.user_id` é um `UUIDField` puro, **não uma FK** para `User` (decisão deliberada documentada no docstring de `core/models.py` — isolamento fica na camada de aplicação, nunca via FK/RLS). Isso significa que uma factory não pode simplesmente declarar `user = factory.SubFactory(UserFactory)` como atributo direto do model (o `Task`/`Log` não têm campo `user`, só `user_id` — passar `user=...` para o construtor do model levantaria `TypeError`). O padrão correto usa `class Params` do `factory_boy` (declara um parâmetro auxiliar que **não** é passado ao model) + `SelfAttribute`:

```python
# bujo/tests/factories.py
from datetime import date, timedelta

import factory
from factory.django import DjangoModelFactory

from accounts.tests.factories import UserFactory
from bujo.models import Log, Task


class LogFactory(DjangoModelFactory):
    class Meta:
        model = Log

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    log_date = factory.Sequence(lambda n: date(2026, 1, 1) + timedelta(days=n))


class TaskFactory(DjangoModelFactory):
    class Meta:
        model = Task

    class Params:
        user = factory.SubFactory(UserFactory)

    user_id = factory.SelfAttribute("user.id")
    log = factory.SubFactory(LogFactory, user=factory.SelfAttribute("..user"))
    title = factory.Sequence(lambda n: f"Tarefa {n}")
    order_index = factory.Sequence(lambda n: float(n))
```

`TaskFactory(user=x)` propaga o mesmo `x` para o `log` gerado (via `factory.SelfAttribute("..user")`, que sobe um nível para o `Params.user` do factory pai) — evita um `Task` e seu `Log` pertencerem a tenants diferentes por acidente.

**Atenção ao guardrail temporal:** `bujo/tests/factories.py` **não** é isento do guardrail de `core/tests/test_guardrails.py::test_no_bare_date_today_outside_calendar` (o guardrail só pula arquivos `test_*.py`/`conftest.py`; `factories.py` não bate nesse padrão). Por isso `log_date` acima usa uma data fixa + `timedelta`, nunca `date.today()`.

### Registro no contrato de isolamento compartilhado (§7.4)

Não copiar `test_isolation.py` — registrar `Log` e `Task` no registry existente (mesmo mecanismo usado por `core/tests/models.py`, ver também `core/tests/test_isolation.py::test_isolation_contract`):

```python
from core.tests.registry import register_isolation_case

register_isolation_case(
    id="bujo.Log",
    model=Log,
    make=lambda: {"log_date": date(2026, 1, 1)},
)
register_isolation_case(
    id="bujo.Task",
    model=Task,
    make=lambda: {
        "log": Log.objects.create(log_date=date(2026, 1, 1)),
        "title": "Tarefa de isolamento",
        "order_index": 0.0,
    },
)
```

`make()` roda **dentro** do `with tenant_context(user):` do teste genérico (`test_isolation_contract`), então o `Log.objects.create(...)` embutido no `make` de `Task` herda o tenant certo automaticamente — não precisa (nem deve) passar `user_id` explícito. `table=None` (default) porque são models reais com migration, ao contrário do `TenantTestModel` fake de `core`. Depois de registrar, adicionar o módulo escolhido (ex. `"bujo.tests.factories"`) à lista `_ISOLATION_TEST_MODULES` em `backend/conftest.py`.

### `CheckConstraint` no Django 5.1: `condition=`, não `check=`

O projeto está em `django>=5.1,<6.0` (`pyproject.toml`). Django 5.1 renomeou o kwarg de `CheckConstraint` de `check` para `condition` (o antigo emite `DeprecationWarning` e some no Django 6). Usar `models.CheckConstraint(condition=models.Q(...), name=...)`.

### Por que só `Task.status` tem `CheckConstraint`, e não `eisenhower`

§6.1 da arquitetura lista explicitamente onde `TextChoices + CheckConstraint` se aplica: "status de tarefa (AD-02), blocos de medicamento (AD-07), `source` (AD-07), tipo de hábito (AD-01), tipo de dia (AD-10)" — `eisenhower` não está nessa lista, e a AC desta story só pede `CheckConstraint` para `status`. Implementar apenas `TextChoices` (com validação de `choices` na borda via futuro serializer) para `eisenhower`, sem constraint de banco adicional — não inventar uma regra que a arquitetura não pediu.

### Decisões assumidas — não mandatadas literalmente pela arquitetura

Nem tudo no schema tem uma resposta explícita nos documentos; as escolhas abaixo são defaults razoáveis desta story, não regras arquiteturais gravadas em pedra — revisar/ajustar no code-review se houver motivo:
- `on_delete=CASCADE` em `Task.log` e `Task.parent_task` (deletar o Daily Log, ou o pai de uma subtarefa, remove as tarefas/subtarefas dependentes); `on_delete=SET_NULL` em `Task.migrated_to_task` (a tarefa original sobrevive mesmo se a sucessora for removida — coerente com "registro original preservado" da AD-03).
- `title` como `CharField(max_length=500)` — nenhum limite é especificado em FR-1.3/AD-03; 500 é uma folga generosa para um título de tarefa.
- `Meta.ordering = ["order_index"]` em `Task` — não é uma AC desta story (a reordenação manual é Story 3.4), mas dá uma ordem de leitura previsível por padrão sem custo/risco.

### Gap encontrado — sinalizar para as Stories 3.2/3.3, não resolver aqui

As ACs de UI das Stories 3.2 ("borda lateral 3px da categoria") e 3.3 ("editar título, descrição, **categoria**, Eisenhower") referenciam um campo/conceito de **categoria** de tarefa (tokens `cat-teal`/`cat-purple`/`cat-pink`/`cat-yellow`/`cat-green`/`cat-blue` em `DESIGN.md` §"Categorias Semânticas", distinto dos tokens `priority-*` do Eisenhower). Esse campo **não aparece** na lista de campos congelados desta AC 1, nem em FR-1.3 do PRD (que lista só título/descrição/subtarefas/Eisenhower). Como o Épico 3 existe justamente para **congelar o schema por completo** antes do Épico 4 consumir, este é um risco real: se "categoria" for de fato um campo de `Task`, ele precisa ser adicionado **agora**, enquanto o schema ainda está aberto — adicioná-lo depois do Épico 3 fechado violaria a premissa de "schema congelado" do próprio Épico. Esta story **não** adiciona o campo (não está na AC), mas o gap deve ser resolvido explicitamente antes/durante a criação da Story 3.2 (confirmar com o PRD/UX se "categoria" = Eisenhower renomeado, ou se é um campo adicional esquecido no freeze).

### Contexto de deferred-work relevante

`_bmad-output/implementation-artifacts/deferred-work.md` (review da Story 1.2) registra: *"Escrita cross-tenant não validada contra o contexto ativo... Endereçar validação `user_id == current_user_id` + guarda de `bulk_create` quando surgir a primeira camada de escrita de domínio."* `bujo/services/` **é** essa primeira camada de escrita de domínio real. Esta story não adiciona essa validação (não está na AC, e `transition_task`/`get_or_create_daily_log` não recebem `user_id` explícito de fora), mas é um ponto que o code-review desta story deve considerar explicitamente — decidir se fecha o item deferido agora ou se permanece deferido.

Também relevante do mesmo arquivo: *"Mapeamento 404 'recurso de outro usuário' não implementado nem testado... inexistente até o Épico 3+. Cobrir com a primeira view de recurso."* — **não** se aplica ainda a esta story especificamente (sem views), mas será relevante já na Story 3.2.

### Project Structure Notes

- Novo app `bujo/` segue exatamente o padrão de `core/`/`accounts/` (mesmo `AppConfig`, mesma divisão `models.py` + `services/` + `tests/`), primeiro app de domínio do produto (§7.1 da arquitetura já reserva esse layout).
- `bujo/services/` nasce como pacote (`__init__.py` + `state_machine.py` + `logs.py`) em vez de um único `services.py` — a árvore da arquitetura (§7.1) já antecipa `services/{state_machine,migration,catchup}.py`; `migration.py`/`catchup.py` ficam para o Épico 4 (não criar agora, seriam arquivos vazios sem AC que os justifique).
- Nenhuma variância detectada entre o schema pedido pela AC e a árvore de projeto documentada — a única lacuna real é a de "categoria" descrita acima, que é uma lacuna de **especificação** (PRD/épico/UX desalinhados entre si), não de estrutura de projeto.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1 (linhas 533-554)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-02 — Máquina de Estados de Tarefas]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-03 — Rastreamento de Linhagem de Tarefas]
- [Source: _bmad-output/planning-artifacts/architecture.md#6.1 Nomenclatura, §6.2 Estrutura, §6.4 Erros, §6.7 Multi-Tenant, §6.8 Tempo/Materialização, §6.10 Reference Implementations]
- [Source: _bmad-output/planning-artifacts/architecture.md#7.1 Árvore do Projeto]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-1.3 a FR-1.6]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/DESIGN.md#Categorias Semânticas (gap de "categoria")]
- [Source: backend/core/models.py, core/tenant.py, core/exceptions.py, core/services.py (a remover)]
- [Source: backend/conftest.py, core/tests/registry.py, core/tests/models.py, core/tests/test_isolation.py]
- [Source: backend/pyproject.toml#tool.importlinter]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from code review of 1-2-modulo-core-...]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `makemigrations bujo` gerou `bujo/migrations/0001_initial.py` (`Log` + `Task`, ambas constraints presentes) na primeira tentativa após o desvio de `TaskStatus` (ver Completion Notes).
- `migrate bujo` aplicado com sucesso na Neon dev branch (`.env.dev`).
- `pytest -q`: 119 passed (suíte completa, incluindo os novos testes de `bujo`). **[Atualizado no code-review: a rodada de automação de QA pós-dev fechou 2 gaps de cobertura (`test_transition_task_escopado_por_tenant`, `test_task_campos_de_linhagem_tem_defaults_inertes` — ver `_bmad-output/implementation-artifacts/tests/test-summary.md`), elevando o total para 121 passed. Este número não havia sido propagado de volta para o Dev Agent Record.]**
- `lint-imports`: contrato `core must not import domain apps (port rule)` KEPT.
- `ruff check .`: All checks passed (após remover import não usado e suprimir `DJ001` com `noqa` justificado em 2 campos nuláveis exigidos pela AC).
- Teardown do banco de teste (`test_neondb`) falhou uma vez por sessão concorrente na Neon dev branch (infra pré-existente, não relacionado ao código desta story); banco removido manualmente (`DROP DATABASE ... WITH (FORCE)`) e a suíte re-executada verde.

### Completion Notes List

- **Desvio da Reference Implementation (§6.10) documentado na Task 3.5**: `Task.Status.values` referenciado de dentro do `Meta` (classe aninhada) levanta `NameError` em Python puro — uma classe aninhada não enxerga o namespace da classe que a contém, apenas o do módulo (verificado empiricamente antes de implementar). Corrigido definindo `TaskStatus` no nível do módulo (única fonte de verdade, visível de `Meta`) e expondo `Task.Status = TaskStatus`, preservando `Task.Status.PENDING` etc. para todos os consumidores (`state_machine.py`, testes, futuras stories).
- Implementados `Log` e `Task` em `bujo/models.py` com todos os campos da AC #1, incluindo os campos congelados/inertes de linhagem (`migrated_to_task`, `migration_count`, `parent_task`, `source_template_id`).
- `bujo/services/logs.py::get_or_create_daily_log` e `bujo/services/state_machine.py::transition_task` seguem literalmente o padrão de serviço (`@transaction.atomic`, keyword-only args, `user` primeiro) e a Reference Implementation do state machine.
- `ALLOWED` cobre exatamente a matriz AD-02 (verificado campo a campo contra a tabela do Dev Notes); testado com as 36 combinações (6×6) parametrizadas.
- Registrados `bujo.Log` e `bujo.Task` no contrato de isolamento compartilhado (`core/tests/registry.py`); `bujo.tests.factories` adicionado a `_ISOLATION_TEST_MODULES` em `backend/conftest.py` — cobertos automaticamente por `test_isolation_contract`.
- Removidos `core/services.py` e `core/tests/test_services.py` (placeholder), conforme instrução do próprio docstring do arquivo — `bujo/services/` é o primeiro serviço de domínio real.
- **Item deferido não fechado nesta story** (sinalizado no Dev Notes para revisão de code-review): `transition_task`/`get_or_create_daily_log` não validam `user_id == current_user_id` explicitamente — dependem inteiramente do escopo automático de `Task.objects`/`Log.objects` (fail-closed via `TenantManager`). Não há AC pedindo essa validação explícita nesta story; decisão de fechar ou manter deferido fica para o code-review.
- Gap de "categoria" (Dev Notes) permanece sinalizado, não resolvido aqui — fora do escopo desta AC.
- Dois campos exigidos como nuláveis pela AC (`eisenhower`, `description`) disparam `ruff`/`DJ001` (`null=True` em campo de texto); suprimido com `# noqa: DJ001` inline (mesmo padrão de `# noqa: DJ012` já usado em `core/models.py`), pois a nulidade é uma decisão explícita da AC, não um esquecimento.

### File List

- `backend/bujo/__init__.py` (novo)
- `backend/bujo/apps.py` (novo)
- `backend/bujo/models.py` (novo)
- `backend/bujo/migrations/__init__.py` (novo)
- `backend/bujo/migrations/0001_initial.py` (novo)
- `backend/bujo/services/__init__.py` (novo)
- `backend/bujo/services/logs.py` (novo)
- `backend/bujo/services/state_machine.py` (novo)
- `backend/bujo/tests/__init__.py` (novo)
- `backend/bujo/tests/factories.py` (novo)
- `backend/bujo/tests/test_models.py` (novo)
- `backend/bujo/tests/test_services.py` (novo)
- `backend/config/settings/base.py` (modificado — `"bujo"` em `INSTALLED_APPS`)
- `backend/conftest.py` (modificado — `bujo.tests.factories` em `_ISOLATION_TEST_MODULES`)
- `backend/core/services.py` (removido — placeholder substituído pelo primeiro serviço real)
- `backend/core/tests/test_services.py` (removido — testes do placeholder)

## Senior Developer Review (AI)

**Data:** 2026-07-03
**Revisor:** claude-sonnet-5 (adversarial review)

**Resultado:** APROVADO — 0 issues críticos ou altos. 1 médio corrigido automaticamente.

### Achados e Correções

| # | Severidade | Achado | Ação |
|---|---|---|---|
| M1 | MEDIUM | Debug Log References citava "119 passed", mas a suíte completa atual (`pytest -q`) roda **121 passed** — a rodada de automação de QA pós-dev fechou 2 gaps de cobertura (`test_transition_task_escopado_por_tenant` em `test_services.py`, `test_task_campos_de_linhagem_tem_defaults_inertes` em `test_models.py`; ver `tests/test-summary.md`) e o número não foi propagado de volta ao Dev Agent Record | Corrigido — contagem atualizada no Debug Log References |

### Decisão registrada — item deferido (Dev Notes)

O próprio Dev Notes desta story sinalizava para o code-review decidir se fechava ou mantinha deferido: `transition_task`/`get_or_create_daily_log` não validam `user.id == current_user_id` explicitamente, dependendo inteiramente do escopo automático de `Task.objects`/`Log.objects` (`TenantManager`, fail-closed). **Decisão: mantido deferido, sem alteração de código.** Razões: (1) a Reference Implementation normativa de §6.10 (copiada literalmente nesta story) já define a assinatura sem essa validação — `user` existe só por convenção de assinatura de serviço; (2) nenhum dos dois serviços passa `user_id` explícito para `save()`/`create()`, então o mecanismo de risco descrito no item deferido original (Story 1.2 — `user_id` explícito arbitrário sobrevivendo em `save()`) não é exercitado aqui; (3) a rodada de QA já adicionou `test_transition_task_escopado_por_tenant`, que **prova empiricamente** que um `task_id` de outro tenant é inalcançável (`Task.DoesNotExist`) mesmo com o parâmetro `user` "decorativo". Reavaliar apenas se um novo caller passar `user_id` explícito fora do contexto ambiente (ex.: `bulk_create`, admin path) — o item geral de `core/models.py` permanece registrado em `deferred-work.md`.

### Verificações executadas nesta revisão

- `ruff check .` (backend completo): All checks passed.
- `lint-imports`: contrato `core must not import domain apps (port rule)` KEPT (1 kept, 0 broken).
- `pytest -q` (suíte completa): **121 passed**, 1 warning (mesma instabilidade de teardown do `test_neondb` já documentada, não relacionada ao código).
- `test_isolation_contract` parametrizado confirma `bujo.Log` e `bujo.Task` corretamente registrados (`core/tests/test_isolation.py::test_isolation_contract[bujo.Log]`, `[bujo.Task]`).
- Matriz `ALLOWED` em `bujo/services/state_machine.py` conferida linha a linha contra a tabela AD-02 do Dev Notes — idêntica.
- `git status`/`git diff` cross-referenciados com o File List da story — nenhuma discrepância (todos os arquivos alterados estão documentados, nenhum arquivo listado ficou sem alteração real).
- Nenhuma referência remanescente a `core.services` após a remoção do placeholder.

**AC validados:** AC1 ✅ AC2 ✅ AC3 ✅
**Tasks 1–7:** todas as 7 tasks marcadas `[x]` verificadas contra a implementação real — nenhuma claim falsa encontrada.

## Change Log

- 2026-07-03: Story 3.1 implementada — app `bujo/` registrado; models `Log` e `Task` (schema completo + campos de linhagem congelados/inertes); `bujo/services/{logs,state_machine}.py` (`get_or_create_daily_log` idempotente, `transition_task` com matriz `ALLOWED` da AD-02); `Log`/`Task` registrados no contrato de isolamento compartilhado; placeholder `core/services.py` removido. 119 testes passando, `import-linter` e `ruff check` verdes.
- 2026-07-03: QA automation — 2 gaps de cobertura fechados (`test_transition_task_escopado_por_tenant`, `test_task_campos_de_linhagem_tem_defaults_inertes`); suíte completa 121 passed.
- 2026-07-03: Code review (AI adversarial) — 1 médio corrigido (contagem de testes no Dev Agent Record); item deferido de validação explícita de tenant avaliado e mantido deferido (já coberto empiricamente pelos testes de escopo); story → done.
